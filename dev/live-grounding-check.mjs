// Dev-only regression check for interviewer grounding (not shipped).
//   1. The token route locks the interviewer instruction + turn detection into
//      the single-use ephemeral token (the only place it takes effect).
//   2. lib/live.ts: opening question, Run evidence ordering, follow-up gating,
//      mid-sentence pauses, reconnect notice, and the local correlation trace.
// @google/genai is stubbed; no key, network, audio, or user source is used.
//
// Run: node --experimental-strip-types dev/live-grounding-check.mjs

import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
globalThis.btoa ??= (s) => Buffer.from(s, "binary").toString("base64");
globalThis.atob ??= (s) => Buffer.from(s, "base64").toString("binary");
globalThis.AudioContext ??= class { currentTime = 0; destination = {}; close() {} };
globalThis.__CONNECTS__ = [];
globalThis.__SENT__ = [];
globalThis.__TOKEN_CONFIGS__ = [];

const STUB = `
export const Modality = { AUDIO: "AUDIO", TEXT: "TEXT" };
export const StartSensitivity = { START_SENSITIVITY_LOW: "START_SENSITIVITY_LOW", START_SENSITIVITY_HIGH: "START_SENSITIVITY_HIGH" };
export const EndSensitivity = { END_SENSITIVITY_LOW: "END_SENSITIVITY_LOW", END_SENSITIVITY_HIGH: "END_SENSITIVITY_HIGH" };
export class GoogleGenAI {
  constructor() {
    this.authTokens = { create: async ({ config }) => { globalThis.__TOKEN_CONFIGS__.push(config); return { name: "auth_tokens/stub" }; } };
    this.live = { connect: async ({ callbacks, config }) => {
      const id = globalThis.__CONNECTS__.length;
      const session = {
        id, closed: false,
        sendClientContent: (m) => globalThis.__SENT__.push({ conn: id, text: m.turns?.[0]?.parts?.[0]?.text ?? "", tc: !!m.turnComplete }),
        sendRealtimeInput: () => {},
        close: () => { session.closed = true; },
      };
      globalThis.__CONNECTS__.push({ callbacks, session, config });
      if (callbacks.onopen) callbacks.onopen();
      return session;
    } };
  }
}
`;
const dir = mkdtempSync(join(tmpdir(), "live-grounding-"));
const stubPath = join(dir, "genai-stub.mjs");
writeFileSync(stubPath, STUB);
async function load(entry, name) {
  const out = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, alias: { "@google/genai": stubPath }, logLevel: "error" });
  const p = join(dir, name);
  writeFileSync(p, out.outputFiles[0].text);
  return import(pathToFileURL(p).href);
}
const { createLiveClient } = await load(join(ROOT, "lib", "live.ts"), "live.mjs");
const { interviewerInstructions } = await load(join(ROOT, "lib", "prompts.ts"), "prompts.mjs");
const { getProblem } = await load(join(ROOT, "lib", "problems.ts"), "problems.mjs");
const route = await load(join(ROOT, "app", "api", "live-token", "route.ts"), "route.mjs");

let fails = 0;
const assert = (label, cond, extra) => { if (!cond) fails += 1; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || extra === undefined ? "" : `  (${extra})`}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problem = getProblem("contains-duplicate");
const tok = (n) => ({ token: `t${n}`, model: "m", expiresAt: "2099-01-01T00:00:00Z" });
const snap = (v, src) => ({ codeVersion: v, source: src, at: new Date().toISOString() });
const SET_SRC = "def contains_duplicate(nums):\n    seen = set()\n    for n in nums:\n        if n in seen:\n            return True\n        seen.add(n)\n    return False";
const ADJ_SRC = "def contains_duplicate(nums):\n    for i in range(len(nums) - 1):\n        if nums[i] == nums[i + 1]:\n            return True\n    return False";
const run = (v, passed, total = 4) => ({ sessionId: "s", problemId: "contains-duplicate", codeVersion: v, ranAt: new Date().toISOString(), durationMs: 10, status: "completed", passed, total, cases: [] });
const conns = () => globalThis.__CONNECTS__;
const cb = () => conns()[conns().length - 1].callbacks;
const sent = () => globalThis.__SENT__;
const drain = () => { const s = sent().map((x) => ({ ...x })); sent().length = 0; return s; };
const asks = (msgs) => msgs.filter((m) => m.tc);
const say = (text, finished = false) => cb().onmessage({ serverContent: { inputTranscription: { text, finished } } });
const reply = (text) => { cb().onmessage({ serverContent: { outputTranscription: { text, finished: true } } }); cb().onmessage({ serverContent: { turnComplete: true } }); };
const trace = () => globalThis.__ILZ_LIVE_TRACE__;

// ---------------------------------------------------------------------------
console.log("== 1. Token route locks the interviewer instruction");
{
  process.env.GEMINI_API_KEY = "stub-key-not-real";
  process.env.LIVE_MODEL = "stub-model";
  const res = await route.POST(new Request("http://x/api/live-token", { method: "POST", body: JSON.stringify({ sessionId: "s1" }) }));
  const body = await res.json();
  const cfg = globalThis.__TOKEN_CONFIGS__.at(-1);
  const locked = cfg?.liveConnectConstraints?.config ?? {};
  const si = typeof locked.systemInstruction === "string" ? locked.systemInstruction : "";
  assert("1a token is single-use", cfg?.uses === 1);
  assert("1b systemInstruction is in the token's locked config", si.length > 0);
  assert("1c it is the shared builder's output for the canonical problem", si === interviewerInstructions(problem));
  assert("1d instruction names the function, examples, constraints", si.includes("contains_duplicate") && si.includes("[1,2,3,1]") && si.includes(problem.constraints[0]));
  assert("1e instruction: English, opening approach question, one question then wait", /English/.test(si) && /explain (their|your) approach/i.test(si) && /one .*question/i.test(si));
  assert("1f instruction explains [CODE vN] snapshots and [RUN vN] evidence", si.includes("[CODE v") && si.includes("[RUN v"));
  assert("1g instruction: report latest Run version+score, say what's missing, reconnect only when told", /latest .*run/i.test(si) && /missing/i.test(si) && si.includes("[RECONNECTED]"));
  const aad = locked.realtimeInputConfig?.automaticActivityDetection;
  assert("1h turn detection locked with silence > 850 ms", (aad?.silenceDurationMs ?? 0) > 850, JSON.stringify(aad));
  assert("1i no diagnostic phrases left in the instruction", !/QUOKKA|diagnostic|test phrase/i.test(si));
  assert("1j response carries only token/model/expiresAt (no key)", JSON.stringify(Object.keys(body).sort()) === JSON.stringify(["expiresAt", "model", "token"]) && !JSON.stringify(body).includes("stub-key"));
}

// ---------------------------------------------------------------------------
console.log("== 2. Opening question on first connect only");
let c;
{
  globalThis.__ILZ_LIVE_TRACE__ = [];
  c = createLiveClient({ turnSeed: 0 });
  const turns = [];
  c.onTurn((t) => turns.push(t)); c.onState(() => {}); c.onError(() => {});
  await c.connect(tok(1), problem);
  const first = drain();
  assert("2a first connect sends exactly one opening request", asks(first).length === 1 && /open|begin|start/i.test(asks(first)[0]?.text ?? ""), JSON.stringify(first.map((m) => m.text.slice(0, 50))));
  assert("2b opening request does not mention a reconnect", !first.some((m) => m.text.includes("[RECONNECTED]")));
  reply("Hi! Could you walk me through your approach?");
  // A Run while the opening question is unanswered: evidence goes out, no second question.
  c.sendRunContext(snap(5, SET_SRC), run(5, 4));
  const r = drain();
  assert("2c Run while a question is outstanding: evidence delivered", r.some((m) => !m.tc && m.text.includes("[RUN v5] 4/4")));
  assert("2d ...but no second question", asks(r).length === 0, JSON.stringify(asks(r).map((m) => m.text.slice(0, 40))));
}

// ---------------------------------------------------------------------------
console.log("== 3. Pause mid-sentence (~850 ms) never triggers a follow-up; speech resuming cancels it");
{
  say("I use a set because"); say("", true); // server VAD ends a turn at a natural pause
  await sleep(850);
  assert("3a no follow-up during an 850 ms pause after a finished fragment", asks(drain()).length === 0);
  say(" lookups are constant time"); // speech resumes
  say("", true);
  await sleep(300);
  assert("3b resumed speech re-arms the wait (still nothing after 300 ms)", asks(drain()).length === 0);
  await sleep(1500);
  const a = asks(drain());
  assert("3c after a real pause, exactly one follow-up about the latest Run (v5 4/4)", a.length === 1 && a[0].text.includes("v5") && a[0].text.includes("4/4"), JSON.stringify(a.map((m) => m.text.slice(0, 60))));
  reply("Version 5 passed 4 out of 4. What's the space cost of the set?");
  const t = trace().filter((e) => e.runId !== undefined && e.v === 5);
  assert("3d trace: run v5 queued -> written -> confirmed by a grounded reply", ["queued", "written", "confirmed"].every((s) => t.some((e) => e.stage === s)), JSON.stringify(t.map((e) => e.stage)));
  assert("3e trace holds metadata only (no source code, no transcript text)", !JSON.stringify(trace()).includes("seen.add") && !JSON.stringify(trace()).includes("space cost"));
}

// ---------------------------------------------------------------------------
console.log("== 4. Two rapid Runs, a late older result, and an edit after Run");
{
  say("O(n) memory for the set.", true);
  await sleep(1700); drain();
  // Two rapid Runs while the student is answering: one question, about the newest.
  say("Let me try something else");
  c.sendRunContext(snap(6, SET_SRC + "\n"), run(6, 4));
  c.sendRunContext(snap(7, ADJ_SRC), run(7, 2));
  // v6 result arriving late, after v7, must not replace v7.
  c.sendRunContext(snap(6, SET_SRC + "\n"), run(6, 4));
  c.syncCode(snap(8, ADJ_SRC + "\n# edited after run"));
  say(" that only compares neighbors.", true);
  await sleep(1700);
  const m = drain();
  const q = asks(m);
  assert("4a exactly one question for two rapid Runs", q.length === 1, `${q.length}`);
  assert("4b ...about the newest Run v7 2/4, never v6", q[0]?.text.includes("v7") && q[0]?.text.includes("2/4") && !q[0]?.text.includes("v6"), q[0]?.text.slice(0, 80));
  assert("4c the edit after Run is sent as not-run-yet v8, labeled separately", m.some((x) => x.text.includes("[CODE v8]") && x.text.includes("not run yet")));
  assert("4d the latest Run evidence is still v7 (edit did not replace it)", m.filter((x) => !x.tc && x.text.includes("[RUN v")).at(-1)?.text.includes("[RUN v7] 2/4"));
  reply("Version 7 passed 2 of 4: it only compares adjacent elements.");
}

// ---------------------------------------------------------------------------
console.log("== 5. Reconnect with a pending Run");
{
  const before = conns().length;
  // Student answers, then a Run arrives while the interviewer is mid-turn, then the socket drops.
  say("Right, separated duplicates are missed.", true);
  cb().onmessage({ serverContent: { outputTranscription: { text: "Good." } } }); // interviewer mid-turn
  c.sendRunContext(snap(9, SET_SRC + "\n# v9"), run(9, 4));
  cb().onclose();
  drain();
  await c.connect(tok(2), problem); // reconnect: same client, fresh token
  const early = drain();
  assert("5g follow-up waits out the settle window after the student's last speech", asks(early).length === 0);
  await sleep(1700);
  const m = [...early, ...drain()];
  assert("5a reconnect reuses the same client (one new socket)", conns().length === before + 1);
  assert("5b exactly one [RECONNECTED] notice", m.filter((x) => x.text.includes("[RECONNECTED]")).length === 1);
  assert("5c restored evidence is the pending Run v9", m.some((x) => x.text.includes("[RUN v9] 4/4")));
  const q = asks(m);
  assert("5d exactly one grounded follow-up, about v9", q.length === 1 && q[0].text.includes("v9"), JSON.stringify(q.map((x) => x.text.slice(0, 60))));
  assert("5e no opening question on reconnect", !q.some((x) => /explain (their|your) approach|begin the interview/i.test(x.text)));
  // Late callback from the dropped socket is ignored.
  const turnsBefore = trace().filter((e) => e.stage === "turn").length;
  conns()[before - 1].callbacks.onmessage({ serverContent: { outputTranscription: { text: "STALE", finished: true } } });
  assert("5f stale socket output never becomes a turn", trace().filter((e) => e.stage === "turn").length === turnsBefore);
}

c.end();
console.log(fails === 0 ? "\nALL GROUNDING CHECKS PASSED" : `\n${fails} GROUNDING CHECK(S) FAILED`);
process.exit(fails ? 1 : 0);
