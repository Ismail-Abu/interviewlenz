"use client";

import type { Finding, Report, RoundType } from "@/lib/contract";
import {
  BAND_LABEL, complexityAssessment, nextAction, runFacts, scoreOverall, scoreRound,
  type Band, type DimensionScore, type RoundScore, type RunFacts,
} from "@/lib/score";

const SHADOW = "shadow-[0_10px_18px_-6px_rgb(90_68_50/0.13)]";

const BAND_TONE: Record<Band, { text: string; bar: string; chip: string }> = {
  strong: { text: "text-[#2E7D4F]", bar: "bg-[#2E7D4F]", chip: "bg-[#2E7D4F]/12 text-[#2E7D4F]" },
  solid: { text: "text-[#B07A1E]", bar: "bg-[#B07A1E]", chip: "bg-[#B07A1E]/12 text-[#B07A1E]" },
  developing: { text: "text-maroon", bar: "bg-maroon", chip: "bg-maroon/12 text-maroon-deep" },
  insufficient: { text: "text-ink-muted", bar: "bg-ink-muted", chip: "bg-cream-3 text-ink-muted" },
};

const CATEGORY_LABEL: Record<string, string> = {
  correctness: "Correctness",
  clarification: "Clarifying questions",
  approach: "Approach",
  complexity: "Complexity reasoning",
  testing: "Testing",
  code_clarity: "Code clarity",
  spoken_reasoning: "Spoken reasoning",
  specificity: "Specificity",
  personal_contribution: "Personal contribution",
  reasoning: "Reasoning",
  outcome: "Outcome",
};
const label = (c: string) => CATEGORY_LABEL[c] ?? c.replace(/_/g, " ");

// A rubric bar. Never colour alone: the rating word is always beside it, and the
// bar carries its own text alternative.
function RubricBar({ d }: { d: DimensionScore }) {
  const band: Band = d.level === null ? "insufficient" : d.level >= 0.75 ? "strong" : d.level >= 0.45 ? "solid" : "developing";
  const tone = BAND_TONE[band];
  const pct = d.level === null ? 0 : Math.round(d.level * 100);
  const word = d.rated ? d.rating.replace(/_/g, " ") : "insufficient evidence";
  return (
    <li className="flex flex-col gap-1.5" data-testid={`rubric-${d.category}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink">{label(d.category)}</span>
        <span className={`text-xs font-semibold ${tone.text}`}>{word}</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-cream-3"
        role="img"
        aria-label={`${label(d.category)}: ${word}`}
      >
        {d.level !== null ? (
          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
        ) : (
          // Hatched, not empty: an unrated dimension is not a zero-length bar.
          <div className="h-full w-full bg-[repeating-linear-gradient(135deg,#E3D3B8_0_6px,transparent_6px_12px)]" />
        )}
      </div>
    </li>
  );
}

function RoundBlock({ score, facts }: { score: RoundScore; facts?: RunFacts }) {
  const tone = BAND_TONE[score.band];
  return (
    <section className={`rounded-[26px] bg-cream-2 p-5 ${SHADOW}`} data-testid={`score-round-${score.round}`}>
      <header className="flex flex-wrap items-center gap-3">
        <h3 className="text-base font-bold capitalize text-ink">{score.round}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone.chip}`} data-testid={`score-band-${score.round}`}>
          {BAND_LABEL[score.band]}
        </span>
        <span className="ml-auto text-xs text-ink-muted">
          {score.ratedCount} of {score.totalCount} dimensions assessed
        </span>
      </header>

      {score.caveat && (
        <p className="mt-2 text-xs leading-relaxed text-ink-muted" data-testid={`score-caveat-${score.round}`}>
          {score.caveat}
        </p>
      )}

      {score.dimensions.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {score.dimensions.map((d) => (
            <RubricBar key={d.category} d={d} />
          ))}
        </ul>
      )}

      {facts && <RunFactsBlock facts={facts} complexity={score.dimensions.find((d) => d.category === "complexity")} />}
    </section>
  );
}

// Four facts, kept four facts. Runtime is labelled as an observation so it is
// not read as evidence of asymptotic complexity.
function RunFactsBlock({ facts, complexity }: { facts: RunFacts; complexity?: DimensionScore }) {
  const hasRun = facts.testedVersion !== null;
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-cream-3 pt-4 text-sm" data-testid="run-facts">
      <div>
        <dt className="text-xs text-ink-muted">Tests passed</dt>
        <dd className="font-semibold text-ink">
          {facts.passed !== null ? `${facts.passed}/${facts.total}` : "Not run"}
          {hasRun && <span className="ml-1 font-normal text-ink-muted">on v{facts.testedVersion}</span>}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-ink-muted">Observed runtime</dt>
        <dd className="font-semibold text-ink">
          {facts.observedMs !== null ? `${facts.observedMs} ms` : "—"}
          <span className="ml-1 font-normal text-ink-muted">on these cases</span>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-ink-muted">Complexity (from the rubric)</dt>
        <dd className="font-semibold text-ink">
          {complexity ? complexity.rating.replace(/_/g, " ") : "Not assessed"}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-ink-muted">Final draft</dt>
        <dd className="font-semibold text-ink" data-testid="score-unrun-draft">
          {facts.unrunDraftVersion !== null ? `v${facts.unrunDraftVersion} — never run` : "Same as tested"}
        </dd>
      </div>
      <p className="col-span-2 text-xs leading-relaxed text-ink-muted">
        Runtime is what these four small cases took here. It is not a measure of
        how the solution scales — that is the complexity rating above.
      </p>
    </dl>
  );
}

export interface ScorecardProps {
  roleLabel?: string;
  coding?: { report: Report | null; lastRun?: Parameters<typeof runFacts>[0]; draftVersion?: number | null };
  behavioral?: { report: Report | null };
  onPractice?: (round: RoundType) => void;
}

export function Scorecard({ roleLabel, coding, behavioral, onPractice }: ScorecardProps) {
  const rounds: RoundScore[] = [];
  if (coding) rounds.push(scoreRound("coding", (coding.report?.findings ?? []) as Finding[]));
  if (behavioral) rounds.push(scoreRound("behavioral", (behavioral.report?.findings ?? []) as Finding[]));
  const overall = scoreOverall(rounds);
  const tone = BAND_TONE[overall.band];

  // One recommended action: from the weaker scorable round, else whichever has findings.
  const weaker = [...rounds].filter((r) => r.level !== null).sort((a, b) => (a.level as number) - (b.level as number))[0];
  const src = weaker?.round === "behavioral" ? behavioral?.report : coding?.report;
  const action = nextAction(src ?? coding?.report ?? behavioral?.report ?? null);
  const actionRound: RoundType = weaker?.round ?? "coding";

  const facts = coding ? runFacts(coding.lastRun ?? null, coding.draftVersion ?? null) : undefined;
  void complexityAssessment; // complexity is surfaced through the round's own dimension

  return (
    <div data-surface="cream" className="flex flex-col gap-5" data-testid="scorecard">
      {/* 1. How did this interview go? */}
      <section className={`rounded-[30px] bg-cream-2 p-7 ${SHADOW}`}>
        {roleLabel && (
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-maroon" data-testid="score-role">
            {roleLabel}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <h2 className={`text-[34px] font-bold leading-tight ${tone.text}`} data-testid="score-overall-band">
            {BAND_LABEL[overall.band]}
          </h2>
          <span className="text-sm text-ink-muted">
            {overall.level !== null
              ? `across ${overall.rounds.filter((r) => r.level !== null).length} scored round${
                  overall.rounds.filter((r) => r.level !== null).length === 1 ? "" : "s"
                }`
              : "not enough evidence to score"}
          </span>
        </div>
        {overall.caveat && (
          <p className="mt-3 rounded-[18px] bg-cream-3 px-4 py-3 text-sm leading-relaxed text-ink-muted" data-testid="score-overall-caveat">
            {overall.caveat}
          </p>
        )}

        {/* 3. What should I practice next? */}
        {action && (
          <div className="mt-5 border-t border-cream-3 pt-5" data-testid="score-next-action">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">Practice next</p>
            <p className="mt-1 text-lg font-semibold text-ink">{label(action.category)}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">{action.why}</p>
            {onPractice && (
              <button
                onClick={() => onPractice(actionRound)}
                className="mt-4 inline-flex items-center justify-center rounded-[18px] bg-maroon px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-maroon-hover"
                data-testid="score-practice-weaker"
              >
                Practice the {actionRound} round again
              </button>
            )}
          </div>
        )}
      </section>

      {/* 2. What evidence supports that? — per-round rubric + facts */}
      <div className="grid gap-5 md:grid-cols-2">
        {rounds.map((r) => (
          <RoundBlock key={r.round} score={r} facts={r.round === "coding" ? facts : undefined} />
        ))}
      </div>
    </div>
  );
}
