// Client-side only: the in-browser Java runner. Nothing is sent to a server.
//
// CheerpJ (a JVM compiled to WebAssembly, https://cheerpj.com) is loaded from
// its CDN the first time Java is chosen. Our runner, java/IlzMem.java (compiled
// by scripts/build-java-runner.mjs), is called in CheerpJ
// "library mode" from public/cheerpj/ilz-runner.jar:
// IlzMem.run(source, harness, ms) compiles the candidate's code
// with javac and runs it in memory, returning a JSON string.
//
// CheerpJ runs Java on the page's main thread, so nothing here could interrupt
// a runaway loop. IlzMem instruments every loop and method with a time guard,
// which ends such code as a timeout after TIME_LIMIT_MS.
//
// Licence: CheerpJ's free Community licence covers personal, educational and
// hobby use; commercial use needs a paid licence (https://cheerpj.com/licensing).
import type { ApiError, CaseResult, Problem, RunRequest, RunResult } from "./contract";
import { buildJavaHarness } from "./javaHarness";

const CHEERPJ_LOADER = "https://cjrtnc.leaningtech.com/5.0/loader.js";
const JAVA_VERSION = 21; // must match --release in scripts/build-java-runner.mjs
// CheerpJ maps /app/ to the site root, so this is public/cheerpj/ilz-runner.jar.
const RUNNER_PATH = "/app/cheerpj/ilz-runner.jar";
const TIME_LIMIT_MS = 5000;

type IlzMem = { run(source: string, harness: string, ms: number): Promise<string> };
type CheerpjGlobals = {
  cheerpjInit?: (options: { version: number; status: "none" }) => Promise<void>;
  cheerpjRunLibrary?: (classPath: string) => Promise<Record<string, Promise<IlzMem>>>;
};

let loading: Promise<IlzMem | null> | null = null;
let queue: Promise<unknown> = Promise.resolve();

const UNAVAILABLE: ApiError = {
  code: "runner_unavailable",
  message: "Java runner could not initialize",
  retryable: true,
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing?.dataset.loaded === "true") return resolve();
    const el = existing ?? document.createElement("script");
    el.addEventListener("load", () => { el.dataset.loaded = "true"; resolve(); }, { once: true });
    el.addEventListener("error", () => reject(new Error("CheerpJ loader failed")), { once: true });
    if (!existing) {
      el.src = src;
      el.async = true;
      document.head.appendChild(el);
    }
  });
}

function ensureJava(): Promise<IlzMem | null> {
  if (!loading) {
    loading = (async () => {
      await loadScript(CHEERPJ_LOADER);
      const g = window as unknown as CheerpjGlobals;
      if (!g.cheerpjInit) throw new Error("CheerpJ loader missing");
      // status "none": no CheerpJ status overlay; the page shows its own state.
      await g.cheerpjInit({ version: JAVA_VERSION, status: "none" });
      // cheerpjRunLibrary only exists once cheerpjInit has finished.
      if (!g.cheerpjRunLibrary) throw new Error("CheerpJ library mode missing");
      const lib = await g.cheerpjRunLibrary(RUNNER_PATH);
      return await lib.IlzMem;
    })().catch(() => {
      loading = null; // allow a later retry
      return null;
    });
  }
  return loading;
}

// Start downloading and starting Java (a few seconds the first time). Safe to
// call repeatedly. Never rejects.
export function preloadJavaRunner(): Promise<void> {
  return ensureJava().then(() => undefined);
}

type RunnerJson =
  | { kind: "completed"; cases: CaseResult[] }
  | { kind: "error"; code: ApiError["code"]; message: string; line?: number };

// Resolves to a RunResult and never throws. Runs are serialized: there is one JVM.
export function runJava(req: RunRequest, problem: Problem): Promise<RunResult> {
  const next = queue.then(() => runOne(req, problem));
  queue = next.catch(() => undefined);
  return next;
}

async function runOne(req: RunRequest, problem: Problem): Promise<RunResult> {
  const ranAt = new Date().toISOString();
  const started = Date.now();
  const meta = { sessionId: req.sessionId, problemId: req.problemId, codeVersion: req.codeVersion, ranAt };
  const fail = (error: ApiError): RunResult => ({ ...meta, durationMs: Date.now() - started, status: "error", error });

  if (!problem.java) {
    return fail({ code: "invalid_request", message: `${problem.title} is not available in Java yet`, retryable: false });
  }
  try {
    const mem = await ensureJava();
    if (!mem) return fail(UNAVAILABLE);
    const raw = String(await mem.run(req.source, buildJavaHarness(problem, problem.java), TIME_LIMIT_MS));
    const out = JSON.parse(raw) as RunnerJson;
    if (out.kind === "error") {
      return fail({
        code: out.code,
        message: out.message,
        retryable: out.code !== "syntax_error",
        ...(out.line ? { line: out.line } : {}),
      });
    }
    const passed = out.cases.filter((c) => c.pass).length;
    return { ...meta, durationMs: Date.now() - started, status: "completed", cases: out.cases, passed, total: out.cases.length };
  } catch {
    return fail(UNAVAILABLE);
  }
}
