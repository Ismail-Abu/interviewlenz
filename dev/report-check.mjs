// Dev-only check for the public report and token routes (not shipped).
// Bundles the real routes with @google/genai stubbed: no key, no network.
// Covers request validation and size limits, model-output validation (invented
// evidence, malformed nested output), a missing transcript, provider failure,
// timeout, grounding prompt content, and that no provider detail or key leaks.
//
// Run: node --experimental-strip-types dev/report-check.mjs

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
    this.opts = opts;
    this.models = { generateContent: async (req) => {
      const g = globalThis.__GEN__;
      g.calls.push({ contents: req.contents, config: req.config, httpOptions: opts.httpOptions });
      if (g.mode === "throw") throw new Error("PROVIDER-SECRET-DETAIL: quota exceeded for key AIzaFAKE");
      if (g.mode === "hang") return new Promise(() => {});
      return { text: g.text };
    } };
    this.authTokens = { create: async () => {
      const t = globalThis.__TOK__; t.calls += 1;
      if (t.mode === "throw") throw new Error("PROVIDER-SECRET-DETAIL token");
      if (t.mode === "hang") return new Promise(() => {});
      return { name: "auth_tokens/stub" };
    } };
  }
}
`;
const dir = mkdtempSync(join(tmpdir(), "report-check-"));
const stubPath = join(dir, "genai-stub.mjs");
writeFileSync(stubPath, STUB);
// Short provider timeouts for the hang cases; read when the routes load.
process.env.REPORT_TIMEOUT_MS = "300";
process.env.LIVE_TOKEN_TIMEOUT_MS = "300";
async function load(entry, name) {
  const out = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, alias: { "@google/genai": stubPath }, logLevel: "error" });
  const p = join(dir, name);
  writeFileSync(p, out.outputFiles[0].text);
  return import(pathToFileURL(p).href);
}
const report = await load(join(ROOT, "app", "api", "report", "route.ts"), "report.mjs");
const token = await load(join(ROOT, "app", "api", "live-token", "route.ts"), "token.mjs");

let fails = 0;
const assert = (label, cond, extra) => { if (!cond) fails += 1; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || extra === undefined ? "" : `  (${extra})`}`); };
const post = async (mod, body, raw) => {
  const res = await mod.POST(new Request("http://x/api", { method: "POST", body: raw ?? JSON.stringify(body) }));
  let json = null; const text = await res.text();
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
};
const t0 = "2026-11-15T01:00:00Z";
const at = (s) => new Date(Date.parse(t0) + s * 1000).toISOString();

// A realistic attempt: claims nested loops are linear (t2), runs nested v2 4/4,
// then switches to a set (v5 4/4) and explains it (t4).
const NESTED = "def contains_duplicate(nums):\n    for i in range(len(nums)):\n        for j in range(i + 1, len(nums)):\n            if nums[i] == nums[j]:\n                return True\n    return False";
const SET = "def contains_duplicate(nums):\n    seen = set()\n    for n in nums:\n        if n in seen:\n            return True\n        seen.add(n)\n    return False";
const cases = (passAll) => ["c1", "c2", "c3", "c4"].map((id, i) => ({ caseId: id, input: `nums = [${i}]`, expected: "True", actual: "True", pass: passAll }));
const session = () => ({
  sessionId: "s1", attemptId: "a1", problemId: "contains-duplicate",
  turns: [
    { id: "t1", speaker: "interviewer", text: "Walk me through your approach.", at: at(0) },
    { id: "t2", speaker: "student", text: "I'll compare every pair with two loops. That's linear.", at: at(10) },
    { id: "t3", speaker: "interviewer", text: "How many comparisons when all elements differ?", at: at(60) },
    { id: "t4", speaker: "student", text: "Oh, that's n squared. A set checks each number once, so it's O(n).", at: at(90) },
  ],
  snapshots: [{ codeVersion: 2, source: NESTED, at: at(50) }, { codeVersion: 5, source: SET, at: at(120) }],
  runs: [
    { sessionId: "s1", problemId: "contains-duplicate", codeVersion: 2, ranAt: at(51), durationMs: 20, status: "completed", cases: cases(true), passed: 4, total: 4 },
    { sessionId: "s1", problemId: "contains-duplicate", codeVersion: 5, ranAt: at(121), durationMs: 20, status: "completed", cases: cases(true), passed: 4, total: 4 },
  ],
});
const model = (obj) => { globalThis.__GEN__.mode = "ok"; globalThis.__GEN__.text = typeof obj === "string" ? obj : JSON.stringify(obj); };
const GOOD = {
  findings: [
    { category: "spoken_reasoning", rating: "needs_work", summary: "At first you called the nested loop linear.", evidence: [{ kind: "turn", turnId: "t2" }, { kind: "code", codeVersion: 2, lineStart: 2, lineEnd: 4 }] },
    { category: "approach", rating: "strong", summary: "You switched to a set in version 5.", evidence: [{ kind: "code", codeVersion: 5, lineStart: 2, lineEnd: 6 }, { kind: "turn", turnId: "t4" }, { kind: "run", codeVersion: 5 }] },
  ],
  nextStep: "State complexity before coding.",
};

process.env.GEMINI_API_KEY = "stub-key-NOT-REAL";
process.env.REPORT_MODEL = "stub-report-model";
process.env.LIVE_MODEL = "stub-live-model";

console.log("== A. Report request validation and size limits");
{
  const calls = () => globalThis.__GEN__.calls.length;
  const before = calls();
  let r = await post(report, null, "not json");
  assert("A1 non-JSON -> 400 invalid_request", r.status === 400 && r.json?.code === "invalid_request");
  r = await post(report, { session: { sessionId: "s1" } });
  assert("A2 missing fields -> 400", r.status === 400 && r.json?.code === "invalid_request");
  r = await post(report, { session: { ...session(), problemId: "no-such-problem" } });
  assert("A3 unknown problem -> 400 unknown_problem", r.status === 400 && r.json?.code === "unknown_problem", r.text.slice(0, 120));
  r = await post(report, { session: { ...session(), turns: [{ id: "t1", speaker: "student" }] } });
  assert("A4 malformed turn element -> 400 (not a 500)", r.status === 400, `${r.status}`);
  r = await post(report, { session: { ...session(), runs: [{ codeVersion: 2, status: "completed" }] } });
  assert("A5 completed run without cases -> 400 (not a 500)", r.status === 400, `${r.status}`);
  r = await post(report, { session: { ...session(), turns: [{ id: "t1", speaker: "robot", text: "x", at: t0 }] } });
  assert("A6 unknown speaker -> 400", r.status === 400);
  r = await post(report, { session: { ...session(), snapshots: [{ codeVersion: 2, source: "x".repeat(60_000), at: t0 }] } });
  assert("A7 oversized source -> 400", r.status === 400, `${r.status}`);
  r = await post(report, null, JSON.stringify({ session: session(), pad: "y".repeat(400_000) }));
  assert("A8 oversized body -> 400", r.status === 400, `${r.status}`);
  r = await post(report, { session: { ...session(), turns: Array.from({ length: 1000 }, (_, i) => ({ id: `t${i + 1}`, speaker: "student", text: "hi", at: t0 })) } });
  assert("A9 too many turns -> 400", r.status === 400, `${r.status}`);
  assert("A10 no provider call for any invalid request", calls() === before, `${calls() - before} calls`);
}

console.log("== B. Not configured");
{
  const key = process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY;
  const r = await post(report, { session: session() });
  assert("B1 no key -> 503 provider_unavailable, not retryable", r.status === 503 && r.json?.code === "provider_unavailable" && r.json?.retryable === false, r.text);
  process.env.GEMINI_API_KEY = key;
}

console.log("== C. Valid grounded report (nested-loop claim, then set)");
{
  model(GOOD);
  const n = globalThis.__GEN__.calls.length;
  const r = await post(report, { session: session() });
  const f = r.json?.findings ?? [];
  assert("C1 200 with contract fields", r.status === 200 && r.json.sessionId === "s1" && r.json.attemptId === "a1" && typeof r.json.reportId === "string" && typeof r.json.createdAt === "string");
  assert("C2 exactly one provider call", globalThis.__GEN__.calls.length === n + 1);
  assert("C3 earlier claim cites t2 + v2 lines 2-4", JSON.stringify(f[0]?.evidence) === JSON.stringify([{ kind: "turn", turnId: "t2" }, { kind: "code", codeVersion: 2, lines: [2, 4] }]), JSON.stringify(f[0]?.evidence));
  assert("C4 later improvement cites v5, t4, run v5", JSON.stringify(f[1]?.evidence) === JSON.stringify([{ kind: "code", codeVersion: 5, lines: [2, 6] }, { kind: "turn", turnId: "t4" }, { kind: "run", codeVersion: 5 }]), JSON.stringify(f[1]?.evidence));
  const prompt = globalThis.__GEN__.calls.at(-1).contents;
  const sys = globalThis.__GEN__.calls.at(-1).config.systemInstruction;
  assert("C5 prompt carries chronology (snapshot and run timestamps)", prompt.includes(`codeVersion 2 @ ${at(50)}`) && prompt.includes(`ran @ ${at(51)}`), prompt.slice(0, 200));
  assert("C6 instruction separates an earlier claim from a later improvement", /earlier .*later/i.test(sys) && /time order|chronolog/i.test(sys));
  assert("C7 provider call has a timeout", (globalThis.__GEN__.calls.at(-1).httpOptions?.timeout ?? 0) > 0 && globalThis.__GEN__.calls.at(-1).config.abortSignal instanceof AbortSignal);
}

console.log("== D. Invented evidence");
{
  model({ findings: [
    { category: "testing", rating: "strong", summary: "Invented refs only.", evidence: [{ kind: "turn", turnId: "t99" }, { kind: "code", codeVersion: 42 }, { kind: "run", codeVersion: 9, caseId: "c1" }] },
    { category: "correctness", rating: "ok", summary: "Run exists, case does not.", evidence: [{ kind: "run", codeVersion: 5, caseId: "c9" }] },
    { category: "approach", rating: "strong", summary: "Lines beyond the snapshot.", evidence: [{ kind: "code", codeVersion: 5, lineStart: 40, lineEnd: 45 }] },
    { category: "spoken_reasoning", rating: "strong", summary: "Cites the interviewer as the student.", evidence: [{ kind: "turn", turnId: "t3" }] },
  ], nextStep: "Practice." });
  const r = await post(report, { session: session() });
  const f = r.json?.findings ?? [];
  assert("D1 all-invented finding -> insufficient_evidence, no refs", f[0]?.rating === "insufficient_evidence" && f[0]?.evidence.length === 0, JSON.stringify(f[0]));
  assert("D2 unknown caseId dropped, run ref kept", JSON.stringify(f[1]?.evidence) === JSON.stringify([{ kind: "run", codeVersion: 5 }]), JSON.stringify(f[1]?.evidence));
  assert("D3 out-of-range lines dropped (ref kept without lines)", JSON.stringify(f[2]?.evidence) === JSON.stringify([{ kind: "code", codeVersion: 5 }]), JSON.stringify(f[2]?.evidence));
  assert("D4 spoken_reasoning cannot cite an interviewer turn", f[3]?.rating === "insufficient_evidence" && f[3]?.evidence.length === 0, JSON.stringify(f[3]));
}

console.log("== E. Malformed nested output -> no invented report");
{
  const cases = [
    ["E1 invalid JSON text", "{not json"],
    ["E2 JSON null", "null"],
    ["E3 findings is an object", { findings: { a: 1 }, nextStep: "x" }],
    ["E4 every finding unusable (null, bad category, bad rating, empty summary)", { findings: [null, { category: "vibes", rating: "ok", summary: "x", evidence: [] }, { category: "testing", rating: "great", summary: "x", evidence: [] }, { category: "testing", rating: "ok", summary: "  ", evidence: [] }], nextStep: "x" }],
    ["E5 nextStep missing", { findings: GOOD.findings }],
    ["E6 empty response text", ""],
  ];
  for (const [label, out] of cases) {
    model(out);
    const r = await post(report, { session: session() });
    assert(`${label} -> 503 retryable, no findings shown`, r.status === 503 && r.json?.retryable === true && !("findings" in (r.json ?? {})), `${r.status} ${r.text.slice(0, 100)}`);
  }
  model({ findings: [{ category: "approach", rating: "ok", summary: "Kept.", evidence: "v5" }, { category: "testing", rating: "ok", summary: "Lines reversed.", evidence: [{ kind: "code", codeVersion: 2, lineStart: 4, lineEnd: 2 }, 7, null] }], nextStep: "Go." });
  const r = await post(report, { session: session() });
  assert("E7 non-array evidence and junk entries are ignored without a crash", r.status === 200 && r.json.findings[0].rating === "insufficient_evidence" && JSON.stringify(r.json.findings[1].evidence) === JSON.stringify([{ kind: "code", codeVersion: 2 }]), r.text.slice(0, 200));
}

console.log("== F. Missing transcript");
{
  model({ findings: [
    { category: "spoken_reasoning", rating: "strong", summary: "You explained the set clearly.", evidence: [{ kind: "turn", turnId: "t2" }, { kind: "code", codeVersion: 5 }] },
    { category: "clarification", rating: "ok", summary: "You asked about empty input.", evidence: [{ kind: "code", codeVersion: 5 }] },
    { category: "approach", rating: "strong", summary: "Version 5 uses a set.", evidence: [{ kind: "code", codeVersion: 5 }] },
  ], nextStep: "Narrate your plan." });
  const s = { ...session(), turns: [] };
  const r = await post(report, { session: s });
  const f = r.json?.findings ?? [];
  const prompt = globalThis.__GEN__.calls.at(-1).contents;
  assert("F1 prompt says no transcript was captured", /No transcript was captured/i.test(prompt));
  assert("F2 spoken_reasoning -> insufficient_evidence, no speech claimed", f[0]?.rating === "insufficient_evidence" && f[0]?.evidence.length === 0 && /no transcript/i.test(f[0]?.summary) && !/explained/i.test(f[0]?.summary), JSON.stringify(f[0]));
  assert("F3 clarification (spoken) -> insufficient_evidence", f[1]?.rating === "insufficient_evidence" && /no transcript/i.test(f[1]?.summary), JSON.stringify(f[1]));
  assert("F4 code-based finding kept", f[2]?.rating === "strong" && f[2]?.evidence.length === 1);
}

console.log("== G. Provider failure and timeout");
{
  globalThis.__GEN__.mode = "throw";
  let r = await post(report, { session: session() });
  assert("G1 provider error -> 503 provider_unavailable, retryable", r.status === 503 && r.json?.code === "provider_unavailable" && r.json?.retryable === true);
  assert("G2 no provider detail or key in the response", !/SECRET|quota|AIza|stub-key/.test(r.text), r.text);
  globalThis.__GEN__.mode = "hang";
  const started = Date.now();
  r = await post(report, { session: session() });
  const ms = Date.now() - started;
  assert("G3 hung provider -> 503 timeout, retryable, within the limit", r.status === 503 && r.json?.code === "timeout" && r.json?.retryable === true && ms < 2000, `${r.status} ${r.json?.code} ${ms}ms`);
}

console.log("== H. Token route safeguards");
{
  let r = await post(token, null, JSON.stringify({ sessionId: "s1", pad: "z".repeat(20_000) }));
  assert("H1 oversized body -> 400", r.status === 400, `${r.status}`);
  r = await post(token, { sessionId: "x".repeat(500) });
  assert("H2 overlong sessionId -> 400", r.status === 400, `${r.status}`);
  const key = process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY;
  r = await post(token, { sessionId: "s1" });
  assert("H3 not configured -> 503, not retryable", r.status === 503 && r.json?.retryable === false, r.text);
  process.env.GEMINI_API_KEY = key;
  globalThis.__TOK__.mode = "throw";
  r = await post(token, { sessionId: "s1" });
  assert("H4 provider error -> 503 retryable, no detail leaked", r.status === 503 && r.json?.retryable === true && !/SECRET|stub-key/.test(r.text), r.text);
  globalThis.__TOK__.mode = "hang";
  const started = Date.now();
  r = await post(token, { sessionId: "s1" });
  assert("H5 hung token mint -> 503 timeout within the limit", r.status === 503 && r.json?.code === "timeout" && Date.now() - started < 2000, `${r.status} ${r.json?.code}`);
  globalThis.__TOK__.mode = "ok";
  r = await post(token, { sessionId: "s1" });
  assert("H6 valid request still mints (no key in response)", r.status === 200 && !r.text.includes("stub-key"));
}

console.log(fails === 0 ? "\nALL REPORT/TOKEN CHECKS PASSED" : `\n${fails} REPORT/TOKEN CHECK(S) FAILED`);
process.exit(fails ? 1 : 0);
