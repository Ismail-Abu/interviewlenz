// Dev-only check for lib/score.ts (not shipped). Pure logic: no key, network,
// provider, or browser.
//
// The rules worth guarding are the ones that would quietly lie to a student:
// missing evidence rendered as a zero, a skipped round dragging an average
// down, a combined figure invented from one finding, or runtime presented as
// proof of good asymptotic complexity.
//
// Run: node --experimental-strip-types dev/score-check.mjs

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const {
  scoreRound, scoreOverall, runFacts, complexityAssessment, nextAction,
  bandOf, MIN_RATED_DIMENSIONS,
} = await import(pathToFileURL(join(ROOT, "lib", "score.ts")).href);

let fails = 0;
const assert = (label, cond, extra) => {
  if (!cond) fails += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || extra === undefined ? "" : `  (${extra})`}`);
};

const f = (category, rating, summary = "s") => ({ id: category, category, rating, summary, evidence: [] });

console.log("== A. A rated round");
{
  const r = scoreRound("coding", [
    f("correctness", "strong"), f("approach", "strong"),
    f("complexity", "ok"), f("spoken_reasoning", "needs_work"),
  ]);
  assert("A1 all four dimensions counted", r.ratedCount === 4 && r.totalCount === 4);
  assert("A2 not flagged partial", r.partial === false);
  // strong=1, strong=1, ok=0.5, needs_work=0 -> 2.5/4
  assert("A3 level is the mean of the rated levels", Math.abs(r.level - 0.625) < 1e-9, `${r.level}`);
  assert("A4 band follows the level", r.band === "solid", r.band);
  assert("A5 no caveat when everything was assessed", r.caveat === undefined);
}

console.log("\n== B. Missing evidence is never a zero");
{
  const r = scoreRound("behavioral", [
    f("specificity", "strong"), f("reasoning", "strong"),
    f("outcome", "insufficient_evidence"), f("personal_contribution", "insufficient_evidence"),
  ]);
  assert("B1 unrated dimensions are excluded, not counted as 0", r.ratedCount === 2 && r.totalCount === 4);
  // Two strongs -> 1.0. Scoring the gaps as 0 would have given 0.5.
  assert("B2 level reflects only what was assessed", Math.abs(r.level - 1) < 1e-9, `${r.level}`);
  assert("B3 band is strong, not dragged down by the gaps", r.band === "strong", r.band);
  assert("B4 flagged partial", r.partial === true);
  assert("B5 the caveat says how much was covered", /2 of 4/.test(r.caveat ?? ""), r.caveat);

  const unrated = r.dimensions.filter((d) => !d.rated);
  assert("B6 an unrated dimension has level null, not 0", unrated.every((d) => d.level === null));
}

console.log("\n== C. Too little evidence to combine");
{
  const r = scoreRound("behavioral", [
    f("specificity", "strong"),
    f("reasoning", "insufficient_evidence"),
    f("outcome", "insufficient_evidence"),
  ]);
  assert(`C1 below ${MIN_RATED_DIMENSIONS} rated dimensions there is no combined figure`, r.level === null);
  assert("C2 reported as insufficient evidence", r.band === "insufficient");
  assert("C3 explains why", /too few/.test(r.caveat ?? ""), r.caveat);
}
{
  const r = scoreRound("behavioral", []);
  assert("C4 a round with no findings is insufficient, not zero", r.level === null && r.band === "insufficient");
  assert("C5 says no findings were produced", /No findings/.test(r.caveat ?? ""), r.caveat);
}
{
  const r = scoreRound("coding", [f("correctness", "insufficient_evidence")]);
  assert("C6 all-unrated is insufficient, not zero", r.level === null && r.band === "insufficient");
}

console.log("\n== D. A skipped round never drags the overall down");
{
  const good = scoreRound("coding", [f("correctness", "strong"), f("approach", "strong")]);
  const skipped = scoreRound("behavioral", []);
  const o = scoreOverall([good, skipped]);
  assert("D1 the skipped round is excluded from the combined figure", Math.abs(o.level - 1) < 1e-9, `${o.level}`);
  assert("D2 the overall is not halved by the missing round", o.band === "strong", o.band);
  assert("D3 flagged partial", o.partial === true);
  assert("D4 names the round that is not counted", /behavioral/.test(o.caveat ?? ""), o.caveat);
  assert("D5 the skipped round is still listed", o.rounds.length === 2);
}
{
  const o = scoreOverall([scoreRound("coding", []), scoreRound("behavioral", [])]);
  assert("D6 with nothing scorable there is no combined figure at all", o.level === null && o.band === "insufficient");
}

console.log("\n== E. Runtime is not complexity");
{
  // A nested-loop solution passing four tiny cases in 12 ms.
  const run = {
    sessionId: "s", problemId: "p", codeVersion: 3, ranAt: "2026-11-15T00:00:00Z",
    durationMs: 12, status: "completed", passed: 4, total: 4, cases: [],
  };
  const facts = runFacts(run, 4);
  assert("E1 pass rate is its own fact", facts.passed === 4 && facts.total === 4);
  assert("E2 observed runtime is its own fact", facts.observedMs === 12);
  assert("E3 the tested version is recorded", facts.testedVersion === 3);
  assert("E4 the unrun draft is separate from the tested version", facts.unrunDraftVersion === 4);

  // 4/4 and 12 ms, yet the rubric says the complexity reasoning needs work.
  const complexity = complexityAssessment([f("complexity", "needs_work"), f("correctness", "strong")]);
  assert("E5 complexity comes from the rubric, not the clock", complexity.rating === "needs_work");
  assert("E6 a fast passing run does not make complexity strong", complexity.level === 0);

  const none = complexityAssessment([f("correctness", "strong")]);
  assert("E7 no complexity finding yields null, not a guess", none === null);
}

console.log("\n== F. Determinism and bands");
{
  const findings = [f("correctness", "ok"), f("approach", "strong"), f("complexity", "needs_work")];
  const a = JSON.stringify(scoreRound("coding", findings));
  const b = JSON.stringify(scoreRound("coding", findings));
  assert("F1 the same findings always give the same result", a === b);
  assert("F2 band boundaries", bandOf(1) === "strong" && bandOf(0.5) === "solid" && bandOf(0.1) === "developing");
  assert("F3 a null level is insufficient, never developing", bandOf(null) === "insufficient");
}

console.log("\n== G. One next action");
{
  const report = {
    reportId: "r", sessionId: "s", attemptId: "a", createdAt: "2026-11-15T00:00:00Z", nextStep: "n",
    findings: [f("correctness", "strong", "Correct."), f("complexity", "needs_work", "Called the nested loop linear.")],
  };
  const n = nextAction(report);
  assert("G1 points at the weakest rated dimension", n.category === "complexity", n.category);
  assert("G2 carries the reason from that finding", /nested loop/.test(n.why));

  const allGaps = { ...report, findings: [f("outcome", "insufficient_evidence")] };
  assert("G3 with only gaps it still suggests something, blaming evidence", /evidence/i.test(nextAction(allGaps).why));
  assert("G4 no findings yields no action rather than a fabricated one", nextAction({ ...report, findings: [] }) === null);
}

console.log(`\n${fails === 0 ? "score-check: all checks passed" : `score-check: ${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
