import type { RunRequest, RunResult } from "@/lib/contract";
import runPass from "@/fixtures/run-pass.json";
import runFail from "@/fixtures/run-fail.json";
import runSyntaxError from "@/fixtures/run-syntax-error.json";
import runUnavailable from "@/fixtures/run-unavailable.json";

// The only place the UI calls the runner. When Ismail's lib/runner.ts merges,
// replace the body with: return runCode(req);
export async function runCodeAdapter(req: RunRequest): Promise<RunResult> {
  return runFixture(req);
}

// Whether results come from fixtures/ rather than real execution.
export const USING_FIXTURES = true;

export type FixtureMode = "cycle" | "pass" | "fail" | "syntax" | "unavailable";

const FIXTURES = {
  pass: runPass,
  fail: runFail,
  syntax: runSyntaxError,
  unavailable: runUnavailable,
} as unknown as Record<Exclude<FixtureMode, "cycle">, RunResult>;

const CYCLE: Exclude<FixtureMode, "cycle">[] = ["pass", "fail", "syntax", "unavailable"];

let fixtureMode: FixtureMode = "cycle";
let cycleIndex = 0;

export function setFixtureMode(mode: FixtureMode) {
  fixtureMode = mode;
  cycleIndex = 0;
}

async function runFixture(req: RunRequest): Promise<RunResult> {
  const key = fixtureMode === "cycle" ? CYCLE[cycleIndex++ % CYCLE.length] : fixtureMode;
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
