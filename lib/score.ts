// Deriving a scorecard from rubric ratings.
//
// Three rules shape everything here:
//
// 1. Missing evidence is NOT failure. A skipped round, an empty transcript or a
//    provider error produces "insufficient evidence", never a zero. Zero means
//    "assessed and poor"; absent means "not assessed". Collapsing them would
//    tell a student they did badly at something nobody looked at.
//
// 2. No fake precision. Ratings are ordinal (strong / ok / needs_work), not
//    measurements. Averaging them into "73%" invents accuracy that is not in the
//    data, so the output is a band plus the count of dimensions actually rated.
//
// 3. Four different facts stay four facts. Pass rate, observed runtime,
//    algorithmic complexity and communication quality are separate and must not
//    be blended. In particular a fast run on four small cases says NOTHING about
//    asymptotic complexity: a nested-loop solution passes these cases in
//    milliseconds. Complexity comes only from the `complexity` rubric rating,
//    which is judged from the code and what the student said about it.

import type { Finding, Report, RoundType, RunResult } from "./contract";

export type Rating = Finding["rating"];

// Ordinal weights for the three rated levels. insufficient_evidence is absent
// from this map on purpose: it is excluded from the arithmetic, not scored 0.
const WEIGHT: Record<Exclude<Rating, "insufficient_evidence">, number> = {
  needs_work: 0,
  ok: 1,
  strong: 2,
};
const MAX_WEIGHT = 2;

// Below this many rated dimensions, a single combined figure would be driven by
// one or two findings, so the round is reported as a partial assessment instead.
export const MIN_RATED_DIMENSIONS = 2;

export type Band = "strong" | "solid" | "developing" | "insufficient";

export interface DimensionScore {
  category: Finding["category"];
  rating: Rating;
  rated: boolean; // false => excluded from the arithmetic
  // 0..1 within the dimension, or null when unrated. Drives the rubric bar.
  level: number | null;
}

export interface RoundScore {
  round: RoundType;
  dimensions: DimensionScore[];
  ratedCount: number;
  totalCount: number;
  // 0..1, or null when there is not enough rated evidence to combine.
  level: number | null;
  band: Band;
  // True when something was assessed but not everything.
  partial: boolean;
  // Present whenever level is null or partial is true: why, in one sentence.
  caveat?: string;
}

export interface OverallScore {
  rounds: RoundScore[];
  // Only set when every included round has a level. Never averages a missing
  // round in as zero.
  level: number | null;
  band: Band;
  partial: boolean;
  caveat?: string;
}

// The coding-round facts that must stay distinct from one another.
export interface RunFacts {
  testedVersion: number | null;
  passed: number | null;
  total: number | null;
  // Wall-clock for THIS run on THIS machine over the problem's cases. An
  // observation, not a complexity measurement.
  observedMs: number | null;
  // The version in the editor at Finish when it was never run.
  unrunDraftVersion: number | null;
}

export function bandOf(level: number | null): Band {
  if (level === null) return "insufficient";
  if (level >= 0.75) return "strong";
  if (level >= 0.45) return "solid";
  return "developing";
}

export const BAND_LABEL: Record<Band, string> = {
  strong: "Strong",
  solid: "Solid",
  developing: "Developing",
  insufficient: "Insufficient evidence",
};

/**
 * Score one round from its findings. Deterministic: the same findings always
 * produce the same result, with no model call and no randomness.
 */
export function scoreRound(round: RoundType, findings: readonly Finding[]): RoundScore {
  const dimensions: DimensionScore[] = findings.map((f) => {
    const rated = f.rating !== "insufficient_evidence";
    return {
      category: f.category,
      rating: f.rating,
      rated,
      level: rated ? WEIGHT[f.rating as keyof typeof WEIGHT] / MAX_WEIGHT : null,
    };
  });

  const rated = dimensions.filter((d) => d.rated);
  const totalCount = dimensions.length;
  const ratedCount = rated.length;
  const partial = ratedCount < totalCount;

  if (ratedCount === 0) {
    return {
      round,
      dimensions,
      ratedCount,
      totalCount,
      level: null,
      band: "insufficient",
      partial: totalCount > 0,
      caveat:
        totalCount === 0
          ? "No findings were produced for this round."
          : "Every dimension lacked enough evidence to assess.",
    };
  }

  if (ratedCount < MIN_RATED_DIMENSIONS) {
    return {
      round,
      dimensions,
      ratedCount,
      totalCount,
      level: null,
      band: "insufficient",
      partial: true,
      caveat: `Only ${ratedCount} of ${totalCount} dimensions had enough evidence, too few to combine.`,
    };
  }

  const level = rated.reduce((sum, d) => sum + (d.level ?? 0), 0) / ratedCount;
  return {
    round,
    dimensions,
    ratedCount,
    totalCount,
    level,
    band: bandOf(level),
    partial,
    caveat: partial
      ? `Based on ${ratedCount} of ${totalCount} dimensions; the rest lacked evidence.`
      : undefined,
  };
}

/**
 * Combine rounds. A round that could not be scored is reported alongside the
 * others and excluded from the combined figure — never counted as zero. If no
 * round could be scored, there is no combined figure at all.
 */
export function scoreOverall(rounds: readonly RoundScore[]): OverallScore {
  const scorable = rounds.filter((r) => r.level !== null);

  if (scorable.length === 0) {
    return {
      rounds: [...rounds],
      level: null,
      band: "insufficient",
      partial: rounds.length > 0,
      caveat: "No round had enough evidence to score.",
    };
  }

  const level = scorable.reduce((sum, r) => sum + (r.level as number), 0) / scorable.length;
  const missing = rounds.filter((r) => r.level === null);
  const anyPartial = scorable.some((r) => r.partial);

  let caveat: string | undefined;
  if (missing.length > 0) {
    const names = missing.map((r) => r.round).join(" and ");
    caveat = `Covers the ${scorable.map((r) => r.round).join(" and ")} round only; the ${names} round lacked enough evidence and is not counted.`;
  } else if (anyPartial) {
    caveat = "Some dimensions lacked evidence and were left out.";
  }

  return {
    rounds: [...rounds],
    level,
    band: bandOf(level),
    partial: missing.length > 0 || anyPartial,
    caveat,
  };
}

/**
 * Pull the coding facts apart so a view cannot accidentally present runtime as
 * evidence of complexity. `lastRun` is the tested version; `draftVersion` is the
 * editor buffer at Finish when it was never run.
 */
export function runFacts(lastRun: RunResult | null, draftVersion: number | null): RunFacts {
  const completed = lastRun?.status === "completed" ? lastRun : null;
  return {
    testedVersion: lastRun?.codeVersion ?? null,
    passed: completed ? completed.passed : null,
    total: completed ? completed.total : null,
    observedMs: lastRun?.durationMs ?? null,
    unrunDraftVersion: draftVersion,
  };
}

/**
 * What the rubric says about complexity — and only the rubric. Runtime is
 * deliberately not an input: a fast run on four small cases does not establish
 * good asymptotic complexity.
 */
export function complexityAssessment(findings: readonly Finding[]): DimensionScore | null {
  const f = findings.find((x) => x.category === "complexity");
  if (!f) return null;
  const rated = f.rating !== "insufficient_evidence";
  return {
    category: f.category,
    rating: f.rating,
    rated,
    level: rated ? WEIGHT[f.rating as keyof typeof WEIGHT] / MAX_WEIGHT : null,
  };
}

/** The single next action: the weakest rated dimension, else the first gap. */
export function nextAction(report: Report | null): { category: string; why: string } | null {
  if (!report || report.findings.length === 0) return null;
  const rated = report.findings.filter((f) => f.rating !== "insufficient_evidence");
  if (rated.length > 0) {
    const weakest = rated.reduce((a, b) => (WEIGHT[a.rating as keyof typeof WEIGHT] <= WEIGHT[b.rating as keyof typeof WEIGHT] ? a : b));
    return { category: weakest.category, why: weakest.summary };
  }
  const gap = report.findings[0];
  return { category: gap.category, why: "Not enough evidence was captured to assess this." };
}
