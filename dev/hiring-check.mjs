// Dev-only check for the strict hiring recommendation (not shipped): the caps
// in lib/hiring.ts, and that /api/report attaches a capped assessment for both
// rounds. Bundles the real route with @google/genai stubbed: no key, no network.
//
// Run: node dev/hiring-check.mjs

import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
globalThis.__GEN__ = { text: "", calls: [] };
const STUB = `
export const Type = { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING", INTEGER: "INTEGER" };
export const Modality = { AUDIO: "AUDIO" };
export class GoogleGenAI {
  constructor() { this.models = { generateContent: async (req) => { globalThis.__GEN__.calls.push(req); return { text: globalThis.__GEN__.text }; } }; }
}
`;
const dir = mkdtempSync(join(tmpdir(), "hiring-check-"));
const stubPath = join(dir, "genai-stub.mjs");
writeFileSync(stubPath, STUB);
async function load(entry, name) {
  const out = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, alias: { "@google/genai": stubPath }, logLevel: "error" });
  const p = join(dir, name);
  writeFileSync(p, out.outputFiles[0].text);
  return import(pathToFileURL(p).href);
}
process.env.GEMINI_API_KEY = "stub-key";
process.env.REPORT_MODEL = "stub-model";
const hiring = await load(join(ROOT, "lib", "hiring.ts"), "hiring.mjs");
const route = await load(join(ROOT, "app", "api", "report", "route.ts"), "report.mjs");

let fails = 0;
const assert = (label, cond, extra) => { if (!cond) fails += 1; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || extra === undefined ? "" : `  (${extra})`}`); };
const f = (category, rating) => ({ id: category, category, rating, summary: "s", evidence: [] });
const run = (passed, total = 4, v = 1) => ({ sessionId: "s", problemId: "contains-duplicate", codeVersion: v, ranAt: "2026-11-19T00:00:00Z", durationMs: 5, status: "completed", cases: [], passed, total });
const allStrong = ["correctness", "approach", "complexity", "testing", "clarification"].map((c) => f(c, "strong"));

console.log("== A. Coding caps");
{
  let c = hiring.codingCap(allStrong, [run(4)], false);
  assert("A1 all strong + passing final run -> strong_hire allowed, no reasons", c.max === "strong_hire" && c.reasons.length === 0, JSON.stringify(c));
  c = hiring.codingCap(allStrong, [], false);
  assert("A2 never run -> strong_no_hire", c.max === "strong_no_hire" && /never run/.test(c.reasons[0]));
  c = hiring.codingCap(allStrong, [run(3)], false);
  assert("A3 final run fails a case -> at most lean_no_hire", c.max === "lean_no_hire" && /failed 1 of 4/.test(c.reasons.join(" ")));
  c = hiring.codingCap(allStrong, [run(0)], false);
  assert("A4 final run fails every case -> strong_no_hire", c.max === "strong_no_hire");
  c = hiring.codingCap(allStrong, [{ ...run(0), status: "error", error: { code: "syntax_error", message: "x", retryable: false } }], false);
  assert("A5 final run is an error -> strong_no_hire", c.max === "strong_no_hire" && /syntax error/.test(c.reasons[0]));
  c = hiring.codingCap(allStrong.map((x) => (x.category === "complexity" ? f("complexity", "needs_work") : x)), [run(4)], false);
  assert("A6 needs_work on a core signal -> lean_no_hire", c.max === "lean_no_hire" && /complexity/.test(c.reasons[0]));
  c = hiring.codingCap(allStrong.map((x) => (x.category === "approach" ? f("approach", "ok") : x)), [run(4)], false);
  assert("A7 a core signal only ok -> at most lean_hire", c.max === "lean_hire");
  c = hiring.codingCap(allStrong.filter((x) => x.category !== "complexity"), [run(4)], false);
  assert("A8 no signal on complexity -> at most lean_hire", c.max === "lean_hire" && /No clear signal on complexity/.test(c.reasons[0]));
  c = hiring.codingCap(allStrong.map((x) => (x.category === "testing" ? f("testing", "needs_work") : x)), [run(4)], false);
  assert("A9 needs_work on a non-core signal -> at most lean_hire", c.max === "lean_hire");
  c = hiring.codingCap(allStrong.filter((x) => x.category !== "correctness"), [run(4)], false);
  assert("A11 evaluator silent on correctness but the final run passed every case -> no correctness cap", c.max === "strong_hire" && !c.reasons.some((r) => /correctness/.test(r)), JSON.stringify(c));
  c = hiring.codingCap(allStrong.filter((x) => x.category !== "correctness"), [run(4)], true);
  assert("A12 ...but not when the final code was never re-tested", /correctness/.test(c.reasons.join(" ")));
  c = hiring.codingCap(allStrong, [run(4)], true);
  assert("A10 final code edited after its last run -> at most lean_hire", c.max === "lean_hire" && /never re-tested/.test(c.reasons[0]));
}

console.log("== B. Behavioral caps");
{
  const four = (r) => ["specificity", "personal_contribution", "reasoning", "outcome"].map((c) => f(c, r));
  assert("B1 four strong -> strong_hire allowed", hiring.behavioralCap(four("strong")).max === "strong_hire");
  assert("B2 personal contribution needs work -> lean_no_hire", hiring.behavioralCap(four("strong").map((x) => (x.category === "personal_contribution" ? f(x.category, "needs_work") : x))).max === "lean_no_hire");
  assert("B3 reasoning needs work -> at most lean_hire", hiring.behavioralCap(four("strong").map((x) => (x.category === "reasoning" ? f(x.category, "needs_work") : x))).max === "lean_hire");
  assert("B4 only two strong -> at most lean_hire", hiring.behavioralCap([f("specificity", "strong"), f("personal_contribution", "strong"), f("reasoning", "ok"), f("outcome", "ok")]).max === "lean_hire");
  assert("B5 nothing assessable -> lean_no_hire (no signal reads as no hire)", hiring.behavioralCap(four("insufficient_evidence")).max === "lean_no_hire");
}

console.log("== C. Helpers");
assert("C1 lower picks the worse", hiring.lower("strong_hire", "lean_no_hire") === "lean_no_hire" && hiring.lower("strong_no_hire", "lean_hire") === "strong_no_hire");
assert("C2 every level has a label and meaning", ["strong_no_hire", "lean_no_hire", "lean_hire", "strong_hire"].every((r) => hiring.RECOMMENDATION_LABEL[r] && hiring.RECOMMENDATION_MEANING[r]));

console.log("== D. Route: coding report");
const post = async (session) => {
  const res = await route.POST(new Request("http://x/api/report", { method: "POST", body: JSON.stringify({ session }) }));
  return { status: res.status, json: await res.json() };
};
const SET = "def contains_duplicate(nums):\n    seen = set()\n    for n in nums:\n        if n in seen:\n            return True\n        seen.add(n)\n    return False";
const t = (s) => new Date(Date.parse("2026-11-19T01:00:00Z") + s * 1000).toISOString();
const coding = (runs) => ({
  sessionId: "s1", attemptId: "a1", problemId: "contains-duplicate",
  turns: [{ id: "t1", speaker: "interviewer", text: "Approach?", at: t(0) }, { id: "t2", speaker: "student", text: "A set, O(n) time and O(n) space.", at: t(5) }],
  snapshots: [{ codeVersion: 2, source: SET, at: t(30) }],
  runs,
});
const caseList = (passAll) => ["c1", "c2", "c3", "c4"].map((id) => ({ caseId: id, input: "nums = [1]", expected: "True", actual: passAll ? "True" : "False", pass: passAll }));
const runV2 = (passAll) => ({ sessionId: "s1", problemId: "contains-duplicate", codeVersion: 2, ranAt: t(31), durationMs: 5, status: "completed", cases: caseList(passAll), passed: passAll ? 4 : 0, total: 4 });
const strongModel = {
  findings: ["correctness", "approach", "complexity"].map((category) => ({ category, rating: "strong", summary: "Solid.", evidence: [{ kind: "code", codeVersion: 2 }] })),
  nextStep: "Practice stating complexity earlier.",
  assessment: { recommendation: "strong_hire", summary: "Clear, independent solution.", strengths: ["Set-based O(n)"], concerns: [], toRaise: "Nothing." },
};
{
  globalThis.__GEN__.text = JSON.stringify(strongModel);
  let r = await post(coding([runV2(true)]));
  const sys = globalThis.__GEN__.calls.at(-1).config.systemInstruction;
  assert("D1 evaluator is told the competitive bar and to pick the lower rating when unsure", /most candidates are rejected/.test(sys) && /choose the LOWER one/.test(sys) && /at most ok/.test(sys));
  assert("D2 schema requires the assessment", JSON.stringify(globalThis.__GEN__.calls.at(-1).config.responseSchema.required).includes("assessment"));
  assert("D3 a deserved strong_hire is kept, with no caps", r.status === 200 && r.json.assessment?.recommendation === "strong_hire" && r.json.assessment.caps.length === 0 && !r.json.assessment.proposed, JSON.stringify(r.json.assessment));
  r = await post(coding([runV2(false)]));
  assert("D4 the model says strong_hire but every test failed -> strong_no_hire, proposal kept for transparency", r.json.assessment?.recommendation === "strong_no_hire" && r.json.assessment.proposed === "strong_hire" && /failed 4 of 4/.test(r.json.assessment.caps.join(" ")), JSON.stringify(r.json.assessment));
  globalThis.__GEN__.text = JSON.stringify({ ...strongModel, assessment: { recommendation: "amazing_hire" } });
  r = await post(coding([runV2(true)]));
  assert("D5 a malformed vote never yields strong_hire", r.json.assessment?.recommendation === "lean_hire" && !r.json.assessment.proposed, JSON.stringify(r.json.assessment));
  globalThis.__GEN__.text = JSON.stringify({ ...strongModel, assessment: { ...strongModel.assessment, strengths: ["a", "b", "c", "d", "e"], concerns: "not a list" } });
  r = await post(coding([runV2(true)]));
  assert("D6 lists are bounded to three; a bad list becomes empty", r.json.assessment.strengths.length === 3 && Array.isArray(r.json.assessment.concerns));
}

console.log("== E. Route: behavioral report");
{
  const words = "I personally profiled the checkout service, found an N plus one query, rewrote it as a join, and p95 latency dropped from four seconds to two hundred milliseconds which we confirmed on our dashboard.";
  const session = { sessionId: "s2", attemptId: "a2", roundType: "behavioral", turns: [{ id: "t1", speaker: "interviewer", text: "Tell me about a time...", at: t(0) }, { id: "t2", speaker: "student", text: `${words} ${words}`, at: t(10) }] };
  globalThis.__GEN__.text = JSON.stringify({
    findings: [
      { category: "specificity", rating: "strong", summary: "Concrete.", evidence: [{ kind: "turn", turnId: "t2" }] },
      { category: "personal_contribution", rating: "needs_work", summary: "Mostly we.", evidence: [{ kind: "turn", turnId: "t2" }] },
    ],
    nextStep: "Say what you did.",
    assessment: { recommendation: "lean_hire", summary: "Good detail.", strengths: [], concerns: ["Ownership unclear"], toRaise: "Say I." },
  });
  let r = await post(session);
  const sys = globalThis.__GEN__.calls.at(-1).config.systemInstruction;
  assert("E1 behavioral evaluator has the bar and the category standards", /most candidates are rejected/.test(sys) && /mostly 'we'/.test(sys));
  assert("E2 personal contribution needs work -> capped to lean_no_hire", r.json.assessment?.recommendation === "lean_no_hire" && r.json.assessment.proposed === "lean_hire", JSON.stringify(r.json.assessment));
  r = await post({ ...session, turns: session.turns.slice(0, 1) });
  assert("E3 no answer captured -> deterministic lean_no_hire, no model call needed", r.status === 200 && r.json.assessment?.recommendation === "lean_no_hire" && r.json.assessment.summary.length > 0);
}

console.log("== F. Candidate's question time is not graded");
{
  const story = "I personally profiled the checkout service, found an N plus one query, rewrote it as a join, and p95 latency dropped from four seconds to two hundred milliseconds which we confirmed on our dashboard.";
  const session = { sessionId: "s4", attemptId: "a4", roundType: "behavioral", turns: [
    { id: "t1", speaker: "interviewer", text: "Tell me about a time you fixed a slow system.", at: t(0) },
    { id: "t2", speaker: "student", text: `${story} ${story}`, at: t(10) },
    { id: "t3", speaker: "interviewer", text: "Thanks. We're at time. Do you have any questions for me?", at: t(20) },
    { id: "t4", speaker: "student", text: "QUESTION-TIME what does a typical day look like for you?", at: t(25) },
    { id: "t5", speaker: "interviewer", text: "Mostly coding and reviews. That's all for today.", at: t(30) },
  ] };
  globalThis.__GEN__.text = JSON.stringify({
    findings: [
      { category: "specificity", rating: "strong", summary: "Concrete.", evidence: [{ kind: "turn", turnId: "t2" }] },
      { category: "reasoning", rating: "needs_work", summary: "Asked a vague question.", evidence: [{ kind: "turn", turnId: "t4" }] },
    ],
    nextStep: "x",
    assessment: { recommendation: "lean_hire", summary: "s", strengths: [], concerns: [], toRaise: "t" },
  });
  const r = await post(session);
  const prompt = globalThis.__GEN__.calls.at(-1).contents;
  assert("F1 the evaluator sees the questions under a 'not evidence' header, without citable IDs", /questions for the interviewer at the end \(context only: NOT evidence/.test(prompt) && prompt.includes("QUESTION-TIME") && !/t4 \(candidate\)/.test(prompt), prompt.slice(-300));
  const f = r.json.findings.find((x) => x.category === "reasoning");
  assert("F2 a finding that cites a question-time turn loses that evidence", f && f.rating === "insufficient_evidence" && f.evidence.length === 0, JSON.stringify(f));
  const coding = { sessionId: "s5", attemptId: "a5", problemId: "contains-duplicate",
    turns: [{ id: "t1", speaker: "interviewer", text: "Any questions for me?", at: t(0) }, { id: "t2", speaker: "student", text: "QUESTION-TIME how big is the team?", at: t(5) }],
    snapshots: [{ codeVersion: 2, source: SET, at: t(30) }], runs: [runV2(true)] };
  globalThis.__GEN__.text = JSON.stringify({ ...strongModel, findings: [{ category: "spoken_reasoning", rating: "strong", summary: "x", evidence: [{ kind: "turn", turnId: "t2" }] }, ...strongModel.findings] });
  const rc = await post(coding);
  const sr = rc.json.findings.find((x) => x.category === "spoken_reasoning");
  assert("F3 coding report: question-time turns are not citable either", sr && sr.evidence.length === 0 && !/t2 \(student\)/.test(globalThis.__GEN__.calls.at(-1).contents), JSON.stringify(sr));
}

console.log(fails ? `\n${fails} HIRING CHECK(S) FAILED` : "\nALL HIRING CHECKS PASSED");
process.exit(fails ? 1 : 0);
