// Dev-only regression check for disconnect/send-failure handling in lib/live.ts
// (not shipped): a Run that completes while disconnected is preserved, the
// disconnected state is exposed, the evidence is restored on reconnect, and all
// of it is cleared on End.
//
// Run: node dev/live-disconnect-check.mjs

import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
globalThis.btoa ??= (s) => Buffer.from(s, "binary").toString("base64");
globalThis.atob ??= (s) => Buffer.from(s, "base64").toString("binary");
globalThis.AudioContext ??= class { currentTime = 0; destination = {}; close() {} };
globalThis.__SENT__ = [];
globalThis.__CB__ = null;
globalThis.__FAIL_SEND__ = false;

const STUB = `
export const Modality = { AUDIO: "AUDIO", TEXT: "TEXT" };
export class GoogleGenAI {
  constructor() {
    this.live = { connect: async ({ callbacks }) => {
      globalThis.__CB__ = callbacks;
      if (callbacks.onopen) callbacks.onopen();
      return {
        sendClientContent: (m) => { const __t = m?.turns?.[0]?.parts?.[0]?.text ?? ""; if (__t.startsWith("[START]")) { queueMicrotask(() => { callbacks.onmessage({ serverContent: { turnComplete: true } }); callbacks.onmessage({ serverContent: { inputTranscription: { text: "Opening answered.", finished: true } } }); }); return; } if (globalThis.__FAIL_SEND__) throw new Error("send failed"); globalThis.__SENT__.push(m); },
        sendRealtimeInput: () => {},
        close: () => {},
      };
    } };
  }
}
`;
const dir = mkdtempSync(join(tmpdir(), "live-disconnect-"));
const stubPath = join(dir, "genai-stub.mjs");
writeFileSync(stubPath, STUB);
const out = await build({ entryPoints: [join(ROOT, "lib", "live.ts")], bundle: true, format: "esm", platform: "node", write: false, alias: { "@google/genai": stubPath }, logLevel: "error" });
const bundlePath = join(dir, "live.bundle.mjs");
writeFileSync(bundlePath, out.outputFiles[0].text);
const { createLiveClient } = await import(pathToFileURL(bundlePath).href);

const problem = { id: "contains-duplicate", title: "Contains Duplicate", prompt: "p", examples: [], constraints: [], functionName: "contains_duplicate", starterCode: "x", cases: [] };
const token = { token: "t", model: "m", expiresAt: "2099-01-01T00:00:00Z" };
const snap = (v) => ({ codeVersion: v, source: `def contains_duplicate(nums):\n    return ${v}`, at: new Date().toISOString() });
const completed = (v, p, t) => ({ sessionId: "s", problemId: "contains-duplicate", codeVersion: v, ranAt: new Date().toISOString(), durationMs: 10, status: "completed", passed: p, total: t, cases: [] });
const drain = () => { const i = globalThis.__SENT__.map((m) => ({ text: m.turns?.[0]?.parts?.[0]?.text ?? "", tc: !!m.turnComplete })); globalThis.__SENT__.length = 0; return i; };
let fails = 0;
const assert = (label, cond, extra) => { if (!cond) fails += 1; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || extra === undefined ? "" : `  (${extra})`}`); };

// === Socket-close path =====================================================
const states = [];
const errors = [];
const c = createLiveClient({ followupSettleMs: 0 });
c.onState((s) => states.push(s));
c.onError((e) => errors.push(e));
await c.connect(token, problem);
c.sendRunContext(snap(2), completed(2, 4, 4)); // v2 asked
globalThis.__CB__.onmessage({ serverContent: { turnComplete: true } }); // interviewer turn ends
drain();

const cb1 = globalThis.__CB__;
cb1.onclose({ reason: "network blip" }); // controlled socket close
assert("disconnect exposes the 'error' state", states.includes("error"));
assert("disconnect emits a retryable error", errors.some((e) => e.retryable === true));

c.sendRunContext(snap(3), completed(3, 2, 4)); // Run completes locally while disconnected
const whileDown = drain();
assert("Run while disconnected is NOT transmitted", whileDown.length === 0, JSON.stringify(whileDown));

await c.connect(token, problem); // reconnect (same client instance)
const afterReconnect = drain();
assert("reconnect restores the v3 2/4 evidence", afterReconnect.some((m) => !m.tc && m.text.includes("[RUN v3]") && m.text.includes("2/4")));
assert("reconnect asks one grounded follow-up about v3", afterReconnect.some((m) => m.tc && m.text.includes("[RUN v3]") && m.text.includes("2/4")));

c.end();
await c.connect(token, problem); // reconnect after End
const afterEnd = drain();
assert("End clears preserved evidence (nothing restored next connect)", afterEnd.every((m) => !m.text.includes("[RUN ")), JSON.stringify(afterEnd));

// === Send-failure path =====================================================
globalThis.__SENT__.length = 0;
const states2 = [];
const d = createLiveClient({ followupSettleMs: 0 });
d.onState((s) => states2.push(s));
await d.connect(token, problem);
drain();
globalThis.__FAIL_SEND__ = true;
d.sendRunContext(snap(7), completed(7, 1, 4)); // send throws
assert("send failure exposes the 'error' state", states2.includes("error"));
globalThis.__FAIL_SEND__ = false;
await d.connect(token, problem); // reconnect
const afterReconnect2 = drain();
assert("send failure preserved the Run; reconnect restores v7 1/4", afterReconnect2.some((m) => m.text.includes("[RUN v7]") && m.text.includes("1/4")));

console.log(`\n${fails === 0 ? "ALL DISCONNECT CHECKS PASSED" : fails + " CHECK(S) FAILED"}`);
process.exit(fails === 0 ? 0 : 1);
