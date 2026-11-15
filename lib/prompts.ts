// Interviewer wording (B3). Pure, dependency-free, and safe on both the server
// and the client: lib/live.ts uses these for the Live system instruction and the
// run-context message. No secrets, no browser or Node globals.
import type { CodeSnapshot, Problem, RunResult } from "./contract";

// System instruction for the Live interviewer, grounded in the actual Problem.
export function interviewerInstructions(problem: Problem): string {
  const examples = problem.examples
    .map(
      (ex, i) =>
        `  ${i + 1}. input ${JSON.stringify(ex.input)} -> ${JSON.stringify(ex.output)}${ex.explanation ? ` (${ex.explanation})` : ""}`,
    )
    .join("\n");
  const constraints = problem.constraints.map((c) => `  - ${c}`).join("\n");

  return [
    `You are a friendly but rigorous technical interviewer for the problem "${problem.title}".`,
    "The candidate solves it in Python in a live voice interview.",
    "",
    "The problem:",
    problem.prompt,
    `The candidate must implement the function \`${problem.functionName}\`.`,
    examples ? `Worked examples (the expected behavior):\n${examples}` : "",
    constraints ? `Constraints:\n${constraints}` : "",
    "",
    "Run the interview as ONE focused question at a time, then WAIT for the candidate's spoken answer before asking anything else:",
    "- Start by asking the candidate to explain their approach, before they write code.",
    "- Keep every spoken turn to one or two sentences. Never give the solution or dictate code.",
    "- Ask exactly one question, then stop and wait. Do not stack or repeat questions.",
    "- Only the candidate's spoken answer advances the interview. An edit, a Run result, silence, or your own words are NOT an answer; if you have not heard an answer yet, keep waiting.",
    "- If an answer is incomplete, ask about the specific missing detail. If an answer contradicts the code, ask about the exact operation that creates the contradiction (e.g. a 'linear time' claim about a nested loop: ask how many comparisons happen when every element is different).",
    "- After a Run, discuss that submitted version and its actual test results (sent to you as a [RUN v..] message with the code and results).",
    "- End the interview with time complexity, then space complexity, then one edge case, each as its own single question, one at a time.",
    "",
    "You also receive [CODE v..] context updates (the current buffer). Ground every question in the candidate's actual code and results, never generic advice.",
  ]
    .filter(Boolean)
    .join("\n");
}

// Completed-Run evidence: version, score, failing cases, and line-numbered
// source kept together in one message, following docs/CONTRACT.md. Sent as
// silent context (no question) so the model's run state is always accurate,
// independent of whether a spoken follow-up is requested. `currentBufferVersion`
// lets a run that has been edited past be labeled historical.
export function formatRunEvidence(
  snapshot: CodeSnapshot,
  result: RunResult,
  currentBufferVersion: number = result.codeVersion,
): string {
  const lines: string[] = [];

  if (result.status === "completed") {
    lines.push(`[RUN v${result.codeVersion}] ${result.passed}/${result.total} passed.`);
    for (const c of result.cases) {
      if (!c.pass) {
        lines.push(
          `Failed: ${c.caseId} input ${c.input} expected ${c.expected} got ${c.actual ?? c.error ?? "error"}`,
        );
      }
    }
  } else {
    const where = result.error.line ? ` (line ${result.error.line})` : "";
    lines.push(`[RUN v${result.codeVersion}] error ${result.error.code}${where}: ${result.error.message}`);
  }

  if (result.codeVersion < currentBufferVersion) {
    lines.push(
      `(These results are from version ${result.codeVersion}; the current buffer is version ${currentBufferVersion}.)`,
    );
  }

  lines.push("Code:", "```python", numberLines(snapshot.source), "```");
  return lines.join("\n");
}

// A spoken-follow-up request about the most recent completed Run. Kept separate
// from the evidence above and restating the version and score, so the
// interviewer grounds its one question in THIS run rather than an earlier one.
export function formatRunFollowup(
  result: RunResult,
  currentBufferVersion: number = result.codeVersion,
): string {
  const v = result.codeVersion;
  const outcome =
    result.status === "completed"
      ? `passed ${result.passed}/${result.total}`
      : `failed (${result.error.code}${result.error.line ? ` on line ${result.error.line}` : ""})`;
  const buffer = v < currentBufferVersion ? ` The current buffer is version ${currentBufferVersion}.` : "";
  return `[RUN v${v}] The most recent run is version ${v}, which ${outcome}.${buffer} Discuss this version and ask one focused question grounded in its code and results.`;
}

// A silent code-context update: makes the current working buffer available to
// the model without asking anything. The source is line-numbered.
export function formatCodeContext(snapshot: CodeSnapshot): string {
  return [
    `[CODE v${snapshot.codeVersion}] current working buffer (not run yet):`,
    "```python",
    numberLines(snapshot.source),
    "```",
  ].join("\n");
}

function numberLines(source: string): string {
  const rows = source.split("\n");
  const width = String(rows.length).length;
  return rows.map((line, i) => `${String(i + 1).padStart(width)}  ${line}`).join("\n");
}
