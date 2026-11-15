// Dev-only regression check (not shipped): Finish with an unrun draft.
//
// Scenario from the handoff: the student runs v3 and scores 2/4, then keeps
// editing to v4 and presses Finish without running again. The report must
// retain the v4 draft AND keep the score attributed to v3. It must never
// present 2/4 as v4's result, and it must never let the model cite a v4 run
// that does not exist.
//
// The fix this guards lives in two places:
//   - components/ProblemRoom.tsx  codingSession() appends the unrun draft
//     snapshot (that part is React and is covered by the browser drivers).
//   - app/api/report/route.ts     buildPrompt() labels a snapshot with no
//     matching Run as an unrun draft; buildValidators() keeps it citable as
//     code but not as a run. That is what this check exercises, headlessly.
//
// @google/genai is stubbed, so no key, network, or model call happens.
//
// Run: node --experimental-strip-types dev/unrun-draft-check.mjs

import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
globalThis.__GEN__ = { mode: "ok", text: "", calls: [] };
globalThis.__TOK__ = { mode: "ok", calls: 0 };

const STUB = `
export const Type = { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING", INTEGER: "INTEGER" };
export const Modality = { AUDIO: "AUDIO" };
export const EndSensitivity = { END_SENSITIVITY_LOW: "END_SENSITIVITY_LOW" };
export class GoogleGenAI {
  constructor(opts) {
    this.models = { generateContent: async (req) => {
      const g = globalThis.__GEN__;
      g.calls.push({ contents: req.contents });
      return { text: g.text };
    } };
    this.authTokens = { create: async () => ({ name: "auth_tokens/stub" }) };
  }
}
`;

const dir = mkdtempSync(join(tmpdir(), "unrun-draft-check-"));
const stubPath = join(dir, "genai-stub.mjs");
writeFileSync(stubPath, STUB);

const out = await build({
  entryPoints: [join(ROOT, "app", "api", "report", "route.ts")],
  bundle: true, format: "esm", platform: "node", write: false,
  alias: { "@google/genai": stubPath }, logLevel: "error",
});
const modPath = join(dir, "report.mjs");
writeFileSync(modPath, out.outputFiles[0].text);

process.env.GEMINI_API_KEY = "stub-key-NOT-REAL";
process.env.REPORT_MODEL = "stub-report-model";
const report = await import(pathToFileURL(modPath).href);

let fails = 0;
const assert = (label, cond, extra) => {
  if (!cond) fails += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || extra === undefined ? "" : `  (${extra})`}`);
};

const t0 = "2026-11-15T02:00:00Z";
const at = (s) => new Date(Date.parse(t0) + s * 1000).toISOString();

// v3: returns False whenever the list is long -> 2 of 4 cases pass.
const V3 = [
  "def contains_duplicate(nums):",
  "    if len(nums) > 2:",
  "        return False",
  "    return len(set(nums)) != len(nums)",
].join("\n");
// v4: the unrun draft. The marker string below is unique to v4.
const V4 = [
  "def contains_duplicate(nums):",
  "    seen = set()",
  "    for n in nums:  # SENTINEL_V4_DRAFT_ONLY",
  "        if n in seen:",
  "            return True",
  "        seen.add(n)",
  "    return False",
].join("\n");

const CASES = [
  { caseId: "c1", input: "nums = [1,2,3,1]", expected: "True", actual: "False", pass: false },
  { caseId: "c2", input: "nums = [1,2,3]", expected: "False", actual: "False", pass: true },
  { caseId: "c3", input: "nums = [1,1]", expected: "True", actual: "True", pass: true },
  { caseId: "c4", input: "nums = [1,2,3,4,1]", expected: "True", actual: "False", pass: false },
];

const runV3 = {
  sessionId: "s1", problemId: "contains-duplicate", codeVersion: 3,
  ranAt: at(60), durationMs: 25, status: "completed",
  cases: CASES, passed: 2, total: 4,
};

// What ProblemRoom sends at Finish once the draft is preserved: both snapshots,
// one Run (v3).
const session = (extra = {}) => ({
  sessionId: "s1", attemptId: "a1", problemId: "contains-duplicate",
  turns: [
    { id: "t1", speaker: "interviewer", text: "Walk me through your approach.", at: at(0) },
    { id: "t2", speaker: "student", text: "I short-circuit long lists, then compare set length.", at: at(20) },
    { id: "t3", speaker: "student", text: "Two of the cases failed, so I rewrote it with a set.", at: at(90) },
  ],
  snapshots: [
    { codeVersion: 3, source: V3, at: at(55) },
    { codeVersion: 4, source: V4, at: at(100) },
  ],
  runs: [runV3],
  ...extra,
});

const post = async (body) => {
  const res = await report.POST(new Request("http://x/api/report", { method: "POST", body: JSON.stringify(body) }));
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json };
};

const model = (obj) => {
  globalThis.__GEN__.mode = "ok";
  globalThis.__GEN__.text = JSON.stringify(obj);
  globalThis.__GEN__.calls.length = 0;
};

const promptOf = () => {
  const call = globalThis.__GEN__.calls.at(-1);
  return typeof call?.contents === "string" ? call.contents : JSON.stringify(call?.contents);
};

// A finding set that cites the v4 draft as code (legitimate) and also tries to
// cite a v4 *run* (does not exist) plus the real v3 run.
const FINDINGS = {
  findings: [
    {
      category: "approach",
      rating: "needs_work",
      summary: "The length short-circuit in v3 is what failed c1 and c4.",
      evidence: [{ kind: "code", codeVersion: 3, lineStart: 2, lineEnd: 3 }, { kind: "run", codeVersion: 3, caseId: "c1" }],
    },
    {
      category: "approach",
      rating: "strong",
      summary: "The v4 draft replaces it with a set pass.",
      evidence: [
        { kind: "code", codeVersion: 4, lineStart: 2, lineEnd: 6 },
        { kind: "run", codeVersion: 4 },
      ],
    },
  ],
  nextStep: "Run the v4 draft before you finish.",
};

console.log("== A. The prompt keeps the draft and the score apart");

model(FINDINGS);
const a = await post({ session: session() });
assert("A0 report returns 200", a.status === 200, `status ${a.status}`);
const p = promptOf();

assert(
  "A1 v4 is labelled an unrun draft",
  p.includes("codeVersion 4 (unrun draft; no test results for this version)"),
);
assert(
  "A2 v3 is NOT labelled a draft (it was tested)",
  p.includes("codeVersion 3 @") && !p.includes("codeVersion 3 (unrun draft"),
);
assert("A3 the v4 source is retained in the prompt", p.includes("SENTINEL_V4_DRAFT_ONLY"));
assert("A4 the v3 score is stated on v3", p.includes("codeVersion 3 ran @") && p.includes("completed 2/4 passed"));
assert("A5 no run is attributed to v4", !p.includes("codeVersion 4 ran"));
assert(
  "A6 exactly one run line in the Runs section",
  (p.match(/codeVersion \d+ ran @/g) || []).length === 1,
  `found ${(p.match(/codeVersion \d+ ran @/g) || []).length}`,
);
assert("A7 the failing cases stay on v3", p.includes("c1: FAIL") && p.includes("c4: FAIL"));

console.log("\n== B. Evidence validation: draft citable as code, never as a run");

const refs = (a.json?.findings ?? []).flatMap((f) => f.evidence ?? []);
const has = (ref) => refs.some((r) => JSON.stringify(r) === JSON.stringify(ref));

assert("B1 a code citation of the v4 draft survives", has({ kind: "code", codeVersion: 4, lineStart: 2, lineEnd: 6 }));
assert("B2 a run citation of v4 is dropped", !refs.some((r) => r.kind === "run" && r.codeVersion === 4));
assert("B3 the real v3 run citation survives", has({ kind: "run", codeVersion: 3, caseId: "c1" }));
assert("B4 both findings are kept", (a.json?.findings ?? []).length === 2, `${(a.json?.findings ?? []).length}`);

console.log("\n== C. No false draft marker when the version was run");

model(FINDINGS);
const runV4 = { ...runV3, codeVersion: 4, ranAt: at(130), cases: CASES.map((c) => ({ ...c, pass: true, actual: c.expected })), passed: 4, total: 4 };
await post({ session: session({ runs: [runV3, runV4] }) });
const p2 = promptOf();
assert("C1 v4 loses the draft marker once it has a Run", !p2.includes("codeVersion 4 (unrun draft"));
assert("C2 both runs are listed", (p2.match(/codeVersion \d+ ran @/g) || []).length === 2);
assert("C3 v4's own score is 4/4", p2.includes("completed 4/4 passed"));

console.log("\n== D. An edit with no Runs at all");

model(FINDINGS);
const d = await post({ session: session({ runs: [], snapshots: [{ codeVersion: 4, source: V4, at: at(100) }] }) });
const p3 = promptOf();
assert("D1 the lone draft is still sent", p3.includes("SENTINEL_V4_DRAFT_ONLY"));
assert("D2 it is labelled unrun", p3.includes("codeVersion 4 (unrun draft; no test results for this version)"));
assert("D3 the Runs section says none", p3.includes("=== Runs (cite with kind:run, codeVersion, optional caseId) ===\n(none)"));
assert("D4 no run citation survives", !(d.json?.findings ?? []).flatMap((f) => f.evidence ?? []).some((r) => r.kind === "run"));

console.log(`\n${fails === 0 ? "unrun-draft-check: all checks passed" : `unrun-draft-check: ${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
