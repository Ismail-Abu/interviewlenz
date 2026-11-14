// Dev-only completion check for task B1 (not shipped with the app).
//
// It exercises the REAL lib/runner.ts end to end: esbuild bundles it (resolving
// its extensionless imports), a Pyodide-backed fake Worker stands in for the
// browser Web Worker using the SAME protocol and the SAME Python harness
// (lib/runnerHarness.ts) that lib/runner.worker.ts loads from the CDN, and each
// RunResult is compared against fixtures/run-*.json.
//
// Requirements: Node 22+ and the dev deps `pyodide` and `esbuild`.
// Run:  node --experimental-strip-types dev/runner-check.mjs
//
// The only differences from production are the Pyodide load path (local npm
// package vs jsDelivr CDN) and that a hung run is simulated by a worker that
// never replies, since a real busy-loop would block Node's single thread while
// a browser Worker runs on its own thread.

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { loadPyodide } from "pyodide";
import { RUNNER_HARNESS } from "../lib/runnerHarness.ts";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const fixture = (name) =>
  JSON.parse(readFileSync(join(REPO_ROOT, "fixtures", name), "utf8"));

const CORRECT = "def contains_duplicate(nums):\n    return len(set(nums)) != len(nums)";
const ADJACENT =
  "def contains_duplicate(nums):\n" +
  "    for i in range(len(nums) - 1):\n" +
  "        if nums[i] == nums[i + 1]:\n" +
  "            return True\n" +
  "    return False";
const BAD_SYNTAX = "def contains_duplicate(nums):\n    return = 5";
const PRINT_AND_RAISE =
  "def contains_duplicate(nums):\n" +
  "    print('n =', len(nums))\n" +
  "    if not nums:\n" +
  "        raise ValueError('empty input')\n" +
  "    return len(set(nums)) != len(nums)";
const HANG = "__HANG__";

// --- Pyodide-backed fake Worker, mirroring lib/runner.worker.ts ------------
let pyodideReady = null;
function getPyodide() {
  if (!pyodideReady) {
    pyodideReady = loadPyodide().then((py) => {
      py.runPython(RUNNER_HARNESS);
      return py;
    });
  }
  return pyodideReady;
}

let failNextLoad = false;

class FakeWorker {
  constructor() {
    this.listeners = new Map();
    this.terminated = false;
    const shouldFail = failNextLoad;
    failNextLoad = false;
    queueMicrotask(async () => {
      if (shouldFail) {
        this.#emit("message", { type: "load-error", message: "forced failure" });
        return;
      }
      try {
        await getPyodide();
        this.#emit("message", { type: "ready" });
      } catch (error) {
        this.#emit("message", { type: "load-error", message: String(error) });
      }
    });
  }
  addEventListener(type, cb) {
    const list = this.listeners.get(type) ?? [];
    list.push(cb);
    this.listeners.set(type, list);
  }
  postMessage(message) {
    if (!message || message.type !== "run") return;
    if (message.source === HANG) return; // never reply -> main-thread timeout
    queueMicrotask(async () => {
      try {
        const py = await getPyodide();
        const payload = JSON.stringify({
          source: message.source,
          functionName: message.functionName,
          cases: message.cases,
        });
        py.globals.set("__RUN_PAYLOAD__", payload);
        const raw = py.runPython("_run_harness(__RUN_PAYLOAD__)");
        this.#emit("message", {
          type: "result",
          id: message.id,
          result: JSON.parse(raw),
        });
      } catch (error) {
        this.#emit("message", { type: "run-error", id: message.id, message: String(error) });
      }
    });
  }
  terminate() {
    this.terminated = true;
  }
  #emit(type, data) {
    if (this.terminated) return;
    for (const cb of this.listeners.get(type) ?? []) cb({ data });
  }
}
globalThis.Worker = FakeWorker;

// --- Load the real runner.ts -----------------------------------------------
async function loadRunner() {
  const built = await esbuild.build({
    entryPoints: [join(REPO_ROOT, "lib", "runner.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
  });
  const dir = mkdtempSync(join(tmpdir(), "runner-check-"));
  const file = join(dir, "runner.bundle.mjs");
  writeFileSync(file, built.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

// --- Assertions ------------------------------------------------------------
let failures = 0;
function check(label, cond, detail) {
  const ok = Boolean(cond);
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok || detail === undefined ? "" : `  (${detail})`}`);
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}

// Same recursive key structure and primitive types, values ignored.
function sameShape(a, b) {
  if (a === null || b === null) return a === null && b === null ? true : typeof a === typeof b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return true;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length === 0 || b.length === 0) return true;
    return a.every((item) => sameShape(item, b[0]));
  }
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length || !ka.every((k, i) => k === kb[i])) return false;
  return ka.every((k) => sameShape(a[k], b[k]));
}

const withoutTimes = (r) => {
  const copy = { ...r };
  delete copy.ranAt;
  delete copy.durationMs;
  return copy;
};

async function main() {
  const { preloadRunner, runCode } = await loadRunner();

  console.log("B1 runner completion check\n");

  // (f) unknown problem never touches the worker.
  console.log("unknown_problem:");
  const unknown = await runCode({
    sessionId: "s1",
    problemId: "nope",
    codeVersion: 0,
    language: "python",
    source: CORRECT,
  });
  check("status error / unknown_problem / not retryable",
    unknown.status === "error" &&
      unknown.error.code === "unknown_problem" &&
      unknown.error.retryable === false,
    JSON.stringify(unknown.error));

  // (d) runner fails to load -> runner_unavailable. Done before any healthy
  // worker exists so later scenarios get a fresh, working one.
  console.log("\nrunner_unavailable (Pyodide fails to load):");
  failNextLoad = true;
  const unavailable = await runCode({
    sessionId: "s1",
    problemId: "contains-duplicate",
    codeVersion: 6,
    language: "python",
    source: CORRECT,
  });
  check("status error / runner_unavailable / retryable",
    unavailable.status === "error" &&
      unavailable.error.code === "runner_unavailable" &&
      unavailable.error.retryable === true,
    JSON.stringify(unavailable.error));
  check("shape matches fixtures/run-unavailable.json",
    sameShape(unavailable, fixture("run-unavailable.json")));

  await preloadRunner();
  await preloadRunner(); // safe to call more than once

  // (a) correct set-based solution.
  console.log("\n(a) correct set-based solution:");
  const pass = await runCode({
    sessionId: "s1",
    problemId: "contains-duplicate",
    codeVersion: 3,
    language: "python",
    source: CORRECT,
  });
  check("status completed", pass.status === "completed", pass.status);
  check("4 / 4 passed", pass.passed === 4 && pass.total === 4, `${pass.passed}/${pass.total}`);
  check("echoes sessionId + problemId + codeVersion",
    pass.sessionId === "s1" && pass.problemId === "contains-duplicate" && pass.codeVersion === 3);
  check("equals fixtures/run-pass.json (minus ranAt/durationMs)",
    deepEqual(withoutTimes(pass), withoutTimes(fixture("run-pass.json"))),
    JSON.stringify(withoutTimes(pass)));
  check("ranAt is string, durationMs is number",
    typeof pass.ranAt === "string" && typeof pass.durationMs === "number");

  // (b) buggy adjacent-only solution: c1 fails, rest pass.
  console.log("\n(b) buggy adjacent-only solution:");
  const fail = await runCode({
    sessionId: "s1",
    problemId: "contains-duplicate",
    codeVersion: 4,
    language: "python",
    source: ADJACENT,
  });
  check("status completed", fail.status === "completed", fail.status);
  check("3 / 4 passed", fail.passed === 3 && fail.total === 4, `${fail.passed}/${fail.total}`);
  const c1 = fail.cases.find((c) => c.caseId === "c1");
  check("c1 fails with actual False", c1 && c1.pass === false && c1.actual === "False",
    JSON.stringify(c1));
  check("c2, c3, c4 pass",
    ["c2", "c3", "c4"].every((id) => fail.cases.find((c) => c.caseId === id)?.pass === true));
  check("equals fixtures/run-fail.json (minus ranAt/durationMs)",
    deepEqual(withoutTimes(fail), withoutTimes(fixture("run-fail.json"))),
    JSON.stringify(withoutTimes(fail)));

  // (c) invalid syntax.
  console.log("\n(c) invalid Python syntax:");
  const syntax = await runCode({
    sessionId: "s1",
    problemId: "contains-duplicate",
    codeVersion: 5,
    language: "python",
    source: BAD_SYNTAX,
  });
  check("status error / syntax_error / not retryable",
    syntax.status === "error" &&
      syntax.error.code === "syntax_error" &&
      syntax.error.retryable === false,
    JSON.stringify(syntax.error));
  check("reports a line number", syntax.status === "error" && syntax.error.line === 2,
    JSON.stringify(syntax.error));
  check("message is a non-empty string",
    syntax.status === "error" && typeof syntax.error.message === "string" && syntax.error.message.length > 0,
    syntax.status === "error" ? syntax.error.message : "");
  check("shape matches fixtures/run-syntax-error.json",
    sameShape(syntax, fixture("run-syntax-error.json")));

  // (g) per-case exception + stdout capture.
  console.log("\n(g) per-case exception + stdout capture:");
  const mixed = await runCode({
    sessionId: "s1",
    problemId: "contains-duplicate",
    codeVersion: 7,
    language: "python",
    source: PRINT_AND_RAISE,
  });
  const c3 = mixed.status === "completed" && mixed.cases.find((c) => c.caseId === "c3");
  check("completed with 3 / 4 (empty case raised)",
    mixed.status === "completed" && mixed.passed === 3 && mixed.total === 4,
    mixed.status === "completed" ? `${mixed.passed}/${mixed.total}` : mixed.status);
  check("c3 failed: actual null + error text",
    c3 && c3.pass === false && c3.actual === null && /ValueError/.test(c3.error ?? ""),
    JSON.stringify(c3));
  check("stdout captured per case",
    mixed.status === "completed" && mixed.cases.every((c) => typeof c.stdout === "string" && c.stdout.includes("n =")));

  // (e) timeout -> terminate + retryable. ~5s; run last.
  console.log("\n(e) timeout (worker never replies, ~5s):");
  const timeout = await runCode({
    sessionId: "s1",
    problemId: "contains-duplicate",
    codeVersion: 8,
    language: "python",
    source: HANG,
  });
  check("status error / timeout / retryable",
    timeout.status === "error" &&
      timeout.error.code === "timeout" &&
      timeout.error.retryable === true,
    JSON.stringify(timeout.error));
  check("recovers after timeout (fresh worker runs)",
    (await runCode({
      sessionId: "s1",
      problemId: "contains-duplicate",
      codeVersion: 9,
      language: "python",
      source: CORRECT,
    })).status === "completed");

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
