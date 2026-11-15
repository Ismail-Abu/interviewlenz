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

// Same palette as the meters: burgundy / ochre / sand / neutral.
const RATING_STYLE: Record<Finding["rating"], string> = {
  strong: "bg-maroon text-white",
  ok: "bg-[#F1DFBC] text-[#6E4A0E]",
  needs_work: "bg-[#EEE2CC] text-[#5E4B36]",
  insufficient_evidence: "bg-cream-3 text-[#5F5249]",
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
    <li className="rounded-[26px] bg-white/75 p-5 shadow-[0_10px_18px_-6px_rgb(90_68_50/0.13)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-maroon-deep">{categoryLabel(finding.category)}</span>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${RATING_STYLE[finding.rating]}`}>
          {RATING_WORD[finding.rating]}
        </span>
      </div>

      <p className="mt-3 text-[16px] leading-relaxed text-ink">{finding.summary}</p>

      {quoted && (
        <figure className="mt-3 rounded-r-[16px] border-l-[3px] border-maroon-soft bg-cream-2/80 px-4 py-3">
          <blockquote className="text-[15px] italic leading-relaxed text-ink">
            &ldquo;{quoted.text.length > 220 ? `${quoted.text.slice(0, 220).trimEnd()}…` : quoted.text}&rdquo;
          </blockquote>
          <figcaption className="mt-1 font-mono text-xs text-ink-muted">
            {quoted.who} · {quoted.id}
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
                className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3.5 py-1.5 font-mono text-xs font-medium transition-colors ${
                  isSelected ? "bg-maroon text-white" : "bg-cream-3 text-ink hover:bg-[#EDE2D0]"
                } ${v.missing ? "line-through decoration-ink-muted" : ""}`}
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
