// Dev-only browser check (not shipped). Needs a running dev server and Edge.
// Run: npm i --no-save playwright-core && node dev/browser/drive-tailor.mjs http://localhost:3000/ <screenshot-dir>
// Uses an injected test Live client and intercepted routes; no key, mic, or network.
// B10 Step 2 browser check: Tailor this interview -> confirmed context ->
// behavioral round, reconnect, Practice again. Dev server; test Live client;
// /api/analyze-tailoring, /api/live-token and /api/report are intercepted.
import { chromium } from "playwright-core";
const [APP, OUT] = process.argv.slice(2);
let fails = 0;
const ok = (c, label, extra = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`); if (!c) fails++; };
const b = await chromium.launch({ channel: "msedge", args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });

// Synthetic resume page (a real PNG) and noisy pages that cannot compress.
async function makePages() {
  const p = await b.newPage({ viewport: { width: 850, height: 1100 }, deviceScaleFactor: 2 });
  await p.setContent(`<body style="font:16px Georgia;padding:48px;background:#fff;color:#111">
    <h1>Jordan Example (synthetic)</h1><p>Computer Science, Example State University</p>
    <h2>Projects</h2><p><b>CampusEats Delivery API</b>: Flask, Postgres, 2k users. Built order routing and a cart service.</p>
    <p><b>StudyBuddy</b>: React Native flashcards app.</p></body>`);
  const resume = await p.screenshot({ type: "png" });
  const noise = await p.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 1300; c.height = 1300;
    const x = c.getContext("2d"); const d = x.createImageData(c.width, c.height);
    for (let i = 0; i < d.data.length; i++) d.data[i] = (Math.random() * 256) | 0;
    x.putImageData(d, 0, 0); return c.toDataURL("image/png").split(",")[1];
  });
  await p.close();
  return { resume, noise: Buffer.from(noise, "base64") };
}
const pages = await makePages();
const LISTING = "Synthetic Co is hiring a Backend Intern. You will debug production issues across services and explain tradeoffs.";
const SUGGESTION = {
  project: { name: "CampusEats Delivery API", summary: "Built order routing and a cart service.", excerpt: "CampusEats Delivery API: Flask, Postgres, 2k users" },
  focus: { skill: "Debugging production issues", detail: "The role debugs services in production.", excerpt: "debug production issues across services" },
};

async function setup({ analyze } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => !/Canceled/.test(e.message) && errors.push(e.message));
  const st = { tokens: [], reports: [], analyses: [] };
  await p.addInitScript(() => {
    window.__il = { opts: [], connects: [], clients: [] };
    window.__interviewlenzTestLiveClient = (options) => {
      window.__il.opts.push(options);
      const c = { cbs: { state: [], turn: [], error: [] }, seq: options.turnSeed ?? 0,
        async connect() { window.__il.connects.push(1); this.cbs.state.forEach((f) => f("idle")); },
        async startMic() { this.cbs.state.forEach((f) => f("listening")); }, stopMic() {}, sendRunContext() {}, end() {},
        onState(cb) { this.cbs.state.push(cb); }, onTurn(cb) { this.cbs.turn.push(cb); }, onError(cb) { this.cbs.error.push(cb); },
        say(speaker, text) { this.seq += 1; this.cbs.turn.forEach((f) => f({ id: `t${this.seq}`, speaker, text, at: new Date().toISOString() })); },
        disconnect() { this.cbs.state.forEach((f) => f("error")); this.cbs.error.forEach((f) => f({ code: "provider_unavailable", message: "Voice connection lost", retryable: true })); } };
      window.__il.clients.push(c);
      return c;
    };
  });
  await p.route("**/api/analyze-tailoring", async (r) => {
    const raw = r.request().postDataBuffer();
    st.analyses.push({ bytes: raw.length, body: JSON.parse(raw.toString("utf8")) });
    const plan = analyze?.(st.analyses.length) ?? { status: 200, body: { suggestion: SUGGESTION } };
    if (plan.delay) await new Promise((res) => setTimeout(res, plan.delay));
    await r.fulfill({ status: plan.status, contentType: "application/json", body: JSON.stringify(plan.body) }).catch(() => {});
  });
  await p.route("**/api/live-token", (r) => { st.tokens.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "t", model: "m", expiresAt: new Date(Date.now() + 1800000).toISOString() }) }); });
  await p.route("**/api/report", (r) => {
    const s = JSON.parse(r.request().postData()).session;
    st.reports.push(s);
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reportId: `r${st.reports.length}`, sessionId: s.sessionId, attemptId: s.attemptId, createdAt: new Date().toISOString(), nextStep: "Say how you measured it.",
      findings: [{ id: "f1", category: "outcome", rating: "needs_work", summary: "Cites the answer.", evidence: [{ kind: "turn", turnId: "t2" }] }] }) });
  });
  await p.goto(APP);
  return { ctx, p, st, errors };
}
const addResume = (p, files) => p.setInputFiles("[data-testid=resume-input]", files);
const resumeFile = (i = 1) => ({ name: `resume-${i}.png`, mimeType: "image/png", buffer: pages.resume });
const say = (p, speaker, text) => p.evaluate(([s, t]) => window.__il.clients.at(-1).say(s, t), [speaker, text]);
const PROJECT_NAME = "input[name=tailor-project-name]";

// ---------- A. Resume + listing -> correct the project -> round, reconnect, Practice again ----------
{
  const { ctx, p, st, errors } = await setup({ analyze: () => ({ status: 200, delay: 700, body: { suggestion: SUGGESTION } }) });
  await addResume(p, [resumeFile(1)]);
  await p.fill("input[name=role]", "Backend Intern");
  await p.fill("input[name=company]", "Synthetic Co");
  await p.fill("textarea[name=listing]", LISTING);
  ok(st.analyses.length === 0, "A1 selecting a file and typing the listing calls no analysis");
  await p.click("[data-testid=tailor-toggle]");
  ok(await p.locator("[data-testid=tailor-disclosure]").isVisible(), "A2 disclosure says what goes to Gemini before Prepare");
  ok(/sent to Google Gemini/.test(await p.locator("[data-testid=tailor-disclosure]").innerText()) && st.analyses.length === 0, "A3 opening the form calls no analysis");
  // Three rapid clicks -> one request.
  await p.evaluate(() => { const el = document.querySelector("[data-testid=prepare-tailoring]"); el.click(); el.click(); el.click(); });
  await p.waitForSelector("[data-testid=tailor-preview]", { timeout: 15000 });
  ok(st.analyses.length === 1, "A4 duplicate clicks send one analysis request", String(st.analyses.length));
  const req = st.analyses[0];
  ok(req.bytes <= 3_500_000 && req.body.images.length === 1 && req.body.images.every((i) => i.mimeType === "image/jpeg") && req.body.jobListing === LISTING, "A5 request: compressed JPEG page(s), listing, under 3,500,000 bytes", `${req.bytes} bytes`);
  ok(!JSON.stringify(req.body).includes("resume-1.png") && req.body.roleContext?.role === "Backend Intern" && !("jobDescription" in (req.body.roleContext || {})), "A6 no file names; role fields only");
  ok((await p.locator("[data-testid=project-excerpt]").innerText()).includes("CampusEats Delivery API: Flask"), "A7 verbatim resume excerpt shown, labeled separately from the editable fields");
  ok((await p.locator(PROJECT_NAME).inputValue()) === "CampusEats Delivery API", "A8 editable project name prefilled");
  await p.fill(PROJECT_NAME, "CampusEats Orders Service");
  await p.click("[data-testid=remove-focus]");
  ok((await p.locator("[data-testid=focus-excerpt]").count()) === 0, "A9 Remove focus removes it from the preview");
  ok((await p.locator("[data-testid=start-behavioral]").innerText()) === "Start tailored behavioral round", "A10 start button reflects the confirmed context");
  await p.locator("[data-testid=tailor-panel]").screenshot({ path: `${OUT}/tailor-preview.png` });
  await p.screenshot({ path: `${OUT}/tailor-setup.png`, fullPage: true });
  await p.click("[data-testid=start-behavioral]");
  await p.waitForSelector("[data-testid=behavioral-room]");
  ok((await p.locator("[data-testid=behavioral-focus]").innerText()).includes("CampusEats Orders Service"), "A11 room shows the confirmed focus");
  await p.click("button:has-text('Start interview')");
  await p.waitForSelector("button:has-text('End')");
  const t0 = st.tokens[0];
  ok(JSON.stringify(t0.behavioralContext) === JSON.stringify({ project: { name: "CampusEats Orders Service", summary: "Built order routing and a cart service." } }), "A12 token gets the CORRECTED project, no focus, no excerpt", JSON.stringify(t0.behavioralContext));
  ok(!JSON.stringify(t0).includes("Flask, Postgres") && !JSON.stringify(t0).includes("debug production issues across") && !("jobDescription" in (t0.roleContext || {})), "A13 no excerpts or raw listing reach the Live token request");
  const o0 = await p.evaluate(() => window.__il.opts[0]);
  ok(o0.round === "behavioral" && o0.openingExtra?.includes('"CampusEats Orders Service"') && !o0.openingExtra.includes("Delivery"), "A14 opening extra names the corrected project", o0.openingExtra);
  await say(p, "interviewer", "Thinking about CampusEats Orders Service, was there a problem you had to debug?");
  await say(p, "student", "Orders timed out at lunch, so I profiled it and batched an N plus one query.");
  await p.screenshot({ path: `${OUT}/tailor-room.png` });
  await p.evaluate(() => window.__il.clients.at(-1).disconnect());
  await p.click("[data-testid=reconnect]");
  await p.waitForFunction(() => window.__il.connects.length === 2);
  ok(JSON.stringify(st.tokens[1].behavioralContext) === JSON.stringify(t0.behavioralContext) && st.analyses.length === 1, "A15 reconnect: same context in the new token, no second analysis");
  await p.click("button:has-text('Finish')");
  await p.waitForSelector("[data-testid=next-step]");
  ok(JSON.stringify(st.reports[0].behavioralContext) === JSON.stringify(t0.behavioralContext) && !JSON.stringify(st.reports[0]).includes("Flask, Postgres"), "A16 report session carries the confirmed context, no excerpt");
  await p.click("button:has-text('Practice again')");
  await p.waitForSelector("[data-testid=behavioral-room]");
  await p.click("button:has-text('Start interview')");
  await p.waitForSelector("button:has-text('End')");
  const oLast = await p.evaluate(() => window.__il.opts.at(-1));
  ok(JSON.stringify(st.tokens.at(-1).behavioralContext) === JSON.stringify(t0.behavioralContext) && oLast.openingExtra === o0.openingExtra && st.analyses.length === 1, "A17 Practice again reuses the context, no re-upload or analysis");
  ok(errors.length === 0, "A18 no page errors", errors.join("; "));
  await ctx.close();
}

// ---------- B. Stale responses ----------
{
  const { ctx, p, st } = await setup({ analyze: () => ({ status: 200, delay: 1500, body: { suggestion: SUGGESTION } }) });
  await p.fill("textarea[name=listing]", LISTING);
  await p.click("[data-testid=tailor-toggle]");
  await p.click("[data-testid=prepare-tailoring]");
  await p.waitForFunction(() => document.querySelector("[data-testid=prepare-tailoring]")?.textContent?.includes("Preparing"));
  await p.fill("textarea[name=listing]", LISTING + " Also on-call.");
  await p.waitForTimeout(2200);
  ok((await p.locator("[data-testid=tailor-preview]").count()) === 0 && st.analyses.length === 1, "B1 editing inputs mid-flight: the late response is ignored");
  ok(!(await p.locator("[data-testid=prepare-tailoring]").isDisabled()), "B2 Prepare is available again for the new inputs");
  // Skip mid-flight -> generic round, no context.
  await p.click("[data-testid=prepare-tailoring]");
  await p.click("[data-testid=skip-behavioral]");
  await p.waitForSelector("[data-testid=behavioral-room]");
  await p.click("button:has-text('Start interview')");
  await p.waitForSelector("button:has-text('End')");
  await p.waitForTimeout(1800);
  ok(!("behavioralContext" in st.tokens[0]) && (await p.locator("[data-testid=behavioral-focus]").count()) === 0 && !(await p.evaluate(() => window.__il.opts[0].openingExtra)), "B3 Skip mid-flight: generic round, response ignored");
  await ctx.close();
}

// ---------- C. Errors, manual fallback, listing only, neither ----------
{
  const { ctx, p, st } = await setup({ analyze: () => ({ status: 503, body: { code: "timeout", message: "Tailoring took too long. Try again.", retryable: true } }) });
  await p.click("[data-testid=tailor-toggle]");
  ok(await p.locator("[data-testid=prepare-tailoring]").isDisabled(), "C1 neither resume nor listing: Prepare disabled, manual still offered");
  await p.fill("textarea[name=listing]", LISTING);
  await p.click("[data-testid=prepare-tailoring]");
  await p.waitForSelector("[data-testid=tailor-error]");
  ok(/took too long/.test(await p.locator("[data-testid=tailor-error]").innerText()), "C2 timeout -> message with manual and generic options");
  await p.locator("[data-testid=tailor-error] button:has-text('Enter details manually')").click();
  await p.fill("input[name=tailor-focus-skill]", "Explaining tradeoffs");
  await p.click("[data-testid=start-behavioral]");
  await p.waitForSelector("[data-testid=behavioral-room]");
  await p.click("button:has-text('Start interview')");
  await p.waitForSelector("button:has-text('End')");
  ok(JSON.stringify(st.tokens[0].behavioralContext) === JSON.stringify({ focus: { skill: "Explaining tradeoffs" } }), "C3 manual entry (focus only) reaches the token; empty project dropped", JSON.stringify(st.tokens[0].behavioralContext));
  ok((await p.evaluate(() => window.__il.opts[0].openingExtra)).includes("choose a story"), "C4 listing/focus only -> opening asks them to choose a story");
  await ctx.close();
}
{
  const { ctx, p, st } = await setup({ analyze: () => ({ status: 200, body: { suggestion: { focus: SUGGESTION.focus } } }) });
  await p.fill("textarea[name=listing]", LISTING);
  await p.click("[data-testid=tailor-toggle]");
  await p.click("[data-testid=prepare-tailoring]");
  await p.waitForSelector("[data-testid=tailor-preview]");
  ok(!("images" in st.analyses[0].body) && (await p.locator(PROJECT_NAME).count()) === 0, "C5 listing only: no images sent, focus-only preview");
  await p.click("[data-testid=remove-focus]");
  ok((await p.locator("[data-testid=start-behavioral]").innerText()) === "Start behavioral round", "C6 removing everything -> generic round");
  await ctx.close();
}

// ---------- D. Too many / too large / unreadable pages ----------
{
  const { ctx, p, st } = await setup();
  await addResume(p, [1, 2, 3, 4, 5].map(resumeFile));
  await p.click("[data-testid=tailor-toggle]");
  await p.click("[data-testid=prepare-tailoring]");
  await p.waitForSelector("[data-testid=tailor-error]");
  ok(/at most 4/.test(await p.locator("[data-testid=tailor-error]").innerText()) && st.analyses.length === 0, "D1 five pages -> 'at most 4', nothing sent");
  await ctx.close();
}
// Encoder stub: JPEG output grows with the long side (1000 bytes per px of
// long side; pages are 1700x2200), so the ladder steps down: 3 pages fit only at the 1100 px rung;
// 4 pages never fit. The real noise pages compress under the cap.
async function bigEncoder(p) {
  await p.addInitScript(() => {
    HTMLCanvasElement.prototype.toDataURL = function () { return "data:image/jpeg;base64,/9j/" + "A".repeat(Math.max(this.width, this.height) * 1000 - 4); };
  });
  await p.reload();
}
{
  const { ctx, p, st } = await setup();
  await bigEncoder(p);
  await addResume(p, [1, 2, 3].map(resumeFile));
  await p.click("[data-testid=tailor-toggle]");
  await p.click("[data-testid=prepare-tailoring]");
  await p.waitForSelector("[data-testid=tailor-preview]", { timeout: 30000 });
  const r = st.analyses[0];
  ok(st.analyses.length === 1 && r.bytes <= 3_500_000 && r.bytes > 3_200_000, "D2 ladder steps down until the serialized request fits under 3,500,000 bytes", `${r?.bytes} bytes`);
  await ctx.close();
}
{
  const { ctx, p, st } = await setup();
  await bigEncoder(p);
  await addResume(p, [1, 2, 3, 4].map(resumeFile));
  await p.click("[data-testid=tailor-toggle]");
  await p.click("[data-testid=prepare-tailoring]");
  await p.waitForSelector("[data-testid=tailor-error]", { timeout: 30000 });
  const msg = await p.locator("[data-testid=tailor-error]").innerText();
  ok(/can't fit legibly/.test(msg) && st.analyses.length === 0, "D3 pages that can't fit -> fewer pages / manual / generic, nothing sent", msg.slice(0, 80));
  await p.locator("[data-testid=tailor-error]").screenshot({ path: `${OUT}/tailor-too-large.png` });
  await ctx.close();
}
{
  const { ctx, p, st } = await setup();
  await addResume(p, [{ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("this is not an image") }]);
  await p.click("[data-testid=tailor-toggle]");
  await p.click("[data-testid=prepare-tailoring]");
  await p.waitForSelector("[data-testid=tailor-error]");
  ok(/couldn't be read/.test(await p.locator("[data-testid=tailor-error]").innerText()) && st.analyses.length === 0, "D4 unreadable file -> message, nothing sent");
  await p.locator("[data-testid=tailor-error] button:has-text('Start a generic round')").click();
  await p.waitForSelector("[data-testid=behavioral-room]");
  ok((await p.locator("[data-testid=behavioral-focus]").count()) === 0, "D5 'Start a generic round' -> generic behavioral room");
  await ctx.close();
}

// ---------- E. Phone layout of the panel ----------
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.route("**/api/analyze-tailoring", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestion: SUGGESTION }) }));
  await p.goto(APP);
  await addResume(p, [resumeFile(1)]);
  await p.fill("textarea[name=listing]", LISTING);
  await p.click("[data-testid=tailor-toggle]");
  await p.click("[data-testid=prepare-tailoring]");
  await p.waitForSelector("[data-testid=tailor-preview]");
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "E1 phone: tailoring panel has no horizontal overflow");
  await p.locator("[data-testid=tailor-panel]").screenshot({ path: `${OUT}/tailor-phone.png` });
  await ctx.close();
}

console.log(fails === 0 ? "ALL STEP-2 BROWSER CHECKS PASSED" : `${fails} CHECK(S) FAILED`);
await b.close();
process.exit(fails ? 1 : 0);
