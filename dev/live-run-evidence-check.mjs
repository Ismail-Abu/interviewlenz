// Dev-only regression check for the Run-evidence vs spoken-follow-up split and
// partial-transcript safety in lib/live.ts (not shipped). Bundles the real
// BrowserLiveClient with @google/genai stubbed to capture every
// sendClientContent (text + turnComplete), and drives the exact browser-evidence
// scenario: v2 4/4 asked, then v3 runs 2/4 while a question is outstanding.
//
// Run: node dev/live-run-evidence-check.mjs

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
const dir = mkdtempSync(join(tmpdir(), "live-evidence-"));
const stubPath = join(dir, "genai-stub.mjs");
writeFileSync(stubPath, STUB);
const out = await build({ entryPoints: [join(ROOT, "lib", "live.ts")], bundle: true, format: "esm", platform: "node", write: false, alias: { "@google/genai": stubPath }, logLevel: "error" });
const bundlePath = join(dir, "live.bundle.mjs");
writeFileSync(bundlePath, out.outputFiles[0].text);
const { createLiveClient } = await import(pathToFileURL(bundlePath).href);

const problem = { id: "contains-duplicate", title: "Contains Duplicate", prompt: "p", examples: [], constraints: [], functionName: "contains_duplicate", starterCode: "x", cases: [] };
const token = { token: "t", model: "m", expiresAt: "2099-01-01T00:00:00Z" };
const snap = (v) => ({ codeVersion: v, source: `def contains_duplicate(nums):\n    return ${v}  # v${v}`, at: new Date().toISOString() });
const completed = (v, passed, total) => ({ sessionId: "s", problemId: "contains-duplicate", codeVersion: v, ranAt: new Date().toISOString(), durationMs: 10, status: "completed", passed, total, cases: [] });

const cb = () => globalThis.__CB__;
const endModelTurn = () => cb().onmessage({ serverContent: { turnComplete: true } });
const partial = (text) => cb().onmessage({ serverContent: { inputTranscription: { text } } });
const studentFinish = (text) => cb().onmessage({ serverContent: { inputTranscription: { text, finished: true } } });

function drain() {
  const items = globalThis.__SENT__.map((m) => ({ text: m.turns?.[0]?.parts?.[0]?.text ?? "", tc: !!m.turnComplete }));
  globalThis.__SENT__.length = 0;
  return items;
}
let fails = 0;
const assert = (label, cond, extra) => { if (!cond) fails += 1; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || extra === undefined ? "" : `  (${extra})`}`); };

const c = createLiveClient();
await c.connect(token, problem);
drain();

// v2 runs 4/4 while nothing is outstanding -> evidence (silent) + one follow-up (ask).
c.sendRunContext(snap(2), completed(2, 4, 4));
const afterV2 = drain();
assert("v2: evidence sent silently", afterV2.some((m) => !m.tc && m.text.includes("[RUN v2]") && m.text.includes("4/4")));
assert("v2: exactly one follow-up (tc:true)", afterV2.filter((m) => m.tc).length === 1);
endModelTurn(); // interviewer asked; its turn ends. outstanding stays true.
drain();

// Student edits to v3 (silent edit sync) -> "[CODE v3] not run yet".
c.syncCode(snap(3));
const afterEdit = drain();
assert("v3 edit: sent as 'not run yet' code context, no question", afterEdit.length === 1 && !afterEdit[0].tc && /\[CODE v3\].*not run yet/s.test(afterEdit[0].text));

// v3 runs 2/4 WHILE the question is still outstanding.
c.sendRunContext(snap(3), completed(3, 2, 4));
const afterV3Run = drain();
assert("BUG1: v3 2/4 evidence is sent promptly (silent), not held", afterV3Run.some((m) => !m.tc && m.text.includes("[RUN v3]") && m.text.includes("2/4")));
assert("BUG1: no spoken question fired while outstanding", afterV3Run.every((m) => m.tc === false));
assert("BUG1: v3 is not re-labeled 'not run yet' after it ran", afterV3Run.every((m) => !/\[CODE v3\].*not run yet/s.test(m.text)));
const v3Evidence = afterV3Run.find((m) => m.text.includes("[RUN v3]"));
assert("version + source + score kept together in one message", !!v3Evidence && v3Evidence.text.includes("2/4") && v3Evidence.text.includes("```python"));

// Student answers -> the follow-up is raised, grounded in v3 2/4 (never 4/4).
studentFinish("I think my set comparison is right.");
const afterAnswer = drain();
const asks = afterAnswer.filter((m) => m.tc);
assert("after answer: exactly one spoken follow-up", asks.length === 1, `got ${asks.length}`);
assert("follow-up is about v3 and states 2/4 (not 4/4)", asks[0] && asks[0].text.includes("[RUN v3]") && asks[0].text.includes("2/4") && !asks[0].text.includes("4/4"), asks[0]?.text);

// --- Partial-transcript safety ---------------------------------------------
const c2 = createLiveClient();
await c2.connect(token, problem);
drain();
c2.sendRunContext(snap(2), completed(2, 4, 4)); // evidence + follow-up -> outstanding
endModelTurn();
drain();
c2.sendRunContext(snap(3), completed(3, 2, 4)); // evidence while outstanding
drain();
partial("Well, I think"); // interim, no `finished`
partial(" the worst case");
const duringPartial = drain();
assert("partial transcript does NOT trigger a question mid-answer", duringPartial.every((m) => m.tc === false), JSON.stringify(duringPartial.map((m) => m.tc)));
studentFinish(" is quadratic."); // completes the answer
const afterComplete = drain();
assert("complete answer DOES raise the follow-up", afterComplete.filter((m) => m.tc).length === 1);

console.log(`\n${fails === 0 ? "ALL RUN-EVIDENCE CHECKS PASSED" : fails + " CHECK(S) FAILED"}`);
process.exit(fails === 0 ? 0 : 1);
