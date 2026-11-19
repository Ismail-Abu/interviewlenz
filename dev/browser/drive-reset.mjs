// Dev-only browser check (not shipped): every new interview starts with an
// empty transcript, code history and report list, and nothing from an earlier
// interview leaks into a later one.
// Run: npm i --no-save playwright-core && node dev/browser/drive-reset.mjs http://localhost:3000/ <screenshot-dir>
// Uses an injected test Live client and intercepted routes; no key, mic, or network.
import { chromium } from "playwright-core";
const [APP, OUT] = process.argv.slice(2);
let fails = 0;
const ok = (c, label, extra = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`); if (!c) fails++; };
const b = await chromium.launch({ channel: "msedge", args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });

const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => !/Canceled/.test(e.message) && errors.push(e.message));
const reports = [];
await p.addInitScript(() => {
  window.__il = { opts: [], connects: [], clients: [] };
  window.__interviewlenzTestLiveClient = (options) => {
    window.__il.opts.push(options);
    const c = { cbs: { state: [], turn: [], error: [] }, ended: false,
      async connect(token, problem) { window.__il.connects.push({ problem: problem ? problem.id : null }); this.cbs.state.forEach((f) => f("idle")); },
      async startMic() { this.cbs.state.forEach((f) => f("listening")); }, stopMic() {},
      sendRunContext() {}, syncCode() {}, end() { this.ended = true; },
      onState(cb) { this.cbs.state.push(cb); }, onTurn(cb) { this.cbs.turn.push(cb); }, onError(cb) { this.cbs.error.push(cb); },
      emit(t) { this.cbs.turn.forEach((f) => f({ ...t, at: new Date().toISOString() })); } };
    window.__il.clients.push(c);
    return c;
  };
});
await p.route("**/api/live-token", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "t", model: "m", expiresAt: new Date(Date.now() + 1800000).toISOString() }) }));
await p.route("**/api/report", (r) => {
  const s = JSON.parse(r.request().postData()).session;
  reports.push(s);
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reportId: `r${reports.length}`, sessionId: s.sessionId, attemptId: s.attemptId, createdAt: new Date().toISOString(), nextStep: "Practice.",
    findings: [{ id: "f1", category: s.roundType === "behavioral" ? "specificity" : "approach", rating: "ok", summary: "x", evidence: [] }] }) });
});

const emit = (t) => p.evaluate((t) => window.__il.clients.at(-1).emit(t), t);
const body = () => p.locator("body").innerText();
const turnsShown = async () => Number((await body()).match(/(\d+) turns/)?.[1] ?? -1);

async function start(mode) {
  // Direct clicks: the sticky header can cover these buttons at test sizes.
  const press = (sel) => p.locator(sel).first().evaluate((el) => el.click());
  // A mode card selects on the first click and starts on the second.
  await press(`[data-testid=start-${mode}]`);
  await p.waitForTimeout(200);
  if (await p.locator(`[data-testid=start-${mode}]`).count()) await press(`[data-testid=start-${mode}]`);
  if (mode === "behavioral") await p.waitForSelector("[data-testid=behavioral-room]", { timeout: 60000 });
  else await p.waitForSelector(".monaco-editor .view-lines", { timeout: 60000 });
}
async function startVoice() {
  const n = await p.evaluate(() => window.__il.connects.length);
  await p.click("button:has-text('Start interview'), button:has-text('Start Voice')");
  // Wait for THIS interview's client (earlier interviews connected clients too).
  await p.waitForFunction((n) => window.__il.connects.length > n && window.__il.clients.at(-1).cbs.turn.length > 0, n);
  await p.waitForTimeout(300);
}
async function home() {
  await p.locator("[data-testid=logo-home]").first().evaluate((el) => el.click());
  await p.waitForSelector("[data-testid=start-coding]");
}

await p.goto(APP);

// A. Coding interview, leave midway, start a behavioral one.
await start("coding");
await startVoice();
await emit({ id: "t1", speaker: "interviewer", text: "CODING-Q-ALPHA how would you approach it?" });
await emit({ id: "t2", speaker: "student", text: "CODING-A-ALPHA with a set." });
await p.waitForTimeout(300);
ok((await body()).includes("CODING-A-ALPHA") && (await turnsShown()) === 2, "A1 coding transcript shows its two turns", `turns=${await turnsShown()}`);
await home();
ok(await p.evaluate(() => window.__il.clients.at(-1).ended), "A2 leaving ends the voice session");
await start("behavioral");
ok(!(await body()).includes("ALPHA"), "A3 the new behavioral interview shows nothing from the coding one");
ok((await turnsShown()) === 0, "A4 behavioral starts at 0 turns", `turns=${await turnsShown()}`);
await startVoice();
ok((await p.evaluate(() => window.__il.opts.at(-1)?.turnSeed ?? 0)) === 0, "A5 the new voice client starts numbering at t1 (turnSeed 0)", JSON.stringify(await p.evaluate(() => window.__il.opts.at(-1))));
await emit({ id: "t1", speaker: "interviewer", text: "BEH-Q-BRAVO tell me about yourself." });
await p.waitForTimeout(300);
ok((await body()).includes("BEH-Q-BRAVO"), "A6 behavioral transcript shows its own turn");
await p.screenshot({ path: `${OUT}/reset-behavioral.png` });

// B. Leave the behavioral one, start coding again.
await home();
await start("coding");
const b1 = await body();
ok(!b1.includes("BRAVO") && !b1.includes("ALPHA"), "B1 a second coding interview shows nothing from either earlier one");
ok((await turnsShown()) === 0, "B2 coding starts at 0 turns", `turns=${await turnsShown()}`);

// C. Switching problem mid-interview starts over on the new problem.
await startVoice();
await emit({ id: "t1", speaker: "interviewer", text: "OLD-PROBLEM-CHARLIE question" });
await p.waitForTimeout(300);
const before = await p.evaluate(() => window.__il.connects.length);
const current = await p.locator("#problem-picker").inputValue();
const other = await p.locator("#problem-picker option").evaluateAll((os, cur) => os.map((o) => o.value).find((v) => v !== cur), current);
await p.selectOption("#problem-picker", other);
await p.waitForFunction((n) => window.__il.connects.length > n, before);
await p.waitForTimeout(300);
ok(!(await body()).includes("CHARLIE") && (await turnsShown()) === 0, "C1 switching problem clears the old problem's transcript", `turns=${await turnsShown()}`);
ok((await p.evaluate(() => window.__il.connects.at(-1).problem)) === other, "C2 the voice reconnects on the NEW problem", JSON.stringify(await p.evaluate(() => window.__il.connects.at(-1))));

// D. Finishing: the report gets only this interview; a new interview from home starts a new report list.
await emit({ id: "t1", speaker: "interviewer", text: "DELTA approach?" });
await emit({ id: "t2", speaker: "student", text: "DELTA answer" });
await p.waitForTimeout(300);
await p.click("button:has-text('End Interview'), button:has-text('Finish')");
await p.waitForSelector("[data-testid=next-step]", { timeout: 30000 });
const r1 = reports.at(-1);
ok(r1 && r1.turns.length === 2 && r1.turns.every((t) => t.text.includes("DELTA")) && r1.problemId === other, "D1 the report request carries only this interview's turns and problem", JSON.stringify(r1?.turns?.map((t) => t.text)));
await home();
await start("coding");
await startVoice();
await emit({ id: "t1", speaker: "interviewer", text: "ECHO approach?" });
await emit({ id: "t2", speaker: "student", text: "ECHO answer" });
await p.waitForTimeout(300);
await p.click("button:has-text('End Interview'), button:has-text('Finish')");
await p.waitForSelector("[data-testid=next-step]", { timeout: 30000 });
const r2 = reports.at(-1);
ok(r2.attemptId !== r1.attemptId && r2.sessionId !== r1.sessionId && !r2.priorAttemptId, "D2 a new interview has a new session and attempt, not a retry of the old one", JSON.stringify({ a1: r1.attemptId, a2: r2.attemptId, prior: r2.priorAttemptId }));
ok(r2.turns.length === 2 && r2.turns.every((t) => t.text.includes("ECHO")), "D3 its report has only its own turns");
const reportText = await body();
ok(!reportText.includes("DELTA") && !/Attempt 2/.test(reportText), "D4 the report page shows only the new interview", reportText.match(/Attempt \d/g)?.join(","));
await p.screenshot({ path: `${OUT}/reset-report.png` });

// E. Retry keeps the session and links to the prior attempt (unchanged behaviour).
const retry = p.locator("button:has-text('Retry'), button:has-text('Try again')").first();
if (await retry.isVisible().catch(() => false)) {
  await retry.click();
  await p.waitForSelector(".monaco-editor .view-lines", { timeout: 60000 });
  ok(!(await body()).includes("ECHO") && (await turnsShown()) === 0, "E1 Retry starts with an empty transcript");
} else console.log("SKIP  E1 (no retry button on this report layout)");

ok(errors.length === 0, "F1 no page errors", errors.join(" | "));
await b.close();
console.log(fails ? `\n${fails} RESET CHECK(S) FAILED` : "\nALL RESET CHECKS PASSED");
process.exit(fails ? 1 : 0);
