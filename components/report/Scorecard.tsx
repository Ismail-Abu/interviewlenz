"use client";

// Executive debrief scorecard: the band (never a percentage), per-dimension
// meters, and the coding run facts. All numbers come from lib/score.ts:
// unassessed dimensions are shown as a dash and left out of every band, never
// counted as zero, and runtime is never presented as complexity evidence.
import type { RoundType } from "@/lib/contract";
import { BAND_LABEL, type Band, type DimensionScore, type OverallScore, type RoundScore, type RunFacts } from "@/lib/score";
import { categoryLabel, RATING_WORD, TRACK_LABEL } from "./debrief";

export const SHADOW = "shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]";

// High-tech fills for telemetry meters:
// strong = vibrant ruby/rose, solid = warm amber, developing = cool slate.
const FILL: Record<Exclude<Band, "insufficient">, string> = {
  strong: "bg-gradient-to-r from-rose-500 to-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.4)]",
  solid: "bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]",
  developing: "bg-zinc-500",
};
const SEGMENTS: Record<Exclude<Band, "insufficient">, number> = { strong: 3, solid: 2, developing: 1 };

const BADGE: Record<Band, string> = {
  strong: "bg-rose-950/80 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(225,29,72,0.2)]",
  solid: "bg-amber-950/80 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]",
  developing: "bg-zinc-800 text-zinc-300 border border-zinc-700",
  insufficient: "bg-zinc-900/90 text-zinc-400 border border-zinc-800",
};

export const BAND_TEXT: Record<Band, string> = {
  strong: "text-rose-400",
  solid: "text-amber-400",
  developing: "text-zinc-300",
  insufficient: "text-zinc-400",
};

const ratingBand = (d: DimensionScore): Band =>
  d.rating === "strong" ? "strong" : d.rating === "ok" ? "solid" : d.rating === "needs_work" ? "developing" : "insufficient";

export function BandBadge({ band, testId, size = "sm" }: { band: Band; testId?: string; size?: "sm" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wider ${BADGE[band]} ${
        size === "lg" ? "px-4 py-1.5 text-xs sm:text-sm" : "px-3 py-1 text-[11px]"
      }`}
      data-testid={testId}
    >
      {band !== "insufficient" && (
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${
            band === "strong" ? "bg-rose-400 animate-pulse" : band === "solid" ? "bg-amber-400" : "bg-zinc-400"
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
    <div role="listitem" className="flex flex-col gap-2 rounded-[16px] bg-[#161720]/70 border border-white/[0.04] p-3.5" data-testid={`rubric-${d.category}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-200">{name}</span>
        <span className={`text-xs font-mono font-semibold ${BAND_TEXT[band]}`}>{word}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5" role="img" aria-label={`${name}: ${word}`}>
        {[0, 1, 2].map((i) =>
          band === "insufficient" ? (
            // A dash, not an empty bar: unassessed is not zero.
            <span key={i} className="h-2 rounded-full border border-dashed border-zinc-700 bg-zinc-900/50" />
          ) : (
            <span key={i} className={`h-2 rounded-full transition-all duration-300 ${i < SEGMENTS[band] ? FILL[band] : "bg-zinc-800/80 border border-white/[0.04]"}`} />
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
    <div role="list" aria-label={`${TRACK_LABEL[score.round]} dimensions`} className="grid gap-3 sm:grid-cols-2">
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
  const cell = "rounded-[16px] bg-[#161720]/80 border border-white/[0.06] px-4 py-3.5 transition-colors hover:border-white/10";
  return (
    <div className="grid grid-cols-2 gap-3 text-sm" data-testid="run-facts">
      <div className={cell}>
        <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">Tests passed</div>
        <div className="mt-1 font-mono text-base font-bold text-zinc-100">
          <span className={facts.passed === facts.total && facts.total ? "text-emerald-400" : ""}>
            {facts.passed !== null ? `${facts.passed}/${facts.total}` : "Not run"}
          </span>
          {hasRun && <span className="ml-1.5 text-xs font-normal text-zinc-400">v{facts.testedVersion}</span>}
        </div>
      </div>
      <div className={cell}>
        <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">Observed runtime</div>
        <div className="mt-1 font-mono text-base font-bold text-zinc-100">
          {facts.observedMs !== null ? (
            <span className="text-zinc-100">{facts.observedMs} ms</span>
          ) : (
            <span className="text-zinc-500">—</span>
          )}
          <span className="ml-1.5 text-xs font-normal text-zinc-400">measured</span>
        </div>
      </div>
      <div className={cell}>
        <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">Complexity (rubric)</div>
        <div className="mt-1 text-sm font-semibold text-zinc-100">
          {complexity ? (
            <span className={complexity.rating === "strong" ? "text-rose-400" : complexity.rating === "ok" ? "text-amber-400" : "text-zinc-300"}>
              {RATING_WORD[complexity.rating]}
            </span>
          ) : (
            <span className="text-zinc-500">Not assessed</span>
          )}
        </div>
      </div>
      <div className={cell}>
        <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">Final draft state</div>
        <div className="mt-1 text-sm font-semibold text-zinc-100" data-testid="score-unrun-draft">
          {facts.unrunDraftVersion !== null ? (
            <span className="text-amber-400">v{facts.unrunDraftVersion} (unrun)</span>
          ) : (
            <span className="text-emerald-400">Synced to run</span>
          )}
        </div>
      </div>
      <p className="col-span-2 text-xs leading-relaxed text-zinc-400">
        Observed runtime is local fixture execution. Algorithmic scalability is evaluated by the complexity rubric.
      </p>
    </div>
  );
}

const HEADLINE: Record<Band, string> = {
  strong: "Strong performance across evaluation criteria",
  solid: "Solid foundation with targeted areas to sharpen",
  developing: "Developing baseline with a clear refinement path",
  insufficient: "Insufficient signal captured for full scoring",
};
const SUBLINE: Record<Band, string> = {
  strong: "You demonstrated high technical rigor and vocal clarity across assessed dimensions.",
  solid: "A reliable interview showing. Review the concrete evidence below to raise your bar.",
  developing: "Clear actionable starting point. Follow the telemetry action plan below.",
  insufficient: "The interview session did not capture enough turns to evaluate full dimensions.",
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
    <section
      className={`relative overflow-hidden rounded-[28px] bg-[#121318]/90 border border-white/[0.08] p-6 sm:p-8 backdrop-blur-xl ${SHADOW}`}
      data-testid="scorecard"
    >
      {/* Ambient background glow */}
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-rose-600/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-rose-950/20 blur-3xl" />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-mono font-bold uppercase tracking-[0.14em] text-rose-400" data-testid="score-role">
            {roleLabel ?? "Executive Telemetry Debrief"}
          </p>
          <span className="rounded-full bg-zinc-800/80 border border-white/10 px-3 py-1 font-mono text-[11px] text-zinc-300">
            {overall.level !== null ? `${scored} scored track${scored === 1 ? "" : "s"}` : "Unscored"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <BandBadge band={overall.band} size="lg" testId="score-overall-band" />
          <span className="text-xs sm:text-sm text-zinc-400">
            Hiring Bar Signal: <span className="font-semibold text-zinc-200">{BAND_LABEL[overall.band]}</span>
          </span>
        </div>

        <h1 className="mt-3 font-brand text-[28px] font-bold leading-tight tracking-tight text-white sm:text-[36px]">
          {HEADLINE[overall.band]}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-zinc-400">{SUBLINE[overall.band]}</p>

        {overall.caveat && (
          <p
            className="mt-4 rounded-[16px] bg-zinc-900/90 border border-white/[0.06] px-4 py-3 text-sm leading-relaxed text-zinc-300"
            data-testid="score-overall-caveat"
          >
            {overall.caveat}
          </p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {rounds.map(({ round, score, state }) => (
            <a
              key={round}
              href={`#track-${round}`}
              className="group flex flex-col gap-2 rounded-[20px] bg-[#181920]/80 border border-white/[0.06] p-4 transition-all hover:bg-[#1E1F28] hover:border-white/15"
              data-testid={`score-round-${round}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-[0.08em] text-zinc-400">
                  {TRACK_LABEL[round]}
                </span>
                <span className="text-xs font-semibold text-rose-400 group-hover:translate-x-0.5 transition-transform">
                  View track →
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {score ? (
                  <BandBadge band={score.band} testId={`score-band-${round}`} />
                ) : (
                  <span className="text-sm font-semibold text-zinc-400">
                    {state === "loading" ? "Evaluation in progress…" : state === "error" ? "Evaluation unavailable" : "Not completed"}
                  </span>
                )}
                {score && (
                  <span className="text-xs text-zinc-400">
                    {score.ratedCount} of {score.totalCount} dimensions assessed
                  </span>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
