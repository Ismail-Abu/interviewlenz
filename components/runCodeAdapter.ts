import type { RunRequest, RunResult } from "@/lib/contract";
import { runCode } from "@/lib/runner";
import runPass from "@/fixtures/run-pass.json";
import runFail from "@/fixtures/run-fail.json";
import runSyntaxError from "@/fixtures/run-syntax-error.json";
import runUnavailable from "@/fixtures/run-unavailable.json";

// "real" runs the student's code in Ismail's Pyodide runner (lib/runner.ts).
// The fixture modes are a dev fallback; their results are labeled FIXTURE DATA.
export type RunMode = "real" | "cycle" | "pass" | "fail" | "syntax" | "unavailable";
type FixtureKey = Exclude<RunMode, "real" | "cycle">;

export interface AdapterResult {
  result: RunResult;
  fromFixture: boolean;
}

// The only place the UI calls the runner.
export async function runCodeAdapter(req: RunRequest, mode: RunMode = "real"): Promise<AdapterResult> {
  if (mode === "real") return { result: await runCode(req), fromFixture: false };
  return { result: await runFixture(req, mode), fromFixture: true };
}

const FIXTURES = {
  pass: runPass,
  fail: runFail,
  syntax: runSyntaxError,
  unavailable: runUnavailable,
} as unknown as Record<FixtureKey, RunResult>;

const CYCLE: FixtureKey[] = ["pass", "fail", "syntax", "unavailable"];
let cycleIndex = 0;

async function runFixture(req: RunRequest, mode: Exclude<RunMode, "real">): Promise<RunResult> {
  const key = mode === "cycle" ? CYCLE[cycleIndex++ % CYCLE.length] : mode;
  await new Promise((resolve) => setTimeout(resolve, 600));
  // Echo the submitted request like the real runner does.
  return {
    ...structuredClone(FIXTURES[key]),
    sessionId: req.sessionId,
    problemId: req.problemId,
    codeVersion: req.codeVersion,
    ranAt: new Date().toISOString(),
  };
}
