// Dev-only browser check (not shipped). Needs a running dev server and Edge.
// Run: npm i --no-save playwright-core && node dev/browser/drive-b10-coding.mjs http://localhost:3000/ <screenshot-dir>
// Uses an injected test Live client and intercepted routes; no key, mic, or network.
// B10 Step 3 coding regression: with tailoring present on the landing page, a
// coding round is unchanged. Set solution 4/4, then `return False` 2/4; the
// latest version and score reach Live; the report session is the old coding
// shape (no roundType, no behavioralContext). Plus zero-key coding fallback.
import { chromium } from "playwright-core";
const [APP, OUT] = process.argv.slice(2);
let fails = 0;
const ok = (c, label, extra = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`); if (!c) fails++; };
const b = await chromium.launch({ channel: "msedge", args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const SET = "def contains_duplicate(nums):\n    seen = set()\n    for n in nums:\n        if n in seen:\n            return True\n        seen.add(n)\n    return False";
const FALSE = "def contains_duplicate(nums):\n    return False";

{
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => !/Canceled/.test(e.message) && errors.push(e.message));
  await p.addInitScript(() => {
    window.__il = { opts: [], connects: [], runs: [] };
    window.__interviewlenzTestLiveClient = (o) => {
      window.__il.opts.push(o);
      return { cbs: { state: [] },
        async connect(token, problem) { window.__il.connects.push(problem ? problem.id : null); this.cbs.state.forEach((f) => f("idle")); },
        async startMic() {}, stopMic() {}, end() {}, syncCode() {},
        sendRunContext(s, r) { window.__il.runs.push({ v: s.codeVersion, rv: r.codeVersion, src: s.source, passed: r.passed, total: r.total, status: r.status }); },
        onState(cb) { this.cbs.state.push(cb); }, onTurn() {}, onError() {} };
    };
  });
  const tokens = [], reports = [], analyses = [];
  await p.route("**/api/analyze-tailoring", (r) => { analyses.push(1); r.fulfill({ status: 500, body: "{}" }); });
  await p.route("**/api/live-token", (r) => { tokens.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "t", model: "m", expiresAt: new Date(Date.now() + 1800000).toISOString() }) }); });
  await p.route("**/api/report", async (r) => { reports.push(JSON.parse(r.request().postData()).session); await r.continue(); });
  await p.goto(APP);
  // A confirmed behavioral context on the landing page must not leak into coding.
  await p.fill("input[name=role]", "Backend Intern");
  await p.click("[data-testid=tailor-toggle]");
  await p.click("[data-testid=manual-tailoring]");
  await p.fill("input[name=tailor-project-name]", "CampusEats Orders Service");
  await p.click("[data-testid=start-practice]");
  await p.waitForSelector(".monaco-editor .view-lines", { timeout: 60000 });
  await p.click("button:has-text('Start interview')");
  await p.waitForSelector("button:has-text('Mute')", { timeout: 15000 });
  ok(tokens.length === 1 && !("roundType" in tokens[0]) && !("behavioralContext" in tokens[0]) && tokens[0].roleContext?.role === "Backend Intern", "K1 coding token body: no roundType, no behavioralContext (role context kept)", JSON.stringify(Object.keys(tokens[0])));
  const il0 = await p.evaluate(() => window.__il);
  ok(!il0.opts[0].round && !il0.opts[0].openingExtra && il0.connects[0] === "contains-duplicate", "K2 coding client: no round option, connected with Contains Duplicate");
  const setCode = (s) => p.evaluate((s) => window.monaco.editor.getModels()[0].setValue(s), s);
  const version = async () => Number((await p.locator("text=/solution\\.py · v\\d+/").innerText()).split("v").pop());
  const run = async () => { await p.click("button:has-text('Run')"); await p.waitForSelector("button:has-text('Run'):not([disabled])", { timeout: 90000 }); await p.waitForTimeout(300); };
  await setCode(SET);
  const v1 = await version();
  await run();
  await setCode(FALSE);
  const v2 = await version();
  await run();
  const runs = await p.evaluate(() => window.__il.runs);
  ok(runs[0]?.v === v1 && runs[0].rv === v1 && runs[0].passed === 4 && runs[0].total === 4, "K3 set solution: 4/4 reaches Live with its version", `v${runs[0]?.v} ${runs[0]?.passed}/${runs[0]?.total}`);
  ok(runs.length === 2 && runs[1].v === v2 && runs[1].rv === v2 && v2 > v1 && runs[1].src === FALSE && runs[1].passed === 2 && runs[1].total === 4, "K4 unconditional return False: 2/4 reaches Live with the latest version and source", `v${runs[1]?.v} ${runs[1]?.passed}/${runs[1]?.total}`);
  ok(/2\s*\/\s*4/.test(await p.locator("body").innerText()), "K5 the visible score is the latest run (2/4)");
  await p.screenshot({ path: `${OUT}/coding-regression.png` });
  await p.click("button:has-text('Finish')");
  await p.waitForSelector("[data-testid=next-step]", { timeout: 30000 });
  const s = reports[0];
  ok(s && !("roundType" in s) && !("behavioralContext" in s) && s.problemId === "contains-duplicate" && s.runs.length === 2 && s.runs[1].passed === 2, "K6 coding report session is the old shape (no roundType), both runs, latest 2/4");
  ok((await p.locator("[data-testid=report-fixture-badge]").count()) === 1, "K7 zero-key report: labeled fixture fallback still shown (F9 behavior)");
  ok(analyses.length === 0, "K8 no analysis request anywhere in the coding flow");
  ok(errors.length === 0, "K9 no page errors", errors.join("; "));
  await ctx.close();
}

// Zero keys, real routes: coding voice falls back to the labeled mock.
{
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(APP);
  await p.click("[data-testid=start-practice]");
  await p.waitForSelector(".monaco-editor .view-lines", { timeout: 60000 });
  await p.click("button:has-text('Start interview')");
  await p.waitForSelector("[data-testid=mock-voice-badge]", { timeout: 15000 });
  ok((await p.locator("[data-testid=mock-voice-badge]").innerText()) === "MOCK VOICE (no API key)", "Z1 zero-key coding voice: labeled mock");
  await ctx.close();
}

console.log(fails === 0 ? "ALL B10 CODING REGRESSION CHECKS PASSED" : `${fails} CHECK(S) FAILED`);
await b.close();
process.exit(fails ? 1 : 0);
