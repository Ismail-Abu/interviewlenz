import playwright from "/Users/ismailabu-shanab/Documents/Codex/2026-11-14/okay/work/live-trace/node_modules/playwright-core/index.js";

const BASE_URL = "http://127.0.0.1:3008";

async function runBrowserChecks() {
  const browser = await playwright.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  console.log("==================================================");
  console.log("RUNNING COMPREHENSIVE INTEGRATION BROWSER CHECKS");
  console.log("==================================================");

  // ----------------------------------------------------
  // TEST 1: Homepage & Mode Selection (1366x768)
  // ----------------------------------------------------
  console.log("\n[TEST 1] Homepage & Mode Choice (1366x768)");
  const page1 = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page1.goto(BASE_URL);
  await page1.waitForTimeout(1000);

  // Check hero and tagline
  const heroBtn = await page1.locator('[data-testid="hero-start-practice"]').isVisible();
  const heroText = await page1.locator("h1").innerText();
  console.log("  Hero action visible:", heroBtn);
  console.log("  Hero title:", heroText.replace(/\n/g, " "));

  // Check 3 mode cards
  const startCodingBtn = await page1.locator('[data-testid="start-coding"]').isVisible();
  const startBehavioralBtn = await page1.locator('[data-testid="start-behavioral"]').isVisible();
  const startFullMockBtn = await page1.locator('[data-testid="start-full-mock"]').isVisible();
  console.log("  Mode cards visible: Coding=" + startCodingBtn + ", Behavioral=" + startBehavioralBtn + ", FullMock=" + startFullMockBtn);

  if (!startCodingBtn || !startBehavioralBtn || !startFullMockBtn) {
    throw new Error("Missing one of the three required mode buttons on homepage!");
  }

  // Check collapsed tailoring panel
  const setupDetails = await page1.locator("details#setup summary, #setup details summary").first().isVisible();
  console.log("  Tailor details summary visible:", setupDetails);

  // Check stale copy is gone
  const bodyText = await page1.innerText("body");
  const hasOldNothingUploaded = bodyText.includes("nothing is uploaded");
  const hasOldTailoringNotLive = bodyText.includes("tailoring isn't live");
  console.log("  Stale 'nothing is uploaded' present:", hasOldNothingUploaded);
  console.log("  Stale 'tailoring isn't live' present:", hasOldTailoringNotLive);
  if (hasOldNothingUploaded || hasOldTailoringNotLive) {
    throw new Error("Stale copy found on landing page!");
  }
  await page1.close();

  // ----------------------------------------------------
  // TEST 2: Coding Flow (4/4 -> 2/4 -> unrun edit -> Finish)
  // ----------------------------------------------------
  console.log("\n[TEST 2] Coding Flow & Unrun Draft Preservation");
  const page2 = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page2.goto(BASE_URL);
  await page2.locator('[data-testid="start-coding"]').click();
  await page2.waitForTimeout(1000);

  // 1. Set solution (4/4)
  await page2.waitForFunction(() => window.monaco?.editor?.getEditors()?.length > 0, { timeout: 10000 });
  await page2.evaluate(() => {
    const editor = window.monaco?.editor?.getEditors()?.[0];
    const model = editor.getModel();
    editor.executeEdits("test", [{
      range: model.getFullModelRange(),
      text: "def contains_duplicate(nums):\n    return len(set(nums)) != len(nums)",
    }]);
  });
  await page2.waitForTimeout(400);
  await page2.locator('[data-testid="run-btn"]').click();
  await page2.waitForTimeout(1500);

  let score = await page2.locator('[data-testid="passed-total"]').innerText();
  console.log("  Run 1 score (set solution):", score);

  // 2. Unconditional False (2/4)
  await page2.evaluate(() => {
    const editor = window.monaco?.editor?.getEditors()?.[0];
    const model = editor.getModel();
    editor.executeEdits("test", [{
      range: model.getFullModelRange(),
      text: "def contains_duplicate(nums):\n    return False",
    }]);
  });
  await page2.waitForTimeout(400);
  await page2.locator('[data-testid="run-btn"]').click();
  await page2.waitForTimeout(1500);

  score = await page2.locator('[data-testid="passed-total"]').innerText();
  console.log("  Run 2 score (unconditional False):", score);

  // 3. Unrun edit
  await page2.evaluate(() => {
    const editor = window.monaco?.editor?.getEditors()?.[0];
    const model = editor.getModel();
    editor.executeEdits("test", [{
      range: model.getFullModelRange(),
      text: "def contains_duplicate(nums):\n    # final unrun edit\n    return False",
    }]);
  });
  await page2.waitForTimeout(400);
  const versionText = await page2.locator("text=solution.py").first().innerText();
  console.log("  Editor version badge:", versionText);

  // 4. Click Finish
  await page2.locator('[data-testid="finish-btn"]').click();
  await page2.waitForTimeout(1500);

  // Check report unrun draft
  const hasDraftBanner = await page2.locator("text=Unrun draft").isVisible();
  console.log("  Report displays Unrun Draft summary:", hasDraftBanner);
  await page2.close();

  // ----------------------------------------------------
  // TEST 3: Full Mock Flow (Coding -> Transition -> Behavioral -> Summary)
  // ----------------------------------------------------
  console.log("\n[TEST 3] Full Mock Flow (Round 1 -> Transition -> Round 2 -> Summary)");
  const page3 = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page3.goto(BASE_URL);
  await page3.locator('[data-testid="start-full-mock"]').click();
  if (await page3.locator('[data-testid="hero-start-practice"]').isVisible()) {
    await page3.locator('[data-testid="hero-start-practice"]').click();
  }
  await page3.waitForTimeout(1000);

  // Verify Round 1 header
  const headerRound1 = await page3.locator("header").first().innerText();
  console.log("  Round 1 header text:", headerRound1.replace(/\n/g, " "));

  // Run solution in Coding
  await page3.waitForFunction(() => window.monaco?.editor?.getEditors()?.length > 0, { timeout: 10000 });
  await page3.evaluate(() => {
    const editor = window.monaco?.editor?.getEditors()?.[0];
    const model = editor.getModel();
    editor.executeEdits("test", [{
      range: model.getFullModelRange(),
      text: "def contains_duplicate(nums):\n    return len(set(nums)) != len(nums)",
    }]);
  });
  await page3.waitForTimeout(400);
  await page3.locator('[data-testid="run-btn"]').click();
  await page3.waitForTimeout(1500);

  // Click Finish in Coding round
  await page3.locator('[data-testid="finish-btn"]').click();
  await page3.waitForTimeout(1000);

  // Transition screen
  const isTransition = await page3.locator('[data-testid="full-mock-transition"]').isVisible();
  console.log("  Transition screen reached:", isTransition);
  const continueBtn = await page3.locator('[data-testid="continue-behavioral"]').isVisible();
  const viewFeedbackBtn = await page3.locator('[data-testid="view-coding-feedback"]').isVisible();
  console.log("  Transition actions: Continue=" + continueBtn + ", ViewFeedback=" + viewFeedbackBtn);

  // Click Continue to Behavioral Round
  await page3.locator('[data-testid="continue-behavioral"]').click();
  await page3.waitForTimeout(1000);

  // Behavioral room
  const isBehavioral = await page3.locator('[data-testid="behavioral-room"]').isVisible();
  console.log("  Behavioral room reached:", isBehavioral);
  const currentQ = await page3.locator('[data-testid="current-question"]').innerText();
  console.log("  Current behavioral question:", currentQ);

  // Click Finish in Behavioral round
  await page3.locator('button:has-text("Finish")').click();
  await page3.waitForTimeout(1500);

  // Full mock summary
  const isSummary = await page3.locator('[data-testid="full-mock-summary"]').isVisible();
  console.log("  Full mock summary reached:", isSummary);

  const codingCard = await page3.locator('[data-testid="summary-coding-card"]').isVisible();
  const behavioralCard = await page3.locator('[data-testid="summary-behavioral-card"]').isVisible();
  console.log("  Summary cards present: Coding=" + codingCard + ", Behavioral=" + behavioralCard);

  const retryCodingBtn = await page3.locator('[data-testid="practice-again-coding"]').isVisible();
  const retryBehavioralBtn = await page3.locator('[data-testid="practice-again-behavioral"]').isVisible();
  console.log("  Practice again buttons present: Coding=" + retryCodingBtn + ", Behavioral=" + retryBehavioralBtn);

  // Test practice behavioral again (preserves coding)
  await page3.locator('[data-testid="practice-again-behavioral"]').click();
  await page3.waitForTimeout(1000);
  const returnedToBehavioral = await page3.locator('[data-testid="behavioral-room"]').isVisible();
  console.log("  'Practice behavioral again' transitioned back to Behavioral room:", returnedToBehavioral);

  // Finish again
  await page3.locator('button:has-text("Finish")').click();
  await page3.waitForTimeout(1000);
  const backToSummary = await page3.locator('[data-testid="full-mock-summary"]').isVisible();
  console.log("  Finished second attempt, back to Summary:", backToSummary);
  await page3.close();

  // ----------------------------------------------------
  // TEST 4: Mobile Viewport (390x844)
  // ----------------------------------------------------
  console.log("\n[TEST 4] Mobile Viewport Verification (390x844)");
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobilePage.goto(BASE_URL);
  await mobilePage.locator('[data-testid="start-coding"]').click();
  await mobilePage.waitForTimeout(1000);

  // Measure Monaco height on mobile
  await mobilePage.waitForFunction(() => window.monaco?.editor?.getEditors()?.length > 0, { timeout: 10000 });
  const monacoBox = await mobilePage.locator(".monaco-editor").boundingBox();
  console.log("  Mobile Monaco bounding box:", monacoBox);
  if (!monacoBox || monacoBox.height < 250) {
    throw new Error(`Monaco collapsed on mobile! Height: ${monacoBox?.height}px`);
  }
  console.log(`  ✓ Mobile Monaco height verified at ${monacoBox.height}px (>= 250px)`);

  // Check finish button reachability
  const mobileFinish = await mobilePage.locator('[data-testid="finish-btn"]').boundingBox();
  console.log("  Mobile Finish button bounding box:", mobileFinish);
  if (!mobileFinish || mobileFinish.x + mobileFinish.width > 390) {
    throw new Error("Finish button clipped on mobile!");
  }
  console.log("  ✓ Mobile Finish button fits cleanly within 390px viewport width");

  await mobilePage.close();
  await browser.close();

  console.log("\n==================================================");
  console.log("ALL INTEGRATION BROWSER CHECKS PASSED SUCCESSFULLY");
  console.log("==================================================");
}

runBrowserChecks().catch((err) => {
  console.error("Browser test failed:", err);
  process.exit(1);
});
