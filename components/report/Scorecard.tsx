"use client";

// Executive debrief scorecard: the band (never a percentage), per-dimension
// meters, and the coding run facts. All numbers come from lib/score.ts:
// unassessed dimensions are shown as a dash and left out of every band, never
// counted as zero, and runtime is never presented as complexity evidence.
import type { RoundType } from "@/lib/contract";
import { BAND_LABEL, type Band, type DimensionScore, type OverallScore, type RoundScore, type RunFacts } from "@/lib/score";
import { categoryLabel, RATING_WORD, TRACK_LABEL } from "./debrief";

export const SHADOW = "shadow-[0_10px_18px_-6px_rgb(90_68_50/0.13)]";

// Fills: strong = burgundy, solid = warm ochre, developing = warm sand. The
// rating word is always printed beside the meter, so colour is never the only cue.
const FILL: Record<Exclude<Band, "insufficient">, string> = {
  strong: "bg-maroon",
  solid: "bg-[#C08A2E]",
  developing: "bg-[#D6BC8E]",
};
const SEGMENTS: Record<Exclude<Band, "insufficient">, number> = { strong: 3, solid: 2, developing: 1 };

const BADGE: Record<Band, string> = {
  strong: "bg-maroon text-white",
  solid: "bg-[#F1DFBC] text-[#6E4A0E]",
  developing: "bg-[#EEE2CC] text-[#5E4B36]",
  insufficient: "bg-cream-3 text-[#5F5249]",
};
export const BAND_TEXT: Record<Band, string> = {
  strong: "text-maroon",
  solid: "text-[#8A5A12]",
  developing: "text-[#6B5640]",
  insufficient: "text-[#5F5249]",
};

const ratingBand = (d: DimensionScore): Band =>
  d.rating === "strong" ? "strong" : d.rating === "ok" ? "solid" : d.rating === "needs_work" ? "developing" : "insufficient";

export function BandBadge({ band, testId, size = "sm" }: { band: Band; testId?: string; size?: "sm" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ${BADGE[band]} ${size === "lg" ? "px-4 py-1.5 text-sm" : "px-3 py-1 text-xs"}`}
      data-testid={testId}
    >
      {band !== "insufficient" && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${band === "strong" ? "bg-white" : "bg-current"}`} />}
      {BAND_LABEL[band]}
    </span>
  );
}

// One assessed dimension: label, rating word, and a three-step meter.
function Meter({ d }: { d: DimensionScore }) {
  const band = ratingBand(d);
  const word = RATING_WORD[d.rating];
  const name = categoryLabel(d.category);
  return (
    <div role="listitem" className="flex flex-col gap-1.5" data-testid={`rubric-${d.category}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink">{name}</span>
        <span className="text-xs font-semibold text-ink-muted">{word}</span>
      </div>
      <div className="grid grid-cols-3 gap-1" role="img" aria-label={`${name}: ${word}`}>
        {[0, 1, 2].map((i) =>
          band === "insufficient" ? (
            // A dash, not an empty bar: unassessed is not zero.
            <span key={i} className="h-2 rounded-full border border-dashed border-[#BFAE97]" />
          ) : (
            <span key={i} className={`h-2 rounded-full ${i < SEGMENTS[band] ? FILL[band] : "bg-cream-3"}`} />
          ),
        )}
      </div>
    </div>
  );
}

export function DimensionMeters({ score }: { score: RoundScore }) {
  if (score.dimensions.length === 0) return null;
  // De-duplicate repeated categories (keep the first, as lib/score lists them).
  const seen = new Set<string>();
  const dims = score.dimensions.filter((d) => (seen.has(d.category) ? false : (seen.add(d.category), true)));
  return (
    <div role="list" aria-label={`${TRACK_LABEL[score.round]} dimensions`} className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {dims.map((d) => (
        <Meter key={d.category} d={d} />
      ))}
    </div>
  );
}

// Four coding facts kept apart: tests, observed runtime, complexity (rubric),
// and an unrun final draft.
export function RunFactsBlock({ facts, complexity }: { facts: RunFacts; complexity?: DimensionScore }) {
  const hasRun = facts.testedVersion !== null;
  const cell = "rounded-[16px] bg-white/70 px-3.5 py-3";
  return (
    <div className="grid grid-cols-2 gap-2.5 text-sm" data-testid="run-facts">
      <div className={cell}>
        <div className="text-xs text-ink-muted">Tests passed</div>
        <div className="font-semibold text-ink">
          {facts.passed !== null ? `${facts.passed}/${facts.total}` : "Not run"}
          {hasRun && <span className="ml-1 font-normal text-ink-muted">on v{facts.testedVersion}</span>}
        </div>
      </div>
      <div className={cell}>
        <div className="text-xs text-ink-muted">Observed runtime</div>
        <div className="font-semibold text-ink">
          {facts.observedMs !== null ? `${facts.observedMs} ms` : "—"}
          <span className="ml-1 font-normal text-ink-muted">on these cases</span>
        </div>
      </div>
      <div className={cell}>
        <div className="text-xs text-ink-muted">Complexity (from the rubric)</div>
        <div className="font-semibold text-ink">{complexity ? RATING_WORD[complexity.rating] : "Not assessed"}</div>
      </div>
      <div className={cell}>
        <div className="text-xs text-ink-muted">Final draft</div>
        <div className="font-semibold text-ink" data-testid="score-unrun-draft">
          {facts.unrunDraftVersion !== null ? `v${facts.unrunDraftVersion}, never run` : "Same as tested"}
        </div>
      </div>
      <p className="col-span-2 text-xs leading-relaxed text-ink-muted">
        Runtime is what these small test cases took here. It doesn&apos;t measure how the solution scales; that is the complexity rating.
      </p>
    </div>
  );
}

const HEADLINE: Record<Band, string> = {
  strong: "Strong performance",
  solid: "Solid performance",
  developing: "Developing, with a clear path forward",
  insufficient: "Not enough evidence to score yet",
};
const SUBLINE: Record<Band, string> = {
  strong: "You showed strong signals in everything that was assessed. Keep the habits that got you here.",
  solid: "A solid showing, with specific things to sharpen below.",
  developing: "A clear starting point. The action plan below says exactly what to practice.",
  insufficient: "The interview didn't capture enough to rate. The evaluations below say what was missing.",
};

// The executive summary at the top of the debrief.
export function DebriefHero({
  overall,
  rounds,
  roleLabel,
}: {
  overall: OverallScore;
  rounds: { round: RoundType; score: RoundScore | null; state: "done" | "loading" | "error" | "missing" }[];
  roleLabel?: string;
}) {
  const scored = overall.rounds.filter((r) => r.level !== null).length;
  return (
    <section className={`relative overflow-hidden rounded-[30px] bg-cream-2 p-6 sm:p-8 ${SHADOW}`} data-testid="scorecard">
      {/* Soft decorative glow; no information in it. */}
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-maroon-soft/25 blur-3xl" />
      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-maroon-deep" data-testid="score-role">
          {roleLabel ?? "Your interview debrief"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <BandBadge band={overall.band} size="lg" testId="score-overall-band" />
          <span className="text-sm text-ink-muted">
            {overall.level !== null ? `across ${scored} scored evaluation${scored === 1 ? "" : "s"}` : "no evaluation could be scored"}
          </span>
        </div>
        <h1 className={`mt-3 font-brand text-[30px] font-bold leading-tight tracking-tight sm:text-[38px] ${BAND_TEXT[overall.band]}`}>
          {HEADLINE[overall.band]}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-muted">{SUBLINE[overall.band]}</p>
        {overall.caveat && (
          <p className="mt-4 rounded-[18px] bg-cream-3 px-4 py-3 text-sm leading-relaxed text-ink" data-testid="score-overall-caveat">
            {overall.caveat}
          </p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {rounds.map(({ round, score, state }) => (
            <a
              key={round}
              href={`#track-${round}`}
              className="group flex flex-col gap-2 rounded-[22px] bg-white/75 p-4 transition-colors hover:bg-white"
              data-testid={`score-round-${round}`}
            >
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">{TRACK_LABEL[round]}</span>
              <span className="flex flex-wrap items-center gap-2">
                {score ? (
                  <BandBadge band={score.band} testId={`score-band-${round}`} />
                ) : (
                  <span className="text-sm font-semibold text-ink-muted">
                    {state === "loading" ? "Evaluation in progress…" : state === "error" ? "Evaluation unavailable" : "Not completed"}
                  </span>
                )}
                {score && (
                  <span className="text-xs text-ink-muted">
                    {score.ratedCount} of {score.totalCount} dimensions assessed
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold text-maroon-deep group-hover:underline">See the evidence ↓</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
