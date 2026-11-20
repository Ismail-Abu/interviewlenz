// Dev-only browser check (not shipped): the behavioral round's overtime. At
// 10:00 a live interview is not cut off; the interviewer is told time is up,
// the candidate can ask questions, and the round ends on the interviewer's
// goodbye or two minutes after the limit at the latest.
// Run: npm i --no-save playwright-core && node dev/browser/drive-overtime.mjs http://localhost:3000/ <screenshot-dir>
// Uses Playwright's fake clock, an injected test Live client and intercepted
// routes; no key, mic, or network.
import { chromium } from "playwright-core";
const [APP, OUT] = process.argv.slice(2);
let fails = 0;
const ok = (c, label, extra = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`); if (!c) fails++; };
const b = await chromium.launch({ channel: "msedge", args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });

async function room() {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => !/Canceled/.test(e.message) && errors.push(e.message));
  const reports = [];
  await p.clock.install();
  await p.addInitScript(() => {
    window.__il = { connects: [], clients: [], cues: [] };
    window.__interviewlenzTestLiveClient = () => {
      const c = { cbs: { state: [], turn: [], error: [] }, ended: false,
        async connect() { window.__il.connects.push(1); this.cbs.state.forEach((f) => f("idle")); },
        async startMic() { this.cbs.state.forEach((f) => f("listening")); }, stopMic() {},
        sendRunContext() {}, end() { this.ended = true; },
        sendCue(text, opts) { window.__il.cues.push({ text, speak: !!opts?.speak }); },
        onState(cb) { this.cbs.state.push(cb); }, onTurn(cb) { this.cbs.turn.push(cb); }, onError(cb) { this.cbs.error.push(cb); },
        emit(t) { this.cbs.turn.forEach((f) => f({ ...t, at: new Date().toISOString() })); } };
      window.__il.clients.push(c);
      return c;
    };
  });
  await p.route("**/api/live-token", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "t", model: "m", expiresAt: "2099-01-01T00:00:00Z" }) }));
  await p.route("**/api/report", (r) => {
    const s = JSON.parse(r.request().postData()).session;
    reports.push(s);
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reportId: "r", sessionId: s.sessionId, attemptId: s.attemptId, createdAt: new Date().toISOString(), nextStep: "x", findings: [{ id: "f1", category: "specificity", rating: "ok", summary: "x", evidence: [] }] }) });
  });
  await p.goto(APP);
  const press = (sel) => p.locator(sel).first().evaluate((el) => el.click());
  await press("[data-testid=start-behavioral]");
  await p.waitForTimeout(300);
  if (await p.locator("[data-testid=start-behavioral]").count()) await press("[data-testid=start-behavioral]");
  await p.waitForSelector("[data-testid=behavioral-room]", { timeout: 60000 });
  await p.click("button:has-text('Start interview'), button:has-text('Start Voice')");
  await p.waitForFunction(() => window.__il.clients.at(-1)?.cbs.turn.length > 0);
  const emit = (t) => p.evaluate((t) => window.__il.clients.at(-1).emit(t), t);
  await emit({ id: "t1", speaker: "interviewer", text: "Tell me about a time you fixed a hard bug." });
  await emit({ id: "t2", speaker: "student", text: "I profiled the service and added an index." });
  return { p, ctx, errors, reports, emit };
}
const clockText = (p) => p.locator("[data-testid=round-clock]").innerText();

// A. Goodbye ends the overtime.
{
  const { p, ctx, errors, reports, emit } = await room();
  await p.clock.fastForward("09:30");
  await p.waitForTimeout(300);
  ok(/left/.test(await clockText(p)), "A1 before the limit the clock counts down", await clockText(p));
  await p.clock.fastForward("00:45"); // 10:15
  await p.waitForTimeout(500);
  ok(await p.locator("[data-testid=behavioral-room]").isVisible(), "A2 at the limit the room stays open (no cut-off)");
  ok(/Your questions/.test(await clockText(p)), "A3 the clock shows question time", await clockText(p));
  const cue = await p.evaluate(() => window.__il.cues.at(-1));
  ok(cue?.speak && /time is up/i.test(cue.text), "A4 the interviewer is told, out loud, that time is up", JSON.stringify(cue));
  ok(!(await p.evaluate(() => window.__il.clients.at(-1).ended)), "A5 the voice session is still live");
  await emit({ id: "t3", speaker: "interviewer", text: "We're at time. Do you have any questions for me?" });
  await emit({ id: "t4", speaker: "student", text: "What does a typical day look like?" });
  await p.clock.fastForward("00:20");
  await p.waitForTimeout(300);
  ok(await p.locator("[data-testid=behavioral-room]").isVisible(), "A6 still open while the candidate asks questions");
  await p.screenshot({ path: `${OUT}/overtime-room.png` });
  await emit({ id: "t5", speaker: "interviewer", text: "Mostly coding and code reviews. Thanks again. That's all for today." });
  await p.clock.fastForward("00:02");
  await p.waitForSelector("[data-testid=next-step]", { timeout: 15000 }).catch(() => {});
  ok(await p.locator("[data-testid=next-step]").isVisible(), "A7 the goodbye ends the round and opens the report");
  const s = reports.at(-1);
  ok(s?.turns.length === 5 && s.turns.at(-1).text.includes("That's all for today"), "A8 the report session keeps the whole closing, questions included", JSON.stringify(s?.turns.map((t) => t.id)));
  const time = await p.locator("[data-testid=attempt-time]").innerText().catch(() => "");
  ok(/Time's up \(10:00\) \+ 0:\d\d for your questions/.test(time), "A9 the timing shows the limit plus question time", time);
  ok(await p.locator("[data-testid=question-time-divider]").count() > 0, "A10 the report transcript marks the candidate's questions as not graded");
  await p.screenshot({ path: `${OUT}/overtime-report.png`, fullPage: true });
  ok(errors.length === 0, "A11 no page errors", errors.join(" | "));
  await ctx.close();
}

// B. Without a goodbye, the round ends two minutes after the limit.
{
  const { p, ctx, reports } = await room();
  await p.clock.fastForward("10:05");
  await p.waitForTimeout(300);
  ok(await p.locator("[data-testid=behavioral-room]").isVisible(), "B1 overtime started");
  await p.clock.fastForward("01:30"); // 11:35
  await p.waitForTimeout(300);
  ok(await p.locator("[data-testid=behavioral-room]").isVisible(), "B2 still open before the cap");
  await p.clock.fastForward("00:30"); // 12:05
  await p.waitForSelector("[data-testid=next-step]", { timeout: 15000 }).catch(() => {});
  ok(await p.locator("[data-testid=next-step]").isVisible() && reports.length === 1, "B3 the round ends at the two-minute cap");
  const time = await p.locator("[data-testid=attempt-time]").innerText().catch(() => "");
  ok(/\+ 2:00 for your questions/.test(time), "B4 overtime is recorded as at most 2:00", time);
  await ctx.close();
}

await b.close();
console.log(fails ? `\n${fails} OVERTIME CHECK(S) FAILED` : "\nALL OVERTIME CHECKS PASSED");
process.exit(fails ? 1 : 0);
