// Dev-only regression check for attempt-scoped transcript IDs in lib/live.ts
// (not shipped). Within one attempt, IDs must stay unique and resolve 1:1
// across (i) reconnecting the SAME client and (ii) End -> Start with a FRESH
// client seeded via createLiveClient({ turnSeed }). A new attempt (Retry) may
// restart numbering.
//
// Run: node dev/live-turnid-check.mjs

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

const STUB = `
export const Modality = { AUDIO: "AUDIO", TEXT: "TEXT" };
export class GoogleGenAI {
  constructor() {
    this.live = { connect: async ({ callbacks }) => {
      const session = { closed: false, sendClientContent: () => {}, sendRealtimeInput: () => {}, close: () => { session.closed = true; } };
      globalThis.__CONNECTS__.push({ callbacks, session });
      if (callbacks.onopen) callbacks.onopen();
      return session;
    } };
  }
}
`;
const dir = mkdtempSync(join(tmpdir(), "live-turnid-"));
const stubPath = join(dir, "genai-stub.mjs");
writeFileSync(stubPath, STUB);
const out = await build({ entryPoints: [join(ROOT, "lib", "live.ts")], bundle: true, format: "esm", platform: "node", write: false, alias: { "@google/genai": stubPath }, logLevel: "error" });
const bundlePath = join(dir, "live.bundle.mjs");
writeFileSync(bundlePath, out.outputFiles[0].text);
const { createLiveClient } = await import(pathToFileURL(bundlePath).href);

const problem = { id: "contains-duplicate", title: "Contains Duplicate", prompt: "p", examples: [], constraints: [], functionName: "contains_duplicate", starterCode: "x", cases: [] };
const tok = (n) => ({ token: `t${n}`, model: "m", expiresAt: "2099-01-01T00:00:00Z" });
const lastCb = () => globalThis.__CONNECTS__[globalThis.__CONNECTS__.length - 1].callbacks;
const student = (text) => lastCb().onmessage({ serverContent: { inputTranscription: { text, finished: true } } });
const interviewer = (text) => { lastCb().onmessage({ serverContent: { outputTranscription: { text, finished: true } } }); lastCb().onmessage({ serverContent: { turnComplete: true } }); };
let fails = 0;
const assert = (label, cond, extra) => { if (!cond) fails += 1; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || extra === undefined ? "" : `  (${extra})`}`); };

// One attempt across a reconnect and an End -> Start with a fresh seeded client.
const turns = [];
const attach = (c) => c.onTurn((t) => turns.push({ id: t.id, speaker: t.speaker, text: t.text }));

const c1 = createLiveClient({ turnSeed: 0 });
attach(c1);
await c1.connect(tok("A"), problem);
student("Here is my approach."); // t1
interviewer("Why that approach?"); // t2

await c1.connect(tok("B"), problem); // reconnect SAME client
interviewer("And the complexity?"); // t3 — must continue, not restart at t1
assert("reconnect on the same client continues numbering", turns.map((t) => t.id).join(",") === "t1,t2,t3", turns.map((t) => t.id).join(","));

c1.end();
const c2 = createLiveClient({ turnSeed: turns.length }); // End -> Start, same attempt: seed with turns so far (3)
attach(c2);
await c2.connect(tok("C"), problem);
student("What about an empty list?"); // t4

const ids = turns.map((t) => t.id);
assert("all IDs are unique", new Set(ids).size === ids.length, ids.join(","));
assert("IDs are sequential t1..t4 across reconnect and End->Start", ids.join(",") === "t1,t2,t3,t4", ids.join(","));
const counts = ids.reduce((m, id) => ((m[id] = (m[id] || 0) + 1), m), {});
assert("each report turn reference resolves to exactly one turn", Object.values(counts).every((n) => n === 1));

// A new attempt (Retry) is a fresh client seeded at 0 and may restart numbering.
const r = createLiveClient({ turnSeed: 0 });
const rTurns = [];
r.onTurn((t) => rTurns.push(t.id));
await r.connect(tok("D"), problem);
student("New attempt, fresh start."); // t1 again, allowed
assert("a new attempt (turnSeed 0) restarts numbering at t1", rTurns[0] === "t1", rTurns.join(","));

console.log(`\n${fails === 0 ? "ALL TURN-ID CHECKS PASSED" : fails + " CHECK(S) FAILED"}`);
process.exit(fails === 0 ? 0 : 1);
