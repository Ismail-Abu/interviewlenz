// Dev-only: deterministic check of the live-context queue in lib/live.ts (not
// shipped). It bundles the REAL BrowserLiveClient with @google/genai stubbed so
// every sendClientContent is captured, then drives connect / syncCode /
// sendRunContext and simulated interviewer turns, printing the exact message
// order (marks = [CODE vN | RUN vN], turnComplete, historical note present).
//
// Run: node dev/live-queue-check.mjs   (needs the esbuild + @google/genai devdeps)

import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Minimal browser globals so the module imports in Node. This check only drives
// the queue path (never audio/mic), so these are never really exercised.
globalThis.btoa ??= (s) => Buffer.from(s, "binary").toString("base64");
globalThis.atob ??= (s) => Buffer.from(s, "base64").toString("binary");
globalThis.AudioContext ??= class { currentTime = 0; destination = {}; close() {} };

globalThis.__SENT__ = [];
globalThis.__CB__ = null;

const STUB = `
export const Modality = { AUDIO: "AUDIO", TEXT: "TEXT" };
export class GoogleGenAI {
  constructor() {
    this.live = {
      connect: async ({ callbacks }) => {
        globalThis.__CB__ = callbacks;
        if (callbacks.onopen) callbacks.onopen();
        return {
          sendClientContent: (m) => { const __t = m?.turns?.[0]?.parts?.[0]?.text ?? ""; if (__t.startsWith("[START]")) { queueMicrotask(() => { callbacks.onmessage({ serverContent: { turnComplete: true } }); callbacks.onmessage({ serverContent: { inputTranscription: { text: "Opening answered.", finished: true } } }); }); return; } globalThis.__SENT__.push(m); },
          sendRealtimeInput: () => {},
          close: () => {},
        };
      },
    };
  }
}
`;

const dir = mkdtempSync(join(tmpdir(), "live-queue-"));
const stubPath = join(dir, "genai-stub.mjs");
writeFileSync(stubPath, STUB);

const out = await build({
  entryPoints: [join(ROOT, "lib", "live.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  alias: { "@google/genai": stubPath },
  logLevel: "error",
});
const bundlePath = join(dir, "live.bundle.mjs");
writeFileSync(bundlePath, out.outputFiles[0].text);
const { createLiveClient } = await import(pathToFileURL(bundlePath).href);

// --- drivers ---------------------------------------------------------------
const problem = {
  id: "contains-duplicate", title: "Contains Duplicate", prompt: "Return True if any integer occurs more than once.",
  examples: [], constraints: [], functionName: "contains_duplicate",
  starterCode: "def contains_duplicate(nums):\n    pass", cases: [],
};
const token = { token: "t", model: "m", expiresAt: "2099-01-01T00:00:00Z" };
const snap = (v, src) => ({ codeVersion: v, source: src ?? `def contains_duplicate(nums):\n    return ${v}  # v${v}`, at: new Date().toISOString() });
const run = (v) => ({ sessionId: "s", problemId: "contains-duplicate", codeVersion: v, ranAt: new Date().toISOString(), durationMs: 10, status: "completed", cases: [], passed: 1, total: 1 });
const speak = () => globalThis.__CB__.onmessage({ serverContent: { outputTranscription: { text: "..." } } });
const turnComplete = () => globalThis.__CB__.onmessage({ serverContent: { turnComplete: true } });

function drain() {
  const items = globalThis.__SENT__.map((m) => {
    const text = m.turns?.[0]?.parts?.[0]?.text ?? "";
    return {
      marks: [...text.matchAll(/\[(CODE|RUN) v(\d+)\]/g)].map((x) => `${x[1]} v${x[2]}`),
      turnComplete: !!m.turnComplete,
      historical: /These results are from version/.test(text),
    };
  });
  globalThis.__SENT__.length = 0;
  return items;
}
const sig = (items) => JSON.stringify(items.map((i) => ({ m: i.marks, tc: i.turnComplete, ...(i.historical ? { h: true } : {}) })));

let fails = 0;
function check(label, items, expectedSig) {
  const got = sig(items);
  const ok = got === expectedSig;
  if (!ok) fails += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  console.log(`      sent: ${got}`);
  if (!ok) console.log(`      want: ${expectedSig}`);
}

async function fresh() {
  const c = createLiveClient({ followupSettleMs: 0 });
  await c.connect(token, problem);
  drain();
  return c;
}

// 1) Initial sync — silent context, no question.
let c = await fresh();
c.syncCode(snap(1));
check("1 initial sync: syncCode(v1) -> one silent CODE v1", drain(), JSON.stringify([{ m: ["CODE v1"], tc: false }]));

// 2) Repeated pauses while idle -> one silent send per version. Since the
// interviewer now offers at most one remark per edited version, v2's silent
// write is followed by that remark; v3's write lands at the next boundary.
c.syncCode(snap(2));
check("2a idle pause v2 -> silent send, then one remark", drain(),
  JSON.stringify([{ m: ["CODE v2"], tc: false }, { m: ["CODE v2"], tc: true }]));
globalThis.__CB__.onmessage({ serverContent: { turnComplete: true } }); // remark ends
drain();
c.syncCode(snap(3));
check("2b next edit v3 -> silent send, then one remark", drain(),
  JSON.stringify([{ m: ["CODE v3"], tc: false }, { m: ["CODE v3"], tc: true }]));
globalThis.__CB__.onmessage({ serverContent: { turnComplete: true } });
drain();

// 3) Edits while the interviewer speaks -> queued, coalesced, flushed at boundary.
speak();
c.syncCode(snap(4));
c.syncCode(snap(5));
check("3a edits v4,v5 while speaking -> nothing sent mid-turn", drain(), JSON.stringify([]));
turnComplete();
check("3b at turnComplete -> single silent CODE v5 (v4 coalesced)", drain(), JSON.stringify([{ m: ["CODE v5"], tc: false }]));

// 4) A v4 Run completing after a v5 edit -> v4 historical, v5 current. Evidence
//    (silent) is delivered separately from the spoken follow-up (ask).
c = await fresh();
c.syncCode(snap(5));
check("4a buffer synced to v5", drain(), JSON.stringify([{ m: ["CODE v5"], tc: false }]));
c.sendRunContext(snap(4), run(4));
check("4b late v4 Run -> historical evidence (silent), then one follow-up (ask)", drain(),
  JSON.stringify([{ m: ["RUN v4"], tc: false, h: true }, { m: ["RUN v4"], tc: true }]));

// 4') Same, but v5 edit and v4 Run both arrive during a turn, and the interviewer
//     then completes a spoken turn -> a question is outstanding, so the evidence
//     flushes at the boundary while the follow-up waits for the student.
c = await fresh();
speak();
c.syncCode(snap(5));
c.sendRunContext(snap(4), run(4));
check("4c v5 edit + v4 Run queued during a turn -> nothing mid-turn", drain(), JSON.stringify([]));
turnComplete();
check("4d at boundary: historical v4 + current v5 evidence (silent); ask deferred while outstanding", drain(),
  JSON.stringify([{ m: ["RUN v4", "CODE v5"], tc: false, h: true }]));

// 5) An edit and a Run on the same version: evidence once (silent) then one
//    follow-up; the run version is never also sent as a "not run yet" buffer.
c = await fresh();
c.syncCode(snap(5));
drain();
c.sendRunContext(snap(5), run(5));
check("5 edit v5 then Run v5 -> evidence (silent) then one ask, no duplicate CODE v5", drain(),
  JSON.stringify([{ m: ["RUN v5"], tc: false }, { m: ["RUN v5"], tc: true }]));

// 6) Clear queued work on session end.
c = await fresh();
speak();
c.syncCode(snap(9));
drain();
c.end();
await c.connect(token, problem);
drain();
c.syncCode(snap(1));
check("6 end clears queue; reconnect sends only v1 (no stale v9)", drain(), JSON.stringify([{ m: ["CODE v1"], tc: false }]));

console.log(`\n${fails === 0 ? "ALL QUEUE CHECKS PASSED" : fails + " CHECK(S) FAILED"}`);
process.exit(fails === 0 ? 0 : 1);
