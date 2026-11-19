// Dev-only check for the behavioral round (not shipped). @google/genai is
// stubbed: no key, network, or audio. A stub cannot show that real Gemini
// listens; this checks what the app sends and how it handles events.
//
// Run: node --experimental-strip-types dev/behavioral-check.mjs

import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
globalThis.btoa ??= (s) => Buffer.from(s, "binary").toString("base64");
globalThis.atob ??= (s) => Buffer.from(s, "base64").toString("binary");
globalThis.AudioContext ??= class { currentTime = 0; destination = {}; close() {} };
Object.assign(globalThis, { __TOKCFG__: [], __GEN__: { calls: [], text: "" }, __CONNECTS__: [], __SENT__: [] });

const STUB = `
export const Type = { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING", INTEGER: "INTEGER" };
export const Modality = { AUDIO: "AUDIO" };
export const EndSensitivity = { END_SENSITIVITY_LOW: "END_SENSITIVITY_LOW" };
export class GoogleGenAI {
  constructor() {
    this.authTokens = { create: async ({ config }) => { globalThis.__TOKCFG__.push(config); return { name: "auth_tokens/stub" }; } };
    this.models = { generateContent: async (req) => { globalThis.__GEN__.calls.push(req); return { text: globalThis.__GEN__.text }; } };
    this.live = { connect: async ({ callbacks }) => {
      const id = globalThis.__CONNECTS__.length;
      const session = { sendClientContent: (m) => globalThis.__SENT__.push({ conn: id, text: m.turns?.[0]?.parts?.[0]?.text ?? "", tc: !!m.turnComplete }), sendRealtimeInput: () => {}, close: () => {} };
      globalThis.__CONNECTS__.push({ callbacks, session });
      callbacks.onopen?.();
      return session;
    } };
  }
}
`;
const dir = mkdtempSync(join(tmpdir(), "behavioral-check-"));
const stubPath = join(dir, "genai-stub.mjs");
writeFileSync(stubPath, STUB);
let n = 0;
async function load(entry) {
  const out = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, alias: { "@google/genai": stubPath }, logLevel: "error" });
  const p = join(dir, `m${n++}.mjs`);
  writeFileSync(p, out.outputFiles[0].text);
  return import(pathToFileURL(p).href);
}
process.env.GEMINI_API_KEY = "stub-key-NOT-REAL";
process.env.LIVE_MODEL = "stub-live";
process.env.REPORT_MODEL = "stub-report";
const { behavioralInstructions } = await load(join(ROOT, "lib", "behavioral.ts"));
const { interviewerInstructions } = await load(join(ROOT, "lib", "prompts.ts"));
const { containsDuplicate } = await load(join(ROOT, "lib", "problems.ts"));
const token = await load(join(ROOT, "app", "api", "live-token", "route.ts"));
const report = await load(join(ROOT, "app", "api", "report", "route.ts"));
const { createLiveClient } = await load(join(ROOT, "lib", "live.ts"));

let fails = 0;
const assert = (label, cond, extra) => { if (!cond) fails += 1; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || extra === undefined ? "" : `  (${extra})`}`); };
const post = async (mod, body) => { const res = await mod.POST(new Request("http://x/api", { method: "POST", body: JSON.stringify(body) })); return { status: res.status, json: await res.json().catch(() => null) }; };
const CODING_WORDS = /contains.?duplicate|\[RUN|\[CODE|nums|test case|python/i;
const mint = async (body) => { const i = globalThis.__TOKCFG__.length; const r = await post(token, body); return { r, si: globalThis.__TOKCFG__[i]?.liveConnectConstraints?.config?.systemInstruction }; };

console.log("== 1. Token route selects the instruction by round");
{
  const coding = await mint({ sessionId: "s1" });
  assert("1a omitted roundType -> canonical coding instruction (unchanged)", coding.si === interviewerInstructions(containsDuplicate));
  const explicit = await mint({ sessionId: "s1", roundType: "coding" });
  assert("1b roundType coding -> same coding instruction", explicit.si === coding.si);
  const beh = await mint({ sessionId: "s1", roundType: "behavioral" });
  assert("1c roundType behavioral -> behavioral instruction", beh.r.status === 200 && beh.si === behavioralInstructions({}));
  assert("1d behavioral instruction never mentions the coding problem, code, or runs", !/contains.?duplicate|\[RUN|\[CODE|nums/i.test(beh.si) && /no coding problem/i.test(beh.si));
  assert("1e it opens with one engineering-story question and probes one missing detail", /\[START\]/.test(beh.si) && /engineering-story question/.test(beh.si) && /ask about that ONE detail/.test(beh.si) && /personally investigated or changed/.test(beh.si) && /how they checked whether the change helped/.test(beh.si));
  assert("1e2 it mixes follow-ups with new questions: at most two follow-ups per story, then a different theme", /at most TWO follow-ups per story, usually one, and sometimes none/.test(beh.si) && /completely different engineering-story question/.test(beh.si) && /Never reuse a theme/.test(beh.si));
  const withRole = await mint({ sessionId: "s1", roundType: "behavioral", roleContext: { role: "Backend Intern", company: "Acme Payments", jobDescription: "SECRET-LISTING-TEXT build APIs" } });
  assert("1f behavioral role framing uses title/company only; the raw listing is never in the session", withRole.si.includes("Backend Intern") && !withRole.si.includes("SECRET-LISTING-TEXT"));
  const bad = await post(token, { sessionId: "s1", roundType: "system-design" });
  assert("1g unknown roundType -> 400 before minting", bad.status === 400 && bad.json?.code === "invalid_request");
}

console.log("== 2. Live client in behavioral mode");
let c;
{
  globalThis.__SENT__.length = 0;
  const turns = [];
  c = createLiveClient({ turnSeed: 0, followupSettleMs: 0, round: "behavioral" });
  c.onTurn((t) => turns.push(t)); c.onState(() => {}); c.onError(() => {});
  await c.connect({ token: "t", model: "m", expiresAt: "2099-01-01T00:00:00Z" }); // no problem
  const opening = globalThis.__SENT__.filter((m) => m.tc);
  assert("2a behavioral opening sent once, with no coding content", opening.length === 1 && /\[START\] Begin the behavioral interview/.test(opening[0].text) && !CODING_WORDS.test(opening[0].text), opening[0]?.text);
  const cb = () => globalThis.__CONNECTS__.at(-1).callbacks;
  cb().onmessage({ serverContent: { outputTranscription: { text: "Tell me about a hard bug you debugged.", finished: true } } });
  cb().onmessage({ serverContent: { turnComplete: true } });
  // Coding calls are inert in a behavioral round.
  c.sendRunContext({ codeVersion: 2, source: "x", at: "x" }, { sessionId: "s", problemId: "contains-duplicate", codeVersion: 2, ranAt: "x", durationMs: 1, status: "completed", passed: 4, total: 4, cases: [] });
  c.syncCode?.({ codeVersion: 3, source: "y", at: "x" });
  // Answer with a pause mid-sentence, then finish.
  cb().onmessage({ serverContent: { inputTranscription: { text: "We fixed the database " } } });
  await new Promise((r) => setTimeout(r, 900));
  cb().onmessage({ serverContent: { inputTranscription: { text: "after checkout got slow.", finished: true } } });
  await new Promise((r) => setTimeout(r, 300));
  const sent = globalThis.__SENT__.slice(1);
  assert("2b Run, code sync, answer, and pause send nothing from the app (no coding question possible)", sent.length === 0, JSON.stringify(sent.map((m) => m.text.slice(0, 40))));
  assert("2c turns t1 (interviewer), t2 (student)", turns.map((t) => `${t.id}:${t.speaker}`).join(",") === "t1:interviewer,t2:student");
  // Reconnect after the answer: current question + verbatim answer, one follow-up, no opener.
  globalThis.__SENT__.length = 0;
  cb().onclose();
  await c.connect({ token: "t2", model: "m", expiresAt: "2099-01-01T00:00:00Z" });
  const rec = globalThis.__SENT__;
  assert("2d reconnect: exactly one [RECONNECTED] recap, no repeated opening", rec.length === 1 && rec[0].text.startsWith("[RECONNECTED]") && !/\[START\]/.test(rec[0].text), JSON.stringify(rec.map((m) => m.text.slice(0, 50))));
  assert("2e recap carries the current question and the answer verbatim", rec[0].text.includes('current question was: "Tell me about a hard bug you debugged."') && rec[0].text.includes("Candidate: We fixed the database after checkout got slow."));
  assert("2f recap asks for the next move (follow-up or new question) because the student had answered (turnComplete)", rec[0].tc === true && /one follow-up about a missing detail/.test(rec[0].text) && /new question on a different theme/.test(rec[0].text) && !CODING_WORDS.test(rec[0].text));
  cb().onmessage({ serverContent: { outputTranscription: { text: "What did you personally investigate?", finished: true } } });
  assert("2g turn IDs continue after reconnect (t3)", turns.at(-1).id === "t3");
  c.end();
  // Coding client unchanged.
  globalThis.__SENT__.length = 0;
  const cc = createLiveClient({ followupSettleMs: 0 });
  cc.onTurn(() => {}); cc.onState(() => {}); cc.onError(() => {});
  await cc.connect({ token: "t", model: "m", expiresAt: "2099-01-01T00:00:00Z" }, containsDuplicate);
  assert("2h coding client still opens with the Contains Duplicate approach question", globalThis.__SENT__.some((m) => m.tc && m.text.includes('"Contains Duplicate"') && m.text.includes("explain their approach")));
  cc.end();
}

console.log("== 3. Report route for behavioral sessions");
{
  const at = (s) => new Date(Date.parse("2026-11-15T01:00:00Z") + s * 1000).toISOString();
  const LONG = "I was the on-call engineer when checkout latency jumped to four seconds. I traced the slow queries in our Postgres logs, found a missing index on the orders table, added it in a migration, and compared p95 latency before and after in Grafana, which dropped to four hundred milliseconds.";
  const beh = (turns, extra = {}) => ({ sessionId: "s1", attemptId: "a1", roundType: "behavioral", turns, ...extra });
  const T = [
    { id: "t1", speaker: "interviewer", text: "Tell me about a hard bug.", at: at(0) },
    { id: "t2", speaker: "student", text: LONG, at: at(10) },
    { id: "t3", speaker: "interviewer", text: "How did you verify it?", at: at(40) },
  ];
  let calls = globalThis.__GEN__.calls.length;
  let r = await post(report, { session: beh([]) });
  assert("3a empty transcript -> 200 insufficient_evidence report, no model call", r.status === 200 && r.json.findings.length === 4 && r.json.findings.every((f) => f.rating === "insufficient_evidence" && f.evidence.length === 0) && /No answer was captured/.test(r.json.findings[0].summary) && globalThis.__GEN__.calls.length === calls);
  r = await post(report, { session: beh([T[0], { id: "t2", speaker: "student", text: "We fixed the database.", at: at(5) }]) });
  assert("3b sparse transcript -> 200 report naming the missing evidence, no model call", r.status === 200 && /Only about 4 words/.test(r.json.findings[0].summary) && /personally did/.test(r.json.findings[1].summary) && globalThis.__GEN__.calls.length === calls);
  globalThis.__GEN__.text = JSON.stringify({ findings: [
    { category: "personal_contribution", rating: "strong", summary: "You said you traced the slow queries yourself.", evidence: [{ kind: "turn", turnId: "t2" }, { kind: "turn", turnId: "t1" }, { kind: "turn", turnId: "t99" }] },
    { category: "outcome", rating: "strong", summary: "Only invalid refs.", evidence: [{ kind: "turn", turnId: "t3" }, { kind: "code", codeVersion: 2 }] },
    { category: "complexity", rating: "ok", summary: "A coding category.", evidence: [{ kind: "turn", turnId: "t2" }] },
    { category: "reasoning", rating: "insufficient_evidence", summary: "You did not say why you chose an index.", evidence: [] },
  ], nextStep: "Explain why you chose that fix." });
  calls = globalThis.__GEN__.calls.length;
  r = await post(report, { session: beh(T) });
  const f = r.json?.findings ?? [];
  const req = globalThis.__GEN__.calls.at(-1);
  assert("3c one model call with the behavioral rubric and schema", globalThis.__GEN__.calls.length === calls + 1 && /personal_contribution/.test(req.config.systemInstruction) && JSON.stringify(req.config.responseSchema).includes("specificity") && !JSON.stringify(req.config.responseSchema).includes("codeVersion"));
  assert("3d only the student turn survives as evidence (interviewer t1 and invented t99 rejected)", JSON.stringify(f[0]?.evidence) === JSON.stringify([{ kind: "turn", turnId: "t2" }]), JSON.stringify(f[0]?.evidence));
  assert("3e a finding citing only an interviewer turn or code -> insufficient_evidence", f[1]?.category === "outcome" && f[1]?.rating === "insufficient_evidence" && f[1]?.evidence.length === 0, JSON.stringify(f[1]));
  assert("3f coding categories are rejected in a behavioral report", !f.some((x) => x.category === "complexity"));
  assert("3g prompt has transcript turns only (no problem, code, or runs)", !/Contains Duplicate|codeVersion|Runs/.test(req.contents) && req.contents.includes("t2 (candidate)"));
  r = await post(report, { session: beh(T, { snapshots: [{ codeVersion: 1, source: "x", at: at(1) }] }) });
  assert("3h behavioral session with snapshots -> 400", r.status === 400);
  r = await post(report, { session: beh(T, { problemId: "contains-duplicate" }) });
  assert("3i behavioral session with a problemId -> 400", r.status === 400);
  r = await post(report, { session: beh(T, { roundType: "system-design" }) });
  assert("3j unknown roundType -> 400", r.status === 400);
  globalThis.__GEN__.text = JSON.stringify({ findings: [{ category: "approach", rating: "ok", summary: "Set-based.", evidence: [{ kind: "code", codeVersion: 2 }] }], nextStep: "Practice." });
  r = await post(report, { session: { sessionId: "s1", attemptId: "a1", problemId: "contains-duplicate", turns: [], snapshots: [{ codeVersion: 2, source: "def contains_duplicate(nums):\n    return False", at: at(1) }], runs: [] } });
  assert("3k older coding payload with no roundType -> coding report as before", r.status === 200 && r.json.findings[0].category === "approach" && r.json.findings[0].evidence[0].kind === "code");
  const key = process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY;
  r = await post(report, { session: beh(T) });
  assert("3l behavioral with enough words but no key -> 503 not configured (UI shows labeled fixture)", r.status === 503 && r.json?.retryable === false);
  r = await post(report, { session: beh([]) });
  assert("3m empty behavioral transcript needs no key (deterministic report)", r.status === 200);
  process.env.GEMINI_API_KEY = key;
}

console.log(fails === 0 ? "\nALL BEHAVIORAL CHECKS PASSED" : `\n${fails} BEHAVIORAL CHECK(S) FAILED`);
process.exit(fails ? 1 : 0);
