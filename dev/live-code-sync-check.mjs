// Dev-only regression check: code typed (but not run) becomes visible to a
// SPOKEN question. Gemini buffers a silent [CODE] snapshot (turnComplete:false)
// until a complete turn follows, and the candidate's speech does not commit it,
// so lib/live.ts sends a short [SYNC vN] turn after a typing pause and mutes the
// model's one-word reply. Bundles the real BrowserLiveClient with @google/genai
// stubbed to capture every sendClientContent.
//
// Run: node dev/live-code-sync-check.mjs

import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
globalThis.btoa ??= (s) => Buffer.from(s, "binary").toString("base64");
globalThis.atob ??= (s) => Buffer.from(s, "base64").toString("binary");
globalThis.AudioContext ??= class {
  currentTime = 0; destination = {}; close() {}
  createBuffer(_c, n) { return { getChannelData: () => new Float32Array(n), duration: 0 }; }
  createBufferSource() { return { connect() {}, start() {}, stop() {}, addEventListener() {}, set onended(_f) {} }; }
};
globalThis.__SENT__ = [];
globalThis.__CB__ = null;

const STUB = `
export const Modality = { AUDIO: "AUDIO", TEXT: "TEXT" };
export class GoogleGenAI {
  constructor() {
    this.live = { connect: async ({ callbacks }) => {
      globalThis.__CB__ = callbacks;
      if (callbacks.onopen) callbacks.onopen();
      return { sendClientContent: (m) => { const __t = m?.turns?.[0]?.parts?.[0]?.text ?? ""; if (__t.startsWith("[START]")) { queueMicrotask(() => { callbacks.onmessage({ serverContent: { turnComplete: true } }); }); return; } globalThis.__SENT__.push(m); }, sendRealtimeInput: () => {}, close: () => {} };
    } };
  }
}
`;
const dir = mkdtempSync(join(tmpdir(), "live-code-sync-"));
const stubPath = join(dir, "genai-stub.mjs");
writeFileSync(stubPath, STUB);
const out = await build({ entryPoints: [join(ROOT, "lib", "live.ts")], bundle: true, format: "esm", platform: "node", write: false, alias: { "@google/genai": stubPath }, logLevel: "error" });
const bundlePath = join(dir, "live.bundle.mjs");
writeFileSync(bundlePath, out.outputFiles[0].text);
const { createLiveClient } = await import(pathToFileURL(bundlePath).href);

const problem = { id: "contains-duplicate", title: "Contains Duplicate", prompt: "p", examples: [], constraints: [], functionName: "contains_duplicate", starterCode: "x", cases: [] };
const token = { token: "t", model: "m", expiresAt: "2099-01-01T00:00:00Z" };
const snap = (v) => ({ codeVersion: v, source: `def contains_duplicate(nums):\n    return ${v}  # v${v}`, at: new Date().toISOString() });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cb = () => globalThis.__CB__;
const msg = (serverContent, data) => cb().onmessage({ serverContent, ...(data ? { data } : {}) });
const AUDIO = Buffer.from(new Uint8Array(8)).toString("base64");
function drain() {
  const items = globalThis.__SENT__.map((m) => ({ text: m.turns?.[0]?.parts?.[0]?.text ?? "", tc: !!m.turnComplete }));
  globalThis.__SENT__.length = 0;
  return items;
}
const syncs = (items) => items.filter((m) => m.tc && m.text.startsWith("[SYNC"));
let fails = 0;
const assert = (label, cond, extra) => { if (!cond) fails += 1; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || extra === undefined ? "" : `  (${extra})`}`); };

async function fresh() {
  const c = createLiveClient({ followupSettleMs: 0 });
  const turns = [];
  const states = [];
  c.onTurn((t) => turns.push(t));
  c.onState((s) => states.push(s));
  await c.connect(token, problem);
  await sleep(0);
  c.syncCode(snap(1)); // starter code, as ProblemRoom does on connect
  await sleep(700);
  if (drain().some((m) => m.tc)) msg({ turnComplete: true }); // end any commit turn
  drain();
  return { c, turns, states };
}

console.log("== 1. A typing pause commits the code with one muted [SYNC] turn");
{
  const { c, turns, states } = await fresh();
  c.syncCode(snap(2));
  const now = drain();
  assert("1a the edit is delivered at once as a silent [CODE v2] snapshot", now.length === 1 && !now[0].tc && now[0].text.startsWith("[CODE v2]"));
  await sleep(250);
  assert("1b no commit while still inside the typing-pause window", drain().length === 0);
  await sleep(400);
  const s = syncs(drain());
  assert("1c after the pause: exactly one [SYNC v2] complete turn", s.length === 1 && s[0].text.startsWith("[SYNC v2]"), JSON.stringify(s));
  const before = { turns: turns.length, speaking: states.filter((x) => x === "speaking").length };
  msg({ outputTranscription: { text: "Okay." } }, AUDIO);
  msg({ turnComplete: true });
  assert("1d the model's 'Okay.' reply is muted: no transcript turn", turns.length === before.turns, JSON.stringify(turns.slice(before.turns)));
  assert("1e ... and the interviewer never shows as speaking", states.filter((x) => x === "speaking").length === before.speaking);
  await sleep(700);
  assert("1f no repeat [SYNC] when the code has not changed", syncs(drain()).length === 0);
  // The next real interviewer turn is heard and transcribed normally.
  msg({ inputTranscription: { text: "What data structure am I using?", finished: true } });
  msg({ outputTranscription: { text: "You are using a set." } }, AUDIO);
  msg({ turnComplete: true });
  assert("1g a real reply after the sync is transcribed", turns.at(-1)?.speaker === "interviewer" && turns.at(-1)?.text === "You are using a set.");
  c.end();
}

console.log("== 2. Steady typing is still committed within a few seconds");
{
  const { c } = await fresh();
  let v = 2;
  let firstSyncAt = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 5200) {
    c.syncCode(snap(v++));
    await sleep(300);
    const s = syncs(drain());
    if (s.length && firstSyncAt === null) firstSyncAt = Date.now() - t0;
    if (s.length) msg({ turnComplete: true });
  }
  assert("2a a [SYNC] lands while typing never pauses (bounded wait)", firstSyncAt !== null && firstSyncAt <= 3600, `first at ${firstSyncAt} ms`);
  c.end();
}

console.log("== 3. Never commits over the candidate or the interviewer");
{
  const { c } = await fresh();
  msg({ inputTranscription: { text: "So I think I would" } }); // mid-sentence
  c.syncCode(snap(2));
  drain();
  await sleep(700);
  assert("3a no [SYNC] while the candidate is mid-sentence", syncs(drain()).length === 0);
  msg({ inputTranscription: { text: " use a set.", finished: true } });
  await sleep(50);
  const atFinish = drain();
  assert("3b no muted [SYNC] right as they finish (the interviewer is about to reply)", syncs(atFinish).length === 0);
  if (atFinish.some((m) => m.tc)) msg({ turnComplete: true }); // the existing one-time code remark, if it went
  msg({ outputTranscription: { text: "Why a set?" } }, AUDIO); // the interviewer replies
  msg({ turnComplete: true });
  const commits = [...atFinish, ...drain()].filter((m) => m.tc);
  assert("3b2 v2 is committed exactly once by the end of the reply ([SYNC v2] or the code remark)", commits.length === 1 && /^\[(SYNC|CODE) v2\]/.test(commits[0].text), JSON.stringify(commits.map((m) => m.text.slice(0, 20))));
  msg({ turnComplete: true });

  msg({ outputTranscription: { text: "Tell me more" } }, AUDIO); // interviewer starts talking
  c.syncCode(snap(3));
  drain();
  await sleep(700);
  assert("3c no [SYNC] while the interviewer is mid-turn", syncs(drain()).length === 0);
  msg({ turnComplete: true });
  const afterTurn = syncs(drain());
  assert("3d the [SYNC] goes out at the turn boundary", afterTurn.length === 1 && afterTurn[0].text.startsWith("[SYNC v3]"));
  c.end();
}

console.log("== 4. The candidate talking over the muted reply un-mutes the real answer");
{
  const { c, turns } = await fresh();
  c.syncCode(snap(2));
  await sleep(700);
  drain();
  msg({ inputTranscription: { text: "Can you see my code?" } });
  msg({ interrupted: true });
  msg({ inputTranscription: { text: "", finished: true } });
  msg({ outputTranscription: { text: "Yes, you return early on a repeat." } }, AUDIO);
  msg({ turnComplete: true });
  assert("4a the reply to the candidate is transcribed, not muted", turns.at(-1)?.speaker === "interviewer" && turns.at(-1)?.text === "Yes, you return early on a repeat.", JSON.stringify(turns.at(-1)));
  c.end();
}

console.log("== 5. A reconnect commits the restored code on the new session");
{
  const { c } = await fresh();
  c.syncCode(snap(4));
  drain();
  cb().onclose(); // unexpected drop before the commit
  await c.connect(token, problem);
  await sleep(0);
  const sent = drain();
  // Any complete turn commits it: a [SYNC v4], or the existing one-time code remark about v4.
  const commit = sent.find((m) => m.tc);
  assert("5a restored code is committed right after reconnecting", sent.some((m) => !m.tc && m.text.includes("[CODE v4]")) && !!commit && /^\[(SYNC|CODE) v4\]/.test(commit.text), JSON.stringify(sent.map((m) => m.text.slice(0, 20))));
  c.end();
}

console.log("== 6. Behavioral rounds never sync code");
{
  const c = createLiveClient({ round: "behavioral", followupSettleMs: 0 });
  await c.connect(token);
  drain();
  c.syncCode(snap(2));
  await sleep(700);
  assert("6a no [CODE] or [SYNC] in a behavioral round", drain().every((m) => !/^\[(CODE|SYNC)/.test(m.text)));
  c.end();
}

console.log(fails ? `\n${fails} check(s) FAILED` : "\nALL CODE-SYNC CHECKS PASSED");
process.exit(fails ? 1 : 0);
