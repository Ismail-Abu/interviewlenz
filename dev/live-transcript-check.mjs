// Dev-only: deterministic check of transcript buffering -> onTurn in lib/live.ts
// (not shipped). Bundles the real BrowserLiveClient with @google/genai stubbed,
// feeds simulated Gemini Live transcription events, and asserts onTurn fires
// once per turn with the correct speaker/text, including a completion event that
// carries `finished` with no text, and turnComplete flushing.
//
// Run: node dev/live-transcript-check.mjs

import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
globalThis.btoa ??= (s) => Buffer.from(s, "binary").toString("base64");
globalThis.atob ??= (s) => Buffer.from(s, "base64").toString("binary");
globalThis.AudioContext ??= class { currentTime = 0; destination = {}; close() {} };
globalThis.__CB__ = null;

const STUB = `
export const Modality = { AUDIO: "AUDIO", TEXT: "TEXT" };
export class GoogleGenAI {
  constructor() {
    this.live = { connect: async ({ callbacks }) => {
      globalThis.__CB__ = callbacks;
      if (callbacks.onopen) callbacks.onopen();
      return { sendClientContent: () => {}, sendRealtimeInput: () => {}, close: () => {} };
    } };
  }
}
`;
const dir = mkdtempSync(join(tmpdir(), "live-transcript-"));
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
const msg = (serverContent) => globalThis.__CB__.onmessage({ serverContent });

let fails = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  console.log(`      turns: ${JSON.stringify(got)}`);
  if (!ok) console.log(`      want:  ${JSON.stringify(want)}`);
}
async function fresh() {
  const turns = [];
  const c = createLiveClient();
  c.onTurn((t) => turns.push({ speaker: t.speaker, text: t.text, id: t.id }));
  await c.connect(token, problem);
  return { c, turns };
}
const seq = (turns) => turns.map((t) => ({ speaker: t.speaker, text: t.text }));

// 1) Student streams chunks + finished(with text); interviewer streams, then turnComplete.
let { turns } = await fresh();
msg({ inputTranscription: { text: "I'll use " } });
msg({ inputTranscription: { text: "a set.", finished: true } });
msg({ outputTranscription: { text: "Why " } });
msg({ outputTranscription: { text: "a set?" } });
msg({ turnComplete: true });
check("1 student(finished) then interviewer(flushed at turnComplete), in order, once each", seq(turns),
  [{ speaker: "student", text: "I'll use a set." }, { speaker: "interviewer", text: "Why a set?" }]);

// 2) Completion event carries `finished` with NO text of its own -> still flushes.
({ turns } = await fresh());
msg({ inputTranscription: { text: "this is linear" } });
msg({ inputTranscription: { finished: true } }); // no text
check("2 finished-without-text still flushes the student turn", seq(turns),
  [{ speaker: "student", text: "this is linear" }]);

// 3) Interviewer with no `finished`, flushed by turnComplete; ids are t1,t2...
({ turns } = await fresh());
msg({ outputTranscription: { text: "Edge case?" } });
msg({ turnComplete: true });
check("3 interviewer flushed at turnComplete", seq(turns), [{ speaker: "interviewer", text: "Edge case?" }]);
check("3b ids assigned", turns.map((t) => t.id), ["t1"]);

// 4) No double-emit: interviewer finished (emits) then turnComplete (nothing left).
({ turns } = await fresh());
msg({ outputTranscription: { text: "Done.", finished: true } });
msg({ turnComplete: true });
check("4 finished emits once; turnComplete does not duplicate", seq(turns), [{ speaker: "interviewer", text: "Done." }]);

console.log(`\n${fails === 0 ? "ALL TRANSCRIPT CHECKS PASSED" : fails + " CHECK(S) FAILED"}`);
process.exit(fails === 0 ? 0 : 1);
