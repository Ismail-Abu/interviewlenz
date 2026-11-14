// Dev-only: deterministic check of the "one outstanding question" gate in
// lib/live.ts (not shipped). Bundles the real BrowserLiveClient with
// @google/genai stubbed to capture every sendClientContent, then simulates
// interviewer turns (which set an outstanding question) and student turns (the
// only thing that answers it), and asserts a Run that arrives while a question
// is outstanding is held, not asked, until the student answers.
//
// Run: node dev/live-stages-check.mjs

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

const STUB = `
export const Modality = { AUDIO: "AUDIO", TEXT: "TEXT" };
export class GoogleGenAI {
  constructor() {
    this.live = { connect: async ({ callbacks }) => {
      globalThis.__CB__ = callbacks;
      if (callbacks.onopen) callbacks.onopen();
      return { sendClientContent: (m) => { globalThis.__SENT__.push(m); }, sendRealtimeInput: () => {}, close: () => {} };
    } };
  }
}
`;
const dir = mkdtempSync(join(tmpdir(), "live-stages-"));
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

const problem = { id: "contains-duplicate", title: "Contains Duplicate", prompt: "p", examples: [], constraints: [], functionName: "contains_duplicate", starterCode: "x", cases: [] };
const token = { token: "t", model: "m", expiresAt: "2099-01-01T00:00:00Z" };
const snap = (v) => ({ codeVersion: v, source: `def contains_duplicate(nums):\n    return ${v}`, at: new Date().toISOString() });
const run = (v) => ({ sessionId: "s", problemId: "contains-duplicate", codeVersion: v, ranAt: new Date().toISOString(), durationMs: 10, status: "completed", cases: [], passed: 1, total: 1 });
const interviewerAsks = (text) => { globalThis.__CB__.onmessage({ serverContent: { outputTranscription: { text, finished: true } } }); globalThis.__CB__.onmessage({ serverContent: { turnComplete: true } }); };
const studentAnswers = (text) => globalThis.__CB__.onmessage({ serverContent: { inputTranscription: { text, finished: true } } });

function drain() {
  const items = globalThis.__SENT__.map((m) => {
    const text = m.turns?.[0]?.parts?.[0]?.text ?? "";
    return { marks: [...text.matchAll(/\[(CODE|RUN) v(\d+)\]/g)].map((x) => `${x[1]} v${x[2]}`), tc: !!m.turnComplete };
  });
  globalThis.__SENT__.length = 0;
  return items;
}
const sig = (items) => JSON.stringify(items);
let fails = 0;
function check(label, got, want) {
  const ok = sig(got) === sig(want);
  if (!ok) fails += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  console.log(`      sent: ${sig(got)}`);
  if (!ok) console.log(`      want: ${sig(want)}`);
}
function assert(label, cond) { if (!cond) fails += 1; console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); }

async function fresh() {
  const c = createLiveClient();
  await c.connect(token, problem);
  drain();
  return c;
}

// 1) Interviewer asks -> a Run while outstanding is held (no ask); it is raised
//    only after the student answers.
let c = await fresh();
c.syncCode(snap(1));
check("1a initial sync", drain(), [{ marks: ["CODE v1"], tc: false }]);
interviewerAsks("Explain your approach.");           // outstanding = true
c.sendRunContext(snap(2), run(2));                    // extra Run while outstanding
const held = drain();
assert("1b Run while outstanding does NOT ask (no tc:true)", held.every((i) => i.tc === false));
console.log(`      sent while outstanding: ${sig(held)}`);
studentAnswers("It is a nested loop, so linear.");    // answers -> outstanding false
check("1c held Run is raised as one ask after the answer", drain(), [{ marks: ["RUN v2"], tc: true }]);

// 2) Two Runs while answering -> still only one outstanding question, one ask.
c = await fresh();
interviewerAsks("What is the worst case?");           // outstanding = true
c.sendRunContext(snap(3), run(3));
c.sendRunContext(snap(4), run(4));                    // a second Run while still outstanding
const held2 = drain();
assert("2a two Runs while answering -> no ask yet", held2.every((i) => i.tc === false));
const answered = (studentAnswers("Worst case is quadratic."), drain());
const asks = answered.filter((i) => i.tc === true);
assert("2b exactly one spoken-turn request after the answer", asks.length === 1);
console.log(`      after answer: ${sig(answered)}`);

// 3) An edit (syncCode) does not count as an answer: outstanding stays, Run stays held.
c = await fresh();
interviewerAsks("Why a set?");                        // outstanding = true
c.syncCode(snap(5));                                  // an edit, not an answer
c.sendRunContext(snap(5), run(5));
const afterEdit = drain();
assert("3a edit+Run while outstanding -> no ask", afterEdit.every((i) => i.tc === false));
studentAnswers("A set gives average O(1) membership.");
const afterAns = drain();
assert("3b ask only after the spoken answer", afterAns.filter((i) => i.tc === true).length === 1);
console.log(`      after answer: ${sig(afterAns)}`);

console.log(`\n${fails === 0 ? "ALL STAGE-GATE CHECKS PASSED" : fails + " CHECK(S) FAILED"}`);
process.exit(fails === 0 ? 0 : 1);
