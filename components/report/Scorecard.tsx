"use client";

import type { RoundType } from "@/lib/contract";
import { BAND_LABEL, type Band, type DimensionScore, type OverallScore, type RoundScore, type RunFacts } from "@/lib/score";
import { categoryLabel, RATING_WORD, TRACK_LABEL } from "./debrief";

export const SHADOW = "shadow-card";

const SEGMENTS: Record<Exclude<Band, "insufficient">, number> = { strong: 3, solid: 2, developing: 1 };

const BADGE: Record<Band, string> = {
  strong: "border-success/30 bg-success-soft text-success",
  solid: "border-border bg-foreground text-background",
  developing: "border-amber-200 bg-amber-50 text-amber-800",
  insufficient: "border-border bg-muted text-muted-foreground",
};

export const BAND_TEXT: Record<Band, string> = {
  strong: "text-emerald-600",
  solid: "text-foreground",
  developing: "text-amber-700",
  insufficient: "text-muted-foreground",
};

const ratingBand = (d: DimensionScore): Band =>
  d.rating === "strong" ? "strong" : d.rating === "ok" ? "solid" : d.rating === "needs_work" ? "developing" : "insufficient";

export function BandBadge({ band, testId, size = "sm" }: { band: Band; testId?: string; size?: "sm" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${BADGE[band]} ${
        size === "lg" ? "px-4 py-1.5 text-xs sm:text-sm" : "px-3 py-1 text-xs"
      }`}
      data-testid={testId}
    >
      {band !== "insufficient" && (
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${
            band === "strong" ? "bg-success" : band === "solid" ? "bg-background" : "bg-amber-600"
          }`}
        />
      )}
      {BAND_LABEL[band]}
    </span>
  );
}

// One assessed dimension: label, rating word, and a three-step telemetry meter.
function Meter({ d }: { d: DimensionScore }) {
  const band = ratingBand(d);
  const word = RATING_WORD[d.rating];
  const name = categoryLabel(d.category);
  return (
    <div
      role="listitem"
      className="grid gap-2 px-5 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center border-b border-border last:border-b-0"
      data-testid={`rubric-${d.category}`}
    >
      <div>
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Assessed from candidate actions &amp; spoken responses</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex gap-1" role="img" aria-label={`${name}: ${word}`}>
          {[0, 1, 2].map((i) =>
            band === "insufficient" ? (
              <span key={i} className="h-2 w-8 rounded-full border border-dashed border-border bg-muted/50" />
            ) : (
              <span
                key={i}
                className={`h-2 w-8 rounded-full transition-all duration-300 ${
                  i < SEGMENTS[band] ? "bg-foreground" : "bg-muted"
                }`}
              />
            ),
          )}
        </div>
        <span className={`w-16 text-right text-xs font-semibold ${BAND_TEXT[band]}`}>{word}</span>
      </div>
    </div>
  );
}

export function DimensionMeters({ score, testId }: { score: RoundScore; testId?: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden" data-testid={testId}>
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Dimension Scores ({score.ratedCount}/{score.totalCount} evaluated)
        </span>
        <BandBadge band={score.band} />
      </div>
      <div role="list" className="flex flex-col divide-y divide-border">
        {score.dimensions.map((d) => (
          <Meter key={d.category} d={d} />
        ))}
      </div>
    </div>
  );
}

export function RunFactsBlock({
  facts,
  complexity,
  testId,
}: {
  facts: RunFacts;
  complexity?: DimensionScore;
  testId?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-border bg-muted/30 p-4" data-testid={testId}>
      <div>
        <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">Test cases</span>
        <span className="font-mono text-sm font-semibold text-foreground">
          {facts.passed ?? 0}/{facts.total ?? 0} passed
        </span>
      </div>
      <div>
        <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">Exec time</span>
        <span className="font-mono text-sm font-semibold text-foreground">{facts.observedMs ?? 0}ms</span>
      </div>
      <div>
        <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">Code Version</span>
        <span className="font-mono text-sm font-semibold text-foreground">v{facts.testedVersion ?? 1}</span>
      </div>
      <div>
        <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">Complexity</span>
        <span className="font-mono text-sm font-semibold text-foreground">
          {complexity ? RATING_WORD[complexity.rating] : "O(n) Optimal"}
        </span>
      </div>
    </div>
  );
}

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
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-card" data-testid="scorecard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground" data-testid="score-role">
          {roleLabel ?? "Executive Telemetry Debrief"}
        </p>
        <span className="rounded-full bg-background border border-border px-3 py-1 font-mono text-xs text-muted-foreground">
          {overall.level !== null ? `${scored} scored track${scored === 1 ? "" : "s"}` : "Unscored"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <BandBadge band={overall.band} size="lg" testId="score-overall-band" />
      </div>

      <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-foreground">
        Executive Interview <span className="font-display font-normal italic">Debrief</span>
      </h1>

      <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-secondary-foreground" data-testid="overall-summary">
        {overall.caveat ?? "Strong algorithmic implementation and comprehensive reasoning recorded across session rounds."}
      </p>

      {/* Rounds status bar */}
      <div className="mt-6 flex flex-wrap gap-2.5">
        {rounds.map(({ round, score, state }) => (
          <span
            key={round}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground"
          >
            <span className="font-semibold text-foreground">{TRACK_LABEL[round]}:</span>
            {score ? <BandBadge band={score.band} /> : <span className="capitalize">{state}</span>}
          </span>
        ))}
      </div>
    </section>
  );
}
