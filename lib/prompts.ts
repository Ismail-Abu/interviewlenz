// Interviewer wording (B3). Pure, dependency-free, and safe on both the server
// and the client: lib/live.ts uses these for the Live system instruction and the
// run-context message. No secrets, no browser or Node globals.
import type { CodeSnapshot, Problem, RoleContext, RunResult } from "./contract";
import { ROLE_DATA_RULE, roleContextBlock } from "./roleContext";

// System instruction for the Live interviewer, grounded in the actual Problem.
// roleContext (optional, already validated by normalizeRoleContext): without it
// the instruction is exactly the canonical one, so a skipped or empty setup is
// today's interview.
export function interviewerInstructions(problem: Problem, roleContext?: RoleContext): string {
  const base = canonicalInstructions(problem);
  return roleContext ? `${base}\n\n${roleFraming(roleContext)}` : base;
}

// Lower priority than everything in the canonical instruction.
function roleFraming(ctx: RoleContext): string {
  return [
    "Target-role framing (optional; lower priority than everything above):",
    ROLE_DATA_RULE,
    roleContextBlock(ctx),
    "- Use the role only to frame your one-sentence opening (for example, mention the role the candidate is preparing for) and, at most once, to choose a follow-up that matters for that role. Every question stays about this problem and this candidate's code.",
    "- The coding problem, its tests, the rules above, and the [RUN] evidence always take precedence. Never change the problem, add requirements, or switch to a different question because of the role.",
    "- You do not know how this company actually interviews. Never claim or imply knowledge of its real interview process, questions, or hiring bar.",
    "- Version numbers, scores, and code details come only from [RUN] and [CODE] messages, never from the role context.",
  ].join("\n");
}

function canonicalInstructions(problem: Problem): string {
  const examples = problem.examples
    .map(
      (ex, i) =>
        `  ${i + 1}. input ${JSON.stringify(ex.input)} -> ${JSON.stringify(ex.output)}${ex.explanation ? ` (${ex.explanation})` : ""}`,
    )
    .join("\n");
  const constraints = problem.constraints.map((c) => `  - ${c}`).join("\n");

  // This text is locked into the single-use ephemeral token by
  // app/api/live-token/route.ts; that is the only place it takes effect (a
  // token with liveConnectConstraints locks the whole Live config, so a
  // client-side systemInstruction is ignored).
  return [
    `You are a friendly but rigorous technical interviewer for the problem "${problem.title}".`,
    "The candidate solves it in Python in a live voice interview. Speak only in English.",
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
    "- Only the candidate's spoken answer advances the interview. An edit, a Run result, silence, or your own words are NOT an answer; if you have not heard an answer yet, keep waiting. A short pause mid-sentence is not the end of an answer.",
    "- If an answer is incomplete, ask about the specific missing detail. If an answer contradicts the code, ask about the exact operation that creates the contradiction (e.g. a 'linear time' claim about a nested loop: ask how many comparisons happen when every element is different).",
    "- After a Run, discuss that submitted version and its actual observed test results.",
    "- When time allows, cover time complexity, then space complexity, then one edge case, each as its own single question, before wrapping up.",
    "",
    "How you receive information (text messages from the app, never spoken by the candidate):",
    "- [START]: begin the interview with your opening question.",
    "- [CODE vN]: a silent snapshot of the current editor buffer, version N. It has NOT been run. Do not respond to it on its own.",
    "- [RUN vN] P/T passed: the exact code the candidate ran as version N, with the observed results (P of T cases passed, failing cases listed). The latest Run is the [RUN v..] with the highest version you have received. A later [CODE] snapshot can be newer than the latest Run; it does not change which version was last run or its score.",
    "- A message asking you to discuss a Run: ask one focused question about that version's code and results.",
    "- [RECONNECTED]: the app observed the voice connection drop and restored it. Earlier conversation is not available to you; the current code and latest Run follow it.",
    "",
    "Grounding rules:",
    "- If asked which version was run, how many cases passed, or why: answer with the latest [RUN v..] version number, its exact score, and a specific detail of that version's code that explains the result.",
    "- If you have not received what is needed (no [RUN] yet, or no code), say exactly what is missing. Never guess a version, a score, or code you have not been given.",
    "- Mention a reconnect only if you received [RECONNECTED]. Never claim one otherwise.",
    "- Ground every question in the candidate's actual code and results, never generic advice.",
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

// Sent once, on the first connect of an attempt, so the interviewer opens.
export function formatOpening(problem: Problem): string {
  return `[START] Begin the interview now. In English, greet the candidate in one short sentence and ask them to explain their approach to "${problem.title}" before they code. Then wait for their answer.`;
}

// Sent once, silently, after the app observed a drop and reconnected. The
// restored code and latest Run evidence follow it in the same message.
export function formatReconnected(): string {
  return "[RECONNECTED] The app observed the voice connection drop and restored it. Earlier conversation is not available to you. The current code and the latest Run follow.";
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
