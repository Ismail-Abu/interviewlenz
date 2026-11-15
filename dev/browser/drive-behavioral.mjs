// Dev-only browser check (not shipped). Needs a running dev server and Edge.
// Run: npm i --no-save playwright-core && node dev/browser/drive-behavioral.mjs http://localhost:3000/ <screenshot-dir>
// Uses an injected test Live client and intercepted routes; no key, mic, or network.
// Step 1 browser check for the behavioral round (dev server).
import { chromium } from "playwright-core";
const [APP, OUT] = process.argv.slice(2);
let fails = 0;
const ok = (c, label, extra = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`); if (!c) fails++; };
const b = await chromium.launch({ channel: "msedge", args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });

async function withTestClient(viewport = { width: 1366, height: 768 }) {
  const ctx = await b.newContext({ viewport });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => !/Canceled/.test(e.message) && errors.push(e.message));
  const tokens = [];
  const reports = [];
  await p.addInitScript(() => {
    window.__il = { opts: [], connects: [], clients: [] };
    window.__interviewlenzTestLiveClient = (options) => {
      window.__il.opts.push(options);
      const c = { cbs: { state: [], turn: [], error: [] },
        async connect(token, problem) { window.__il.connects.push({ problem: problem ? problem.id : null }); this.cbs.state.forEach((f) => f("idle")); },
        async startMic() { this.cbs.state.forEach((f) => f("listening")); }, stopMic() { this.cbs.state.forEach((f) => f("idle")); },
        sendRunContext() { window.__il.runCalls = (window.__il.runCalls || 0) + 1; }, end() {},
        onState(cb) { this.cbs.state.push(cb); }, onTurn(cb) { this.cbs.turn.push(cb); }, onError(cb) { this.cbs.error.push(cb); },
        emit(t) { this.cbs.turn.forEach((f) => f({ ...t, at: new Date().toISOString() })); },
        state(s) { this.cbs.state.forEach((f) => f(s)); } };
      window.__il.clients.push(c);
      return c;
    };
  });
  await p.route("**/api/live-token", (r) => { tokens.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "t", model: "m", expiresAt: new Date(Date.now() + 1800000).toISOString() }) }); });
  await p.route("**/api/report", (r) => {
    const s = JSON.parse(r.request().postData()).session;
    reports.push(s);
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reportId: `r${reports.length}`, sessionId: s.sessionId, attemptId: s.attemptId, createdAt: new Date().toISOString(), nextStep: "Say what you personally changed.",
      findings: [
        { id: "f1", category: "personal_contribution", rating: "needs_work", summary: "Cites the answer.", evidence: [{ kind: "turn", turnId: "t2" }] },
        { id: "f2", category: "specificity", rating: "ok", summary: "Cites t1.", evidence: [{ kind: "turn", turnId: "t1" }] },
      ] }) });
  });
  return { ctx, p, errors, tokens, reports };
}
const emit = (p, t) => p.evaluate((t) => window.__il.clients.at(-1).emit(t), t);
const text = (p, sel) => p.locator(sel).first().innerText();

// ---------------- Part A ----------------
{
  const { ctx, p, errors, tokens, reports } = await withTestClient();
  await p.goto(APP);
  await p.click("[data-testid=skip-behavioral]");
  await p.waitForSelector("[data-testid=behavioral-room]");
  ok((await p.locator(".monaco-editor").count()) === 0 && !(await p.locator("body").innerText()).includes("Contains Duplicate"), "A1 Skip -> behavioral room: no editor, no coding problem on screen");
  ok((await p.locator("button:has-text('Run')").count()) === 0, "A2 no Run button in a behavioral round");
  await p.screenshot({ path: `${OUT}/behavioral-room-start.png` });
  await p.click("button:has-text('Start interview')");
  await p.waitForSelector("button:has-text('End')");
  ok(JSON.stringify(tokens[0]) === JSON.stringify({ sessionId: tokens[0].sessionId, roundType: "behavioral" }), "A3 token body is {sessionId, roundType: behavioral}", JSON.stringify(tokens[0]));
  const il = await p.evaluate(() => window.__il);
  ok(il.opts[0].round === "behavioral" && il.connects[0].problem === null, "A4 client built for the behavioral round, connected without a coding problem", JSON.stringify(il.opts[0]));
  await emit(p, { id: "t1", speaker: "interviewer", text: "ATTEMPT-ONE opener: tell me about a hard bug you debugged." });
  ok((await text(p, "[data-testid=current-question]")).includes("ATTEMPT-ONE opener"), "A5 the question is shown");
  ok((await text(p, "[data-testid=whose-turn]")).startsWith("Your turn"), "A6 whose turn: the student's", await text(p, "[data-testid=whose-turn]"));
  await emit(p, { id: "t2", speaker: "student", text: "ATTEMPT-ONE answer: we fixed the database after checkout got slow." });
  await p.evaluate(() => window.__il.clients.at(-1).state("speaking"));
  ok((await text(p, "[data-testid=whose-turn]")) === "Interviewer is speaking", "A7 whose turn follows the interviewer speaking");
  await emit(p, { id: "t3", speaker: "interviewer", text: "You said we fixed the database. What did you personally investigate or change?" });
  await p.evaluate(() => window.__il.clients.at(-1).state("listening"));
  ok((await text(p, "[data-testid=current-question]")).includes("personally investigate"), "A8 the follow-up becomes the current question");
  await p.click("button:has-text('Mute')");
  ok((await text(p, "[data-testid=whose-turn]")).startsWith("Muted"), "A9 mute shows in whose-turn");
  await p.click("button:has-text('Unmute')");
  ok((await p.locator("section:has(h2:has-text('Interviewer')) ol > li").count()) === 3, "A10 transcript shows all three turns");
  await p.screenshot({ path: `${OUT}/behavioral-room-live.png` });
  await p.click("button:has-text('Finish')");
  await p.waitForSelector("[data-testid=next-step]");
  const s1 = reports[0];
  ok(s1.roundType === "behavioral" && !("problemId" in s1) && !("snapshots" in s1) && !("runs" in s1) && s1.turns.length === 3, "A11 report session: behavioral, turns only (no problem, snapshots, runs)", JSON.stringify(Object.keys(s1)));
  ok((await p.evaluate(() => window.__il.runCalls || 0)) === 0, "A12 no Run context ever sent");
  await p.locator("article").first().locator("[data-evidence-kind=turn]").first().click();
  ok((await text(p, "[data-testid=evidence-quote] blockquote")) === "“ATTEMPT-ONE answer: we fixed the database after checkout got slow.”", "A13 citation opens the exact quote", await text(p, "[data-testid=evidence-quote] blockquote"));
  ok((await p.locator("button:has-text('Practice again')").count()) === 1, "A14 report offers Practice again");
  await p.screenshot({ path: `${OUT}/behavioral-report.png` });
  // Practice again -> fresh transcript; attempt 2 has its own t1/t2.
  await p.click("button:has-text('Practice again')");
  await p.waitForSelector("[data-testid=behavioral-room]");
  ok((await text(p, "[data-testid=session-stats]")).startsWith("0 turns"), "A15 Practice again starts an empty transcript");
  await p.click("button:has-text('Start interview')");
  await p.waitForSelector("button:has-text('End')");
  ok((await p.evaluate(() => window.__il.opts.at(-1).turnSeed)) === 0, "A16 new attempt seeds turn IDs at 0");
  await emit(p, { id: "t1", speaker: "interviewer", text: "ATTEMPT-TWO opener: tell me about a disagreement." });
  await emit(p, { id: "t2", speaker: "student", text: "ATTEMPT-TWO answer: I disagreed with a teammate about caching." });
  await p.click("button:has-text('Finish')");
  await p.waitForFunction(() => document.querySelectorAll("article").length === 2);
  const cards = p.locator("article");
  for (const [i, tag] of [[0, "ATTEMPT-ONE"], [1, "ATTEMPT-TWO"]]) {
    for (const [j, turn] of [[0, "answer"], [1, "opener"]]) {
      await cards.nth(i).locator("[data-evidence-kind=turn]").nth(j).click();
      const q = await cards.nth(i).locator("[data-testid=evidence-quote] blockquote").innerText();
      ok(q.includes(`${tag} ${turn}`), `A17 attempt ${i + 1} chip t${j === 0 ? 2 : 1} opens its own attempt's quote`, q.slice(0, 50));
    }
  }
  ok(errors.length === 0, "A18 no page errors", errors.join("; "));
  await ctx.close();
}

// Phone layout.
{
  const { ctx, p } = await withTestClient({ width: 390, height: 844 });
  await p.goto(APP);
  await p.click("[data-testid=skip-behavioral]");
  await p.waitForSelector("[data-testid=behavioral-room]");
  await p.click("button:has-text('Start interview')");
  await p.waitForSelector("button:has-text('End')");
  await emit(p, { id: "t1", speaker: "interviewer", text: "Tell me about a time you shipped under a deadline." });
  const vis = async (sel) => (await p.locator(sel).first().isVisible());
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "P1 phone: no horizontal overflow");
  ok((await vis("[data-testid=current-question]")) && (await vis("[data-testid=whose-turn]")) && (await vis("button:has-text('Mute')")) && (await vis("button:has-text('Finish')")) && (await vis("section:has(h2:has-text('Interviewer')) ol")), "P2 phone: question, whose turn, mute, transcript, Finish all visible");
  await p.screenshot({ path: `${OUT}/behavioral-room-phone.png`, fullPage: true });
  await ctx.close();
}

// ---------------- Part B: zero keys, real routes ----------------
{
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  await p.goto(APP);
  await p.click("[data-testid=skip-behavioral]");
  await p.waitForSelector("[data-testid=behavioral-room]");
  await p.click("button:has-text('Start interview')");
  await p.waitForSelector("[data-testid=mock-voice-badge]");
  ok((await text(p, "[data-testid=mock-voice-badge]")) === "MOCK VOICE (no API key)", "B1 zero keys: labeled mock voice");
  await p.waitForSelector("li:has-text('personally investigate')", { timeout: 15000 });
  const body = await p.locator("body").innerText();
  ok(!/Contains Duplicate|contains_duplicate/.test(body), "B2 behavioral mock never mentions the coding problem");
  ok((await text(p, "[data-testid=current-question]")).includes("personally investigate"), "B3 answer-specific follow-up becomes the current question");
  await p.click("button:has-text('Finish')");
  await p.waitForSelector("[data-testid=next-step]", { timeout: 20000 });
  const badge = await p.locator("[data-testid=report-fixture-badge]").count();
  const summaries = await p.locator("article ul > li").allInnerTexts();
  ok(badge === 0 && summaries.length === 4 && summaries.every((x) => /Insufficient evidence/i.test(x)) && /Only about \d+ words/.test(summaries[0]), "B4 zero-key Finish: real deterministic report naming the missing evidence (no code evidence, no fixture)", summaries[0]?.replace(/\s+/g, " ").slice(0, 90));
  await ctx.close();
}

console.log(fails === 0 ? "ALL STEP-1 BROWSER CHECKS PASSED" : `${fails} CHECK(S) FAILED`);
await b.close();
process.exit(fails ? 1 : 0);
