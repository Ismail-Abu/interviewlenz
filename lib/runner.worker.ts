/// <reference lib="webworker" />
// Classic Web Worker (bundled by Next via `new Worker(new URL(...))` in
// lib/runner.ts). It loads Pyodide from the official jsDelivr CDN, defines the
// student's code once, and runs every case through the shared Python harness.
//
// Protocol (all messages are plain objects):
//   worker -> main : { type: "ready" }
//                    { type: "load-error", message }
//                    { type: "result", id, result }        result = harness JSON
//                    { type: "run-error", id, message }
//   main   -> worker: { type: "run", id, source, functionName, cases }
import { RUNNER_HARNESS } from "./runnerHarness";

const PYODIDE_VERSION = "0.29.5";
const PYODIDE_JS = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`;

interface PyodideApi {
  runPython(code: string): unknown;
  globals: { set(name: string, value: unknown): void };
}

declare function loadPyodide(config?: { indexURL?: string }): Promise<PyodideApi>;

interface RunMessage {
  type: "run";
  id: number;
  source: string;
  functionName: string;
  cases: unknown[];
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let pyodide: PyodideApi | null = null;

// Start loading immediately so the worker is warm before the first Run.
const ready: Promise<void> = (async () => {
  importScripts(PYODIDE_JS);
  pyodide = await loadPyodide();
  pyodide.runPython(RUNNER_HARNESS);
})();

ready.then(
  () => ctx.postMessage({ type: "ready" }),
  (error) => ctx.postMessage({ type: "load-error", message: String(error) }),
);

ctx.onmessage = async (event: MessageEvent<RunMessage>) => {
  const message = event.data;
  if (!message || message.type !== "run") return;

  try {
    await ready;
  } catch {
    ctx.postMessage({
      type: "run-error",
      id: message.id,
      message: "Python worker could not initialize",
    });
    return;
  }

  try {
    const payload = JSON.stringify({
      source: message.source,
      functionName: message.functionName,
      cases: message.cases,
    });
    pyodide!.globals.set("__RUN_PAYLOAD__", payload);
    const raw = pyodide!.runPython("_run_harness(__RUN_PAYLOAD__)") as string;
    ctx.postMessage({ type: "result", id: message.id, result: JSON.parse(raw) });
  } catch (error) {
    ctx.postMessage({ type: "run-error", id: message.id, message: String(error) });
  }
};
