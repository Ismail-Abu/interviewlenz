// Dev-only: deterministic check of the [TIME] cue and [QUIET] check-in paths in
// lib/live.ts (not shipped). Bundles the REAL BrowserLiveClient with
// @google/genai stubbed, so every sendClientContent is captured.
//
// Run: node dev/live-cue-check.mjs

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
      return { sendClientContent: (m) => globalThis.__SENT__.push(m), sendRealtimeInput: () => {}, close: () => {} };
    } };
  }
}
`;
const dir = mkdtempSync(join(tmpdir(), "live-cue-"));
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
const prompts = await (async () => {
  const r = await build({ entryPoints: [join(ROOT, "lib", "prompts.ts")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "error" });
  const p = join(dir, "prompts.mjs"); writeFileSync(p, r.outputFiles[0].text); return import(pathToFileURL(p).href);
})();
const beh = await (async () => {
  const r = await build({ entryPoints: [join(ROOT, "lib", "behavioral.ts")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "error" });
  const p = join(dir, "behavioral.mjs"); writeFileSync(p, r.outputFiles[0].text); return import(pathToFileURL(p).href);
})();

const problem = {
  id: "contains-duplicate", title: "Contains Duplicate", prompt: "Return True if any integer occurs more than once.",
  examples: [], constraints: [], functionName: "contains_duplicate",
  starterCode: "def contains_duplicate(nums):\n    pass", cases: [],
};
const token = { token: "t", model: "m", expiresAt: "2099-01-01T00:00:00Z" };
const msg = (serverContent) => globalThis.__CB__.onmessage({ serverContent });
const interviewerSays = (text) => { msg({ outputTranscription: { text } }); msg({ outputTranscription: { finished: true } }); msg({ turnComplete: true }); };
const studentSays = (text) => msg({ inputTranscription: { text, finished: true } });
const texts = () => globalThis.__SENT__.map((m) => ({ text: m.turns?.[0]?.parts?.[0]?.text ?? "", tc: !!m.turnComplete }));
const clear = () => (globalThis.__SENT__.length = 0);

let fails = 0;
const assert = (label, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `  -- ${detail}` : ""}`); if (!ok) fails += 1; };

async function connected(round = "coding") {
  const c = createLiveClient({ followupSettleMs: 0, round });
  const turns = [];
  c.onTurn((t) => turns.push(t));
  await c.connect(token, round === "coding" ? problem : undefined);
  interviewerSays("Hi, I'm Sam. How would you approach this?"); // opening answered by the model
  clear();
  return { c, turns };
}

console.log("== 1. Prompt content");
{
  const si = prompts.interviewerInstructions(problem);
  assert("1a technical: real-interview phases (clarify, hints escalate, test by hand, extension, candidate questions)",
    /Clarifying/.test(si) && /escalate gradually/.test(si) && /walk through their code with a small example/.test(si) && /realistic extension/.test(si) && /Do you have any questions for me\?/.test(si));
  assert("1b technical: mostly quiet while coding, neutral, never the solution", /mostly stay quiet/.test(si) && /Stay neutral/.test(si) && /Never give the solution/.test(si));
  assert("1c technical: explains [TIME] and [QUIET]", si.includes("[TIME]") && si.includes("[QUIET]"));
  const b = beh.behavioralInstructions({});
  assert("1d behavioral: warm-up, tell-me-about-a-time, I-vs-we probe, hypothetical probe, closing questions",
    /warm-up/.test(b) && /tell me about a time/.test(b) && /personally/.test(b) && /hypothetically/.test(b) && /Do you have any questions for me\?/.test(b));
  assert("1e behavioral: still never mentions coding problems", /Never ask a coding or algorithm question/.test(b));
  assert("1f technical time cues: 25-minute hint nudge, 40-minute closing", /hints/.test(prompts.formatTechnicalTimeCue(25, false)) && /Closing/.test(prompts.formatTechnicalTimeCue(40, true)));
  assert("1h behavioral 5-minute cue says keep going, never close early; instruction forbids self-timed wrap-up", /plenty of time/.test(beh.formatBehavioralTimeCue(5)) && !/Closing/.test(beh.formatBehavioralTimeCue(5)) && /Never decide on your own that time is running out/.test(b) && /one last question/.test(b));
  assert("1g behavioral time cues: closing at one minute, no new story", /Closing/.test(beh.formatBehavioralTimeCue(1)) && /Do not ask another story question/.test(beh.formatBehavioralTimeCue(1)));
}

console.log("== 2. [TIME] cue delivery");
{
  const { c, turns } = await connected();
  // The interviewer is mid-turn: the cue waits.
  msg({ outputTranscription: { text: "Take your" } });
  c.sendCue("[TIME] cue A");
  assert("2a not sent while the interviewer is speaking", texts().length === 0);
  msg({ outputTranscription: { finished: true } }); msg({ turnComplete: true });
  const sent = texts();
  assert("2b sent at the boundary, as a complete turn with a muted one-word ack", sent.length === 1 && sent[0].text.startsWith("[TIME] cue A") && sent[0].tc && /Okay/.test(sent[0].text), JSON.stringify(sent));
  // The acknowledgement is muted: no interviewer turn is emitted for it.
  const before = turns.length;
  msg({ outputTranscription: { text: "Okay." } }); msg({ outputTranscription: { finished: true } }); msg({ turnComplete: true });
  assert("2c the 'Okay.' acknowledgement is never shown as a turn", turns.length === before);
  clear();
  // The candidate is mid-utterance: the cue waits; a newer cue replaces it.
  msg({ inputTranscription: { text: "So I would use a" } });
  c.sendCue("[TIME] cue B");
  c.sendCue("[TIME] cue C");
  assert("2d not sent while the candidate is mid-answer", texts().length === 0);
  msg({ inputTranscription: { finished: true } }); // answer done -> no question outstanding
  assert("2e not sent while the interviewer owes a reply (no outstanding question)", texts().length === 0);
  interviewerSays("Okay. What's the complexity?");
  const s2 = texts();
  assert("2f delivered once the interviewer is waiting again; only the newest cue", s2.length === 1 && s2[0].text.startsWith("[TIME] cue C") && !s2.some((x) => x.text.includes("cue B")), JSON.stringify(s2));
  c.end();
}

console.log("== 3. [QUIET] check-in");
{
  const { c } = await connected();
  c.micActive = true; // as if the mic were on (no real mic in Node)
  const long = Date.now() - 10 * 60_000;
  c.lastStudentActivityAt = long; c.lastEditAt = long; c.lastInterviewerDoneAt = long;
  c.checkQuiet();
  let s = texts();
  assert("3a after a long silence with a question outstanding, one spoken check-in", s.length === 1 && s[0].text.startsWith("[QUIET]") && s[0].tc && !/Okay/.test(s[0].text), JSON.stringify(s));
  interviewerSays("Take your time - what are you thinking about?");
  c.lastInterviewerDoneAt = long;
  clear(); c.checkQuiet();
  assert("3b never a second check-in until the candidate speaks", texts().length === 0);
  studentSays("I'm thinking about a set."); interviewerSays("Okay, go on.");
  c.lastStudentActivityAt = Date.now(); c.lastInterviewerDoneAt = Date.now();
  clear(); c.checkQuiet();
  assert("3c not while the silence is short", texts().length === 0);
  c.lastStudentActivityAt = long; c.lastInterviewerDoneAt = long; c.lastEditAt = Date.now();
  c.checkQuiet();
  assert("3d typing counts as activity (no check-in while editing)", texts().length === 0);
  c.micActive = false; c.lastEditAt = long; c.checkQuiet();
  assert("3e no check-in while the mic is off", texts().length === 0);
  c.end();
  assert("3f end() stops the quiet watch", c.quietTimer === null);
}

console.log("== 3b. Spoken cue (time is up)");
{
  const { c, turns } = await connected("behavioral");
  c.sendCue("[TIME] The scheduled time is up.", { speak: true });
  const s = texts();
  assert("3g a spoken cue is sent without the one-word 'Okay' request", s.length === 1 && s[0].tc && s[0].text === "[TIME] The scheduled time is up.", JSON.stringify(s));
  const before = turns.length;
  interviewerSays("We're at time. Do you have any questions for me?");
  assert("3h ...and the interviewer's reply is heard and shown (not muted)", turns.length === before + 1);
  const b = beh.formatBehavioralOvertimeCue();
  assert("3i overtime cue: no more interview questions, invite questions, close with the fixed line", /Do not ask any more interview questions/.test(b) && /questions for you/.test(b) && b.includes("That's all for today."));
  c.end();
}

console.log("== 4. Behavioral round");
{
  const { c } = await connected("behavioral");
  c.micActive = true;
  const old = Date.now() - 40_000;
  c.lastStudentActivityAt = old; c.lastInterviewerDoneAt = old;
  c.checkQuiet();
  const s = texts();
  assert("4a behavioral check-in after ~25 s of silence, behavioral wording", s.length === 1 && /take their time/.test(s[0].text), JSON.stringify(s));
  interviewerSays("Take your time.");
  clear();
  c.sendCue(beh.formatBehavioralTimeCue(1));
  const t = texts();
  assert("4b behavioral time cue delivered while waiting", t.length === 1 && t[0].text.includes("About one minute is left"));
  c.end();
}

console.log(fails ? `\n${fails} LIVE CUE CHECK(S) FAILED` : "\nALL LIVE CUE CHECKS PASSED");
process.exit(fails ? 1 : 0);
