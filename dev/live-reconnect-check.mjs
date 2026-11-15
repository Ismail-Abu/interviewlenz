// Dev-only regression check for reconnect safety in lib/live.ts (not shipped).
// Exercises the exact public calls the UI uses: createLiveClient(), connect()
// (as reconnect on the same client with a fresh token), sendRunContext(),
// syncCode(), end(). @google/genai is stubbed so every connect/session/send is
// observable, including late callbacks from superseded sockets.
//
// Run: node dev/live-reconnect-check.mjs

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
globalThis.__FAIL_CONNECT__ = false;
globalThis.__FAIL_SEND__ = false;

const STUB = `
export const Modality = { AUDIO: "AUDIO", TEXT: "TEXT" };
export class GoogleGenAI {
  constructor() {
    this.live = { connect: async ({ callbacks }) => {
      if (globalThis.__FAIL_CONNECT__) throw new Error("connect failed");
      const id = globalThis.__CONNECTS__.length;
      const session = {
        id, closed: false,
        sendClientContent: (m) => {
          if (globalThis.__FAIL_SEND__) throw new Error("send failed");
          globalThis.__SENT__.push({ conn: id, text: m.turns?.[0]?.parts?.[0]?.text ?? "", tc: !!m.turnComplete });
        },
        sendRealtimeInput: () => {},
        close: () => { session.closed = true; },
      };
      globalThis.__CONNECTS__.push({ callbacks, session });
      if (callbacks.onopen) callbacks.onopen();
      return session;
    } };
  }
}
`;
const dir = mkdtempSync(join(tmpdir(), "live-reconnect-"));
const stubPath = join(dir, "genai-stub.mjs");
writeFileSync(stubPath, STUB);
const out = await build({ entryPoints: [join(ROOT, "lib", "live.ts")], bundle: true, format: "esm", platform: "node", write: false, alias: { "@google/genai": stubPath }, logLevel: "error" });
const bundlePath = join(dir, "live.bundle.mjs");
writeFileSync(bundlePath, out.outputFiles[0].text);
const { createLiveClient } = await import(pathToFileURL(bundlePath).href);

const problem = { id: "contains-duplicate", title: "Contains Duplicate", prompt: "p", examples: [], constraints: [], functionName: "contains_duplicate", starterCode: "x", cases: [] };
const tok = (n) => ({ token: `t${n}`, model: "m", expiresAt: "2099-01-01T00:00:00Z" });
const snap = (v, src) => ({ codeVersion: v, source: src, at: new Date().toISOString() });
const SRC2 = "def contains_duplicate(nums):\n    for i in range(len(nums)):\n        for j in range(i+1,len(nums)):\n            if nums[i]==nums[j]: return True\n    return False";
const SRC3 = "def contains_duplicate(nums):\n    PURPLE_ARMADILLO = set()\n    for n in nums:\n        if n in PURPLE_ARMADILLO: return True\n        PURPLE_ARMADILLO.add(n)\n    return False";
const run2 = { sessionId: "s", problemId: "contains-duplicate", codeVersion: 2, ranAt: new Date().toISOString(), durationMs: 10, status: "completed", passed: 4, total: 4, cases: [] };
const run3 = { sessionId: "s", problemId: "contains-duplicate", codeVersion: 3, ranAt: new Date().toISOString(), durationMs: 10, status: "completed", passed: 2, total: 4, cases: [
  { caseId: "c1", input: "nums = [1, 2, 3, 1]", expected: "True", actual: "False", pass: false },
  { caseId: "c2", input: "nums = [1, 2, 3, 4]", expected: "False", actual: "False", pass: true },
  { caseId: "c3", input: "nums = []", expected: "False", actual: "False", pass: true },
  { caseId: "c4", input: "nums = [1, 1, 3, 3, 1]", expected: "True", actual: "False", pass: false },
] };

const conns = () => globalThis.__CONNECTS__;
const lastCb = () => conns()[conns().length - 1].callbacks;
const drain = () => { const s = globalThis.__SENT__.map((x) => ({ ...x })); globalThis.__SENT__.length = 0; return s; };
let fails = 0;
const assert = (label, cond, extra) => { if (!cond) fails += 1; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || extra === undefined ? "" : `  (${extra})`}`); };

// (a) Disconnect after v2 4/4; complete v3 2/4 offline; reconnect with a fresh token.
{
  const c = createLiveClient({ turnSeed: 0 });
  const states = []; const errors = [];
  c.onState((s) => states.push(s)); c.onError((e) => errors.push(e));
  await c.connect(tok("A"), problem);
  c.sendRunContext(snap(2, SRC2), run2);
  lastCb().onmessage({ serverContent: { turnComplete: true } }); // interviewer turn ends; question outstanding
  drain();
  lastCb().onclose({ reason: "network blip" });
  assert("(a) disconnect exposes error + retryable", states.includes("error") && errors.some((e) => e.retryable));
  c.sendRunContext(snap(3, SRC3), run3); // offline Run
  assert("(a) offline Run is not transmitted", drain().length === 0);
  await c.connect(tok("B"), problem); // reconnect, fresh token, SAME client
  const after = drain();
  const evidence = after.find((m) => m.text.includes("[RUN v3]"));
  assert("(a) restored evidence is the v3 2/4 Run (version+source+cases together)",
    !!evidence && evidence.text.includes("2/4") && evidence.text.includes("PURPLE_ARMADILLO") && /Failed: c1/.test(evidence.text), evidence?.text?.slice(0, 80));
  const follow = after.filter((m) => m.tc);
  assert("(a) exactly one follow-up, grounded in v3 2/4 (never 4/4)",
    follow.length === 1 && follow[0].text.includes("[RUN v3]") && follow[0].text.includes("2/4"), JSON.stringify(follow.map((f) => f.text.slice(0, 40))));
  assert("(a) stale v2 4/4 is not restored as the latest run", !after.some((m) => m.text.includes("4/4")));
}

// (b) Double reconnect + a late close from a superseded socket.
{
  const c = createLiveClient({ turnSeed: 0 });
  const turns = []; const states = [];
  c.onTurn((t) => turns.push(t)); c.onState((s) => states.push(s));
  await c.connect(tok("A"), problem);
  const p1 = c.connect(tok("B"), problem);
  const p2 = c.connect(tok("C"), problem); // supersedes p1 while it is in flight
  await Promise.all([p1, p2]);
  const latest = conns()[conns().length - 1];
  const superseded = conns()[conns().length - 2];
  assert("(b) only the latest socket stays open", latest.session.closed === false && superseded.session.closed === true);
  const base = turns.length;
  latest.callbacks.onmessage({ serverContent: { outputTranscription: { text: "Live question?", finished: true } } });
  latest.callbacks.onmessage({ serverContent: { turnComplete: true } });
  superseded.callbacks.onmessage({ serverContent: { outputTranscription: { text: "GHOST", finished: true } } });
  superseded.callbacks.onmessage({ serverContent: { turnComplete: true } });
  const added = turns.slice(base);
  assert("(b) only the active socket adds a turn; the stale one is ignored (no dup callbacks)",
    added.length === 1 && added[0].text === "Live question?", JSON.stringify(added.map((t) => t.text)));
  const sBefore = states.length;
  superseded.callbacks.onclose({ reason: "late close" });
  assert("(b) a late close from a superseded socket does not flip to error", !states.slice(sBefore).includes("error"));
  c.syncCode(snap(4, "def contains_duplicate(nums):\n    return len(set(nums)) != len(nums)"));
  assert("(b) the active connection still sends (to the latest socket)", drain().some((m) => m.conn === latest.session.id));
}

// (c) Token/connect failure on reconnect, then a successful retry.
{
  const c = createLiveClient({ turnSeed: 0 });
  const states = [];
  c.onState((s) => states.push(s));
  await c.connect(tok("A"), problem);
  c.sendRunContext(snap(5, "def contains_duplicate(nums):\n    return True  # v5"), { sessionId: "s", problemId: "contains-duplicate", codeVersion: 5, ranAt: new Date().toISOString(), durationMs: 10, status: "completed", passed: 1, total: 4, cases: [] });
  lastCb().onmessage({ serverContent: { turnComplete: true } });
  drain();
  lastCb().onclose({ reason: "drop" });
  globalThis.__FAIL_CONNECT__ = true;
  let threw = false;
  try { await c.connect(tok("bad"), problem); } catch { threw = true; }
  assert("(c) a failed reconnect surfaces an error and throws", threw && states.includes("error"));
  globalThis.__FAIL_CONNECT__ = false;
  await c.connect(tok("good"), problem);
  assert("(c) the Run survived the failed attempt and restores on retry", drain().some((m) => m.text.includes("[RUN v5]")));
}

// (e) End during an in-flight reconnect: no restore, old events cannot enter, evidence cleared.
{
  const c = createLiveClient({ turnSeed: 0 });
  const turns = [];
  c.onTurn((t) => turns.push(t));
  await c.connect(tok("A"), problem);
  c.sendRunContext(snap(2, SRC2), run2);
  lastCb().onmessage({ serverContent: { turnComplete: true } });
  drain();
  lastCb().onclose({ reason: "drop" });
  const p = c.connect(tok("B"), problem); // in-flight reconnect
  c.end(); // Finish during reconnect
  await p;
  assert("(e) End during reconnect restores nothing", drain().length === 0);
  const inflight = conns()[conns().length - 1].callbacks;
  const before = turns.length;
  inflight.onmessage({ serverContent: { outputTranscription: { text: "too late", finished: true } } });
  inflight.onmessage({ serverContent: { turnComplete: true } });
  assert("(e) late events from the ended socket add no turns", turns.length === before);
  await c.connect(tok("C"), problem); // reconnect again on the ended client
  assert("(e) cleared Run evidence does not replay", drain().every((m) => !m.text.includes("[RUN ")));
}

console.log(`\n${fails === 0 ? "ALL RECONNECT CHECKS PASSED" : fails + " CHECK(S) FAILED"}`);
process.exit(fails === 0 ? 0 : 1);
