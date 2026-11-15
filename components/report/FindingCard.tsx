"use client";

import type { EvidenceRef, Finding, Session } from "@/lib/contract";
import { categoryLabel, describeEvidence, RATING_WORD } from "./debrief";

interface Props {
  finding: Finding;
  selected: EvidenceRef | null;
  onSelectRef: (ref: EvidenceRef) => void;
  // The attempt the finding came from: resolves chips to real versions, runs,
  // and quotes. Optional so a finding can render on its own.
  session?: Session;
}

// High-tech ratings: emerald / amber / rose / muted.
const RATING_STYLE: Record<Finding["rating"], string> = {
  strong: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  ok: "bg-amber-50 text-amber-700 border border-amber-200",
  needs_work: "bg-rose-50 text-rose-700 border border-rose-200",
  insufficient_evidence: "bg-muted text-muted-foreground border border-border",
};

const KIND_ICON: Record<EvidenceRef["kind"], string> = { turn: "❝", code: "</>", run: "▶" };

export function label(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

// Short label used by the evidence receipt's title.
export function evidenceLabel(ref: EvidenceRef) {
  if (ref.kind === "turn") return `Transcript ${ref.turnId}`;
  if (ref.kind === "code") {
    return `solution.py v${ref.codeVersion}${ref.lines ? ` · lines ${ref.lines[0]}–${ref.lines[1]}` : ""}`;
  }
  return `Run v${ref.codeVersion}${ref.caseId ? ` · ${ref.caseId}` : ""}`;
}

export function sameRef(a: EvidenceRef | null, b: EvidenceRef) {
  return !!a && JSON.stringify(a) === JSON.stringify(b);
}

export function FindingCard({ finding, selected, onSelectRef, session }: Props) {
  const views = finding.evidence.map((ref) => ({ ref, v: describeEvidence(ref, session) }));
  // The first quoted turn is shown inline so the claim and the words sit together.
  const quoted = views.find((x) => x.v.quote)?.v.quote;
  return (
    <li className="rounded-xl bg-card border border-border p-5 sm:p-6 shadow-sm transition-colors hover:border-border/80">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
          {categoryLabel(finding.category)}
        </span>
        <span className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider ${RATING_STYLE[finding.rating]}`}>
          {RATING_WORD[finding.rating]}
        </span>
      </div>

      <p className="mt-3 text-[15px] sm:text-[16px] leading-relaxed text-foreground">{finding.summary}</p>

      {quoted && (
        <figure className="mt-3.5 rounded-r-lg border-l-2 border-primary bg-muted/50 px-4 py-3">
          <blockquote className="text-[14px] sm:text-[15px] italic leading-relaxed text-foreground">
            &ldquo;{quoted.text.length > 220 ? `${quoted.text.slice(0, 220).trimEnd()}…` : quoted.text}&rdquo;
          </blockquote>
          <figcaption className="mt-1.5 font-mono text-xs text-muted-foreground">
            <span className={quoted.who === "You" ? "text-primary font-semibold" : "text-foreground font-semibold"}>
              {quoted.who}
            </span>
            {" · "}
            {quoted.id}
            {quoted.clock ? ` · ${quoted.clock}` : ""}
          </figcaption>
        </figure>
      )}

      {views.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {views.map(({ ref, v }, i) => {
            const isSelected = sameRef(selected, ref);
            return (
              <button
                key={i}
                type="button"
                data-evidence-kind={ref.kind}
                onClick={() => onSelectRef(ref)}
                aria-pressed={isSelected}
                title={v.missing ? "Not found in this attempt" : "Open this evidence"}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3.5 py-1.5 font-mono text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-primary text-white shadow-sm"
                    : "bg-background text-foreground border border-border hover:bg-muted"
                } ${v.missing ? "line-through opacity-50" : ""}`}
              >
                <span aria-hidden className="shrink-0 opacity-70">
                  {KIND_ICON[ref.kind]}
                </span>
                <span className="truncate">{v.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}
