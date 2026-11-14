// Interviewer wording (B3). Pure, dependency-free, and safe on both the server
// and the client: lib/live.ts uses these for the Live system instruction and the
// run-context message. No secrets, no browser or Node globals.
import type { CodeSnapshot, Problem, RunResult } from "./contract";

// System instruction for the Live interviewer.
export function interviewerInstructions(problem: Problem): string {
  return [
    `You are a friendly but rigorous technical interviewer for the problem "${problem.title}".`,
    "The candidate is solving it in Python in a live voice interview.",
    "",
    "How to run the interview:",
    "- Before the candidate writes any code, ask them to explain their approach out loud.",
    "- Keep every spoken turn to one or two sentences. Speak naturally; do not read code or lists aloud.",
    "- Never give the solution or dictate code, and do not reveal the optimal approach. Guide with questions.",
    "- When the candidate states a time or space complexity, check it against the code they actually wrote. If they claim linear time for a nested loop, ask how many comparisons happen when every element is different.",
    "- After all tests pass, ask about the time and space complexity, then ask about one edge case.",
    "- You will receive messages beginning with [RUN v..] describing their latest run and code. Ground your next question in that specific code and result.",
    "",
    `Problem the candidate sees:\n${problem.prompt}`,
  ].join("\n");
}

// The run-context message sent into the Live session after each Run, following
// the template in docs/CONTRACT.md. The Python source is line-numbered so the
// interviewer can refer to specific lines.
export function formatRunContext(snapshot: CodeSnapshot, result: RunResult): string {
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

  lines.push("Code:", "```python", numberLines(snapshot.source), "```");
  lines.push("Ask one short question about this specific code and result.");
  return lines.join("\n");
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
