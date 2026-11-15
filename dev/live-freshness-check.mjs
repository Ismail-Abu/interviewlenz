// Dev-only check for live code freshness (not shipped).
//
// Part A drives lib/codeSync.ts on a virtual clock and MEASURES how long the
// newest editor version waits before it is written. The bug this guards: the
// original scheduler was a trailing debounce reset on every keystroke, so while
// the student typed continuously nothing was sent at all until they stopped for
// two seconds.
//
// Part B bundles the real BrowserLiveClient with @google/genai stubbed and
// checks that "currently in the editor" and "last run" stay separate facts, and
// that a late older Run cannot overwrite a newer buffer.
//
// Synthetic source only; no key, network, audio, or private code.
//
// Run: node --experimental-strip-types dev/live-freshness-check.mjs

import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
let fails = 0;
const assert = (label, cond, extra) => {
  if (!cond) fails += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || extra === undefined ? "" : `  (${extra})`}`);
};

// ---------------------------------------------------------------- virtual clock
function makeClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map();
  const clock = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const h = ++seq;
      timers.set(h, { at: now + ms, fn });
      return h;
    },
    clearTimeout: (h) => timers.delete(h),
  };
  function advance(ms) {
    const end = now + ms;
    for (;;) {
      let next = null;
      for (const [h, e] of timers) if (e.at <= end && (next === null || e.at < timers.get(next).at)) next = h;
      if (next === null) break;
      const e = timers.get(next);
      timers.delete(next);
      now = e.at;
      e.fn();
    }
    now = end;
  }
  return { clock, advance, time: () => now };
}

const { CodeSyncScheduler, DEFAULT_SYNC_INTERVAL_MS } = await import(
  pathToFileURL(join(ROOT, "lib", "codeSync.ts")).href
);

console.log(`== A. Scheduling (interval ${DEFAULT_SYNC_INTERVAL_MS} ms, virtual clock)`);

// A1 leading send
{
  const { clock } = makeClock();
  const sends = [];
  const s = new CodeSyncScheduler(() => sends.push(clock.now()), DEFAULT_SYNC_INTERVAL_MS, clock);
  s.schedule();
  assert("A1 first edit after a quiet period is sent immediately", sends.length === 1 && sends[0] === 0);
}

// A2 continuous typing: every edit reaches a send within the interval, and the
// message count stays far below the keystroke count.
{
  const { clock, advance, time } = makeClock();
  const sends = [];
  const s = new CodeSyncScheduler(() => sends.push(time()), DEFAULT_SYNC_INTERVAL_MS, clock);

  const edits = [];
  for (let i = 0; i < 100; i++) {
    s.schedule();
    edits.push(time());
    advance(20); // a keystroke every 20 ms for 2 s straight
  }
  advance(DEFAULT_SYNC_INTERVAL_MS); // let the final flush land

  let worst = 0;
  for (const e of edits) {
    const next = sends.find((t) => t >= e);
    if (next === undefined) {
      worst = Infinity;
      break;
    }
    worst = Math.max(worst, next - e);
  }
  assert(
    `A2 every edit written within ${DEFAULT_SYNC_INTERVAL_MS} ms while typing continuously`,
    worst <= DEFAULT_SYNC_INTERVAL_MS,
    `worst wait ${worst} ms`,
  );
  assert("A2 coalesced, not one message per keystroke", sends.length < 15, `${sends.length} sends for 100 edits`);
  console.log(`      measured: 100 edits over 2000 ms -> ${sends.length} writes, worst wait ${worst} ms`);
}

// A3 a single edit then an immediate question: the edit is already out.
{
  const { clock, time } = makeClock();
  const sends = [];
  const s = new CodeSyncScheduler(() => sends.push(time()), DEFAULT_SYNC_INTERVAL_MS, clock);
  s.schedule();
  assert("A3 single edit is written before the student can finish asking", sends.length === 1 && sends[0] === 0);
}

// A4 paste (one large edit) behaves like any other edit: immediate.
{
  const { clock, advance, time } = makeClock();
  const sends = [];
  const s = new CodeSyncScheduler(() => sends.push(time()), DEFAULT_SYNC_INTERVAL_MS, clock);
  s.schedule();
  advance(1000);
  s.schedule(); // paste after a pause
  assert("A4 paste after a pause is sent immediately", sends.length === 2 && sends[1] === 1000);
}

// A5 the wait is bounded: no edit can wait longer than the interval, ever.
{
  const { clock, advance, time } = makeClock();
  const sends = [];
  const s = new CodeSyncScheduler(() => sends.push(time()), DEFAULT_SYNC_INTERVAL_MS, clock);
  s.schedule();
  for (let i = 0; i < 50; i++) {
    advance(5);
    s.schedule();
  }
  advance(DEFAULT_SYNC_INTERVAL_MS);
  const gaps = sends.slice(1).map((t, i) => t - sends[i]);
  assert("A5 no gap between writes exceeds the interval", gaps.every((g) => g <= DEFAULT_SYNC_INTERVAL_MS), `gaps ${gaps}`);
}

// A6 one pending flush at a time (bounded, no growing queue).
{
  const { clock, advance } = makeClock();
  let n = 0;
  const s = new CodeSyncScheduler(() => n++, DEFAULT_SYNC_INTERVAL_MS, clock);
  s.schedule();
  s.schedule();
  s.schedule();
  s.schedule();
  assert("A6 edits inside the window coalesce into one pending flush", s.pending === true && n === 1);
  advance(DEFAULT_SYNC_INTERVAL_MS);
  assert("A6 the window produces exactly one more write", n === 2, `${n} writes`);
}

// A7 reset() (connect / reconnect) reopens the window.
{
  const { clock, time } = makeClock();
  const sends = [];
  const s = new CodeSyncScheduler(() => sends.push(time()), DEFAULT_SYNC_INTERVAL_MS, clock);
  s.schedule();
  s.schedule(); // books a flush
  s.reset();
  assert("A7 reset drops the pending flush", s.pending === false);
  s.schedule();
  assert("A7 first edit after reset is immediate", sends.length === 2 && sends[1] === 0);
}

// A8 flushNow: a completed line must go out at once, even mid-window, and the
// throttle must still hold afterwards (one finished line != one message per key).
{
  const { clock, advance, time } = makeClock();
  const sends = [];
  const s = new CodeSyncScheduler(() => sends.push(time()), DEFAULT_SYNC_INTERVAL_MS, clock);
  s.schedule();            // leading send at 0
  advance(40);
  s.schedule();            // inside the window: books a flush, does not send
  assert("A8 mid-window typing does not send immediately", sends.length === 1);
  advance(10);
  s.flushNow();            // a line was completed
  assert("A8 a completed line is sent at once, mid-window", sends.length === 2 && sends[1] === 50);
  assert("A8 flushNow clears the pending flush", s.pending === false);
  advance(5);
  s.schedule();
  assert("A8 the throttle still holds right after a flush", sends.length === 2);
  advance(DEFAULT_SYNC_INTERVAL_MS);
  assert("A8 the next window delivers it", sends.length === 3);
}

// ------------------------------------------------- Part B: the client contract
console.log("\n== B. Editor buffer vs last run (real BrowserLiveClient, provider stubbed)");

globalThis.btoa ??= (s) => Buffer.from(s, "binary").toString("base64");
globalThis.atob ??= (s) => Buffer.from(s, "base64").toString("binary");
globalThis.AudioContext ??= class {
  currentTime = 0;
  destination = {};
  close() {}
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
      return { sendClientContent: (m) => { const t = m?.turns?.[0]?.parts?.[0]?.text ?? ""; if (t.startsWith("[START]")) { queueMicrotask(() => { callbacks.onmessage({ serverContent: { turnComplete: true } }); callbacks.onmessage({ serverContent: { inputTranscription: { text: "Opening answered.", finished: true } } }); }); return; } globalThis.__SENT__.push(m); }, sendRealtimeInput: () => {}, close: () => {} };
    } };
  }
}
`;
const dir = mkdtempSync(join(tmpdir(), "live-freshness-"));
const stubPath = join(dir, "genai-stub.mjs");
writeFileSync(stubPath, STUB);
const out = await build({
  entryPoints: [join(ROOT, "lib", "live.ts")],
  bundle: true, format: "esm", platform: "node", write: false,
  alias: { "@google/genai": stubPath }, logLevel: "error",
});
const bundlePath = join(dir, "live.bundle.mjs");
writeFileSync(bundlePath, out.outputFiles[0].text);
const { createLiveClient } = await import(pathToFileURL(bundlePath).href);

const problem = {
  id: "contains-duplicate", title: "Contains Duplicate", prompt: "p", examples: [], constraints: [],
  functionName: "contains_duplicate", starterCode: "x", cases: [],
};
const token = { token: "t", model: "m", expiresAt: "2099-01-01T00:00:00Z" };
// Synthetic, clearly-marked source: never real student code.
const snap = (v) => ({
  codeVersion: v,
  source: `def contains_duplicate(nums):\n    return ${v}  # SYNTHETIC_V${v}`,
  at: new Date().toISOString(),
});
const completed = (v, passed, total) => ({
  sessionId: "s", problemId: "contains-duplicate", codeVersion: v, ranAt: new Date().toISOString(),
  durationMs: 10 * v, status: "completed", passed, total, cases: [],
});
const cb = () => globalThis.__CB__;
// A Run requests one spoken follow-up, which makes the model's turn active;
// silent context is held until that turn ends. Mirror that boundary.
const endModelTurn = () => cb().onmessage({ serverContent: { turnComplete: true } });
const drain = () => {
  const items = globalThis.__SENT__.map((m) => ({ text: m.turns?.[0]?.parts?.[0]?.text ?? "", tc: !!m.turnComplete }));
  globalThis.__SENT__.length = 0;
  return items;
};

const c = createLiveClient({ followupSettleMs: 0 });
await c.connect(token, problem);
await new Promise((r) => setTimeout(r, 0));
drain();

// B1 a silent sync asks nothing.
c.syncCode(snap(2));
const b1 = drain();
assert("B1 syncCode writes the buffer silently (no question)", b1.length > 0 && b1.every((m) => !m.tc));
assert("B1 the written buffer is the version just synced", b1.some((m) => m.text.includes("SYNTHETIC_V2")));

// B2 v3 runs 2/4, then the student edits to v4 without running.
c.sendRunContext(snap(3), completed(3, 2, 4));
endModelTurn();
drain();
c.syncCode(snap(4));
const b2 = drain().map((m) => m.text).join("\n");
assert("B2 the unrun v4 buffer reaches the model", b2.includes("SYNTHETIC_V4"));
assert("B2 v4 is labelled as not run yet", /\[CODE v4\][^\n]*not run yet/.test(b2));
assert("B2 no run is attributed to v4", !b2.includes("[RUN v4]"));

// B3 a stale v2 Run completing late must not overwrite the v4 buffer.
c.sendRunContext(snap(2), completed(2, 4, 4));
endModelTurn();
const b3 = drain().map((m) => m.text).join("\n");
assert("B3 a late older Run is ignored, not written", !b3.includes("[RUN v2]"), b3.slice(0, 80));
c.syncCode(snap(5));
const b3b = drain().map((m) => m.text).join("\n");
assert("B3 the buffer still advances after the stale Run", b3b.includes("SYNTHETIC_V5"));

console.log(`\n${fails === 0 ? "live-freshness-check: all checks passed" : `live-freshness-check: ${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
