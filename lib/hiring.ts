// Hiring recommendation: the 4-point scale real interview loops use, and the
// hard caps the server applies so a lenient evaluator can never pass a
// candidate the evidence does not support. Pure and dependency-free (server
// and client).
//
// Why caps: competitive loops are decided conservatively. Interviewers count
// a "lean no" as a no, treat missing signal as no signal, and a single clear
// miss in a core area (a failing solution, wrong complexity, a "we"-only story)
// sinks the round. The evaluator model proposes a recommendation; these rules
// only ever LOWER it.
import { HIRING_RECOMMENDATIONS, type Finding, type HiringRecommendation, type RunResult } from "./contract";

export const RECOMMENDATION_LABEL: Record<HiringRecommendation, string> = {
  strong_no_hire: "Strong no hire",
  lean_no_hire: "Leaning no hire",
  lean_hire: "Leaning hire",
  strong_hire: "Strong hire",
};

// What each level means, shown next to the decision.
export const RECOMMENDATION_MEANING: Record<HiringRecommendation, string> = {
  strong_no_hire: "A clear miss on a core signal. This would not move forward.",
  lean_no_hire: "On balance a no: gaps outweigh strengths. In a competitive loop this is a rejection.",
  lean_hire: "On balance a yes, with gaps. Competitive loops often need more than this to make an offer.",
  strong_hire: "Clearly above the bar on every core signal, with little or no help.",
};

export const rank = (r: HiringRecommendation) => HIRING_RECOMMENDATIONS.indexOf(r);
export const lower = (a: HiringRecommendation, b: HiringRecommendation) => (rank(a) <= rank(b) ? a : b);
export const isRecommendation = (v: unknown): v is HiringRecommendation =>
  typeof v === "string" && (HIRING_RECOMMENDATIONS as readonly string[]).includes(v);

export interface Cap {
  max: HiringRecommendation;
  reasons: string[];
}

const rating = (findings: readonly Finding[], category: Finding["category"]) =>
  findings.find((f) => f.category === category)?.rating;

function capper() {
  let max: HiringRecommendation = "strong_hire";
  const reasons: string[] = [];
  return {
    cap(level: HiringRecommendation, reason: string) {
      if (rank(level) < rank("strong_hire")) reasons.push(reason);
      max = lower(max, level);
    },
    done: (): Cap => ({ max, reasons }),
  };
}

const CODING_CORE: Finding["category"][] = ["correctness", "approach", "complexity"];
const CODING_LABEL: Partial<Record<Finding["category"], string>> = {
  correctness: "correctness", approach: "approach", complexity: "complexity analysis",
  clarification: "clarifying the problem", testing: "testing", code_clarity: "code clarity",
  spoken_reasoning: "explaining your reasoning",
};

/**
 * The highest recommendation a coding attempt can receive.
 * `finalRun` is the run of the last code version (null when the last version
 * was never run); `unrunDraft` is true when the final code was edited after its
 * last run.
 */
export function codingCap(findings: readonly Finding[], runs: readonly RunResult[], unrunDraft: boolean): Cap {
  const c = capper();
  const last = runs.at(-1);
  if (!last) {
    c.cap("strong_no_hire", "The code was never run, so there is no evidence it works.");
  } else if (last.status === "error") {
    c.cap("strong_no_hire", `The last run ended in an error (${last.error.code.replace(/_/g, " ")}).`);
  } else if (last.passed < last.total) {
    c.cap(last.passed === 0 ? "strong_no_hire" : "lean_no_hire", `The final tested code failed ${last.total - last.passed} of ${last.total} test cases.`);
  }
  if (unrunDraft) c.cap("lean_hire", "The final code was changed after its last run and never re-tested.");
  const finalPassed = !!last && last.status === "completed" && last.total > 0 && last.passed === last.total && !unrunDraft;
  for (const cat of CODING_CORE) {
    const r = rating(findings, cat);
    // The runs themselves are the correctness signal when the evaluator is silent.
    if (cat === "correctness" && finalPassed && (r === undefined || r === "insufficient_evidence")) continue;
    if (r === "needs_work") c.cap("lean_no_hire", `Needs work on a core signal: ${CODING_LABEL[cat]}.`);
    else if (r === undefined || r === "insufficient_evidence") c.cap("lean_hire", `No clear signal on ${CODING_LABEL[cat]}.`);
    else if (r === "ok") c.cap("lean_hire", `${cap1(CODING_LABEL[cat]!)} was adequate but not strong.`);
  }
  for (const f of findings) {
    if (!CODING_CORE.includes(f.category) && f.rating === "needs_work") c.cap("lean_hire", `Needs work on ${CODING_LABEL[f.category] ?? f.category}.`);
  }
  return c.done();
}

const BEHAVIORAL_LABEL: Partial<Record<Finding["category"], string>> = {
  specificity: "specific detail", personal_contribution: "your personal contribution",
  reasoning: "your reasoning", outcome: "the outcome and how it was measured",
};

export function behavioralCap(findings: readonly Finding[]): Cap {
  const c = capper();
  const rated = findings.filter((f) => f.rating !== "insufficient_evidence");
  if (rated.length === 0) c.cap("lean_no_hire", "Not enough was said to assess any signal; no signal reads as no hire.");
  for (const f of findings) {
    const label = BEHAVIORAL_LABEL[f.category] ?? f.category;
    const core = f.category === "personal_contribution" || f.category === "outcome";
    if (f.rating === "needs_work") c.cap(core ? "lean_no_hire" : "lean_hire", `Needs work on ${label}.`);
    else if (f.rating === "insufficient_evidence") c.cap("lean_hire", `No clear signal on ${label}.`);
  }
  const strong = findings.filter((f) => f.rating === "strong").length;
  if (rated.length > 0 && strong < 3) c.cap("lean_hire", "Fewer than three signals were clearly strong.");
  return c.done();
}

function cap1(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
