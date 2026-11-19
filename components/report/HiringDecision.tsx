"use client";

import type { HiringAssessment, HiringRecommendation } from "@/lib/contract";
import { RECOMMENDATION_LABEL, RECOMMENDATION_MEANING } from "@/lib/hiring";

const TONE: Record<HiringRecommendation, string> = {
  strong_hire: "border-emerald-300 bg-emerald-50 text-emerald-800",
  lean_hire: "border-sky-300 bg-sky-50 text-sky-800",
  lean_no_hire: "border-amber-300 bg-amber-50 text-amber-800",
  strong_no_hire: "border-red-300 bg-red-50 text-red-800",
};

export function RecommendationPill({ value, size = "md", testId }: { value: HiringRecommendation; size?: "md" | "lg"; testId?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${size === "lg" ? "px-4 py-1.5 text-base" : "px-3 py-1 text-sm"} ${TONE[value]}`}
      data-testid={testId}
      data-recommendation={value}
    >
      {RECOMMENDATION_LABEL[value]}
    </span>
  );
}

function List({ title, items, testId }: { title: string; items: string[]; testId: string }) {
  if (items.length === 0) return null;
  return (
    <div className="min-w-0">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h4>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm leading-relaxed text-foreground" data-testid={testId}>
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-muted-foreground" aria-hidden="true">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The interviewer's vote, as a competitive loop would record it.
export function HiringDecision({ assessment }: { assessment: HiringAssessment }) {
  const a = assessment;
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5 shadow-sm" data-testid="hiring-decision">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">Hiring decision</span>
        <RecommendationPill value={a.recommendation} testId="hiring-recommendation" />
      </div>
      <p className="text-xs text-muted-foreground">{RECOMMENDATION_MEANING[a.recommendation]}</p>
      <p className="text-[15px] leading-relaxed text-foreground" data-testid="hiring-summary">{a.summary}</p>

      {a.caps.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3" data-testid="hiring-caps">
          <p className="text-xs font-semibold text-foreground">
            {a.proposed
              ? `The evaluator proposed ${RECOMMENDATION_LABEL[a.proposed]}, but the bar does not allow it:`
              : "What holds this back:"}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
            {a.caps.map((c, i) => (
              <li key={i}>• {c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <List title="Strengths" items={a.strengths} testId="hiring-strengths" />
        <List title="Concerns" items={a.concerns} testId="hiring-concerns" />
      </div>

      {a.toRaise && (
        <p className="text-sm leading-relaxed text-foreground" data-testid="hiring-to-raise">
          <span className="font-semibold">To move up a level: </span>
          {a.toRaise}
        </p>
      )}
    </section>
  );
}
