// Client-side only. Never import this on the server: it constructs a Web Worker
// at module scope on demand and relies on browser globals.
import type { ApiError, CaseResult, RunRequest, RunResult } from "./contract";
import { getProblem } from "./problems";

const TIMEOUT_MS = 5000;

type HarnessResult =
  | { kind: "completed"; cases: CaseResult[] }
  | { kind: "error"; error: ApiError };

type WorkerInbound =
  | { type: "ready" }
  | { type: "load-error"; message?: string }
  | { type: "result"; id: number; result: HarnessResult }
  | { type: "run-error"; id: number; message?: string };

interface Runner {
  worker: Worker;
  ready: Promise<boolean>;
  pending: Map<number, (message: WorkerInbound) => void>;
}

let runner: Runner | null = null;
let sequence = 0;

const UNAVAILABLE: ApiError = {
  code: "runner_unavailable",
  message: "Python worker could not initialize",
  retryable: true,
};

function spawn(): Runner {
  const worker = new Worker(new URL("./runner.worker.ts", import.meta.url));
  const pending = new Map<number, (message: WorkerInbound) => void>();

  const ready = new Promise<boolean>((resolve) => {
    worker.addEventListener("message", (event: MessageEvent<WorkerInbound>) => {
      if (event.data.type === "ready") resolve(true);
      else if (event.data.type === "load-error") resolve(false);
    });
  });

  worker.addEventListener("message", (event: MessageEvent<WorkerInbound>) => {
    const data = event.data;
    if ((data.type === "result" || data.type === "run-error") && typeof data.id === "number") {
      const settle = pending.get(data.id);
      if (settle) {
        pending.delete(data.id);
        settle(data);
      }
    }
  });

  // An uncaught worker failure drops any in-flight run and discards the worker
  // so the next call spawns a fresh one.
  worker.addEventListener("error", () => {
    for (const settle of pending.values()) settle({ type: "run-error", id: -1 });
    pending.clear();
    if (runner && runner.worker === worker) runner = null;
  });

  return { worker, ready, pending };
}

function ensureRunner(): Runner {
  if (!runner) runner = spawn();
  return runner;
}

// Create the worker and begin loading Pyodide. Safe to call repeatedly; later
// calls reuse the existing worker. Never rejects.
export function preloadRunner(): Promise<void> {
  return ensureRunner().ready.then(
    () => undefined,
    () => undefined,
  );
}

// Resolves to a RunResult and never throws. Echoes sessionId, problemId, and
// codeVersion from the request.
export async function runCode(req: RunRequest): Promise<RunResult> {
  const ranAt = new Date().toISOString();
  const started = Date.now();

  const fail = (error: ApiError): RunResult => ({
    sessionId: req.sessionId,
    problemId: req.problemId,
    codeVersion: req.codeVersion,
    ranAt,
    durationMs: Date.now() - started,
    status: "error",
    error,
  });

  try {
    const problem = getProblem(req.problemId);
    if (!problem) {
      return fail({
        code: "unknown_problem",
        message: `Unknown problem: ${req.problemId}`,
        retryable: false,
      });
    }

    const active = ensureRunner();
    const loaded = await active.ready;
    if (!loaded) {
      active.worker.terminate();
      if (runner === active) runner = null;
      return fail(UNAVAILABLE);
    }

    const id = ++sequence;
    const outcome = await new Promise<WorkerInbound | { type: "timeout" }>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        active.pending.delete(id);
        resolve({ type: "timeout" });
      }, TIMEOUT_MS);

      active.pending.set(id, (message) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(message);
      });

      active.worker.postMessage({
        type: "run",
        id,
        source: req.source,
        functionName: problem.functionName,
        cases: problem.cases,
      });
    });

    if (outcome.type === "timeout") {
      active.worker.terminate();
      if (runner === active) runner = null;
      ensureRunner(); // start a replacement worker loading right away
      return fail({
        code: "timeout",
        message: "Execution exceeded the 5 second limit",
        retryable: true,
      });
    }

    if (outcome.type === "result") {
      const payload = outcome.result;
      if (payload.kind === "error") return fail(payload.error);

      const cases = payload.cases;
      const passed = cases.reduce((count, item) => (item.pass ? count + 1 : count), 0);
      return {
        sessionId: req.sessionId,
        problemId: req.problemId,
        codeVersion: req.codeVersion,
        ranAt,
        durationMs: Date.now() - started,
        status: "completed",
        cases,
        passed,
        total: cases.length,
      };
    }

    // run-error, or any message that is not a usable result.
    return fail(UNAVAILABLE);
  } catch {
    return fail(UNAVAILABLE);
  }
}
