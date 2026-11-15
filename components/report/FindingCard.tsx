"use client";

import type { EvidenceRef, Finding } from "@/lib/contract";

interface Props {
  finding: Finding;
  selected: EvidenceRef | null;
  onSelectRef: (ref: EvidenceRef) => void;
}

const RATING_STYLE: Record<Finding["rating"], string> = {
  strong: "bg-[#D8EFE0] text-[#1B5E20]",
  ok: "bg-[#FDF0D5] text-[#8A5D00]",
  needs_work: "bg-[#FBE8EC] text-maroon",
  insufficient_evidence: "bg-[#EDE6E0] text-ink-muted",
};

const RATING_ICON: Record<Finding["rating"], string> = {
  strong: "✓",
  ok: "●",
  needs_work: "!",
  insufficient_evidence: "?",
};

export function label(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export function evidenceLabel(ref: EvidenceRef) {
  if (ref.kind === "turn") return `Transcript ${ref.turnId}`;
  if (ref.kind === "code") {
    return `Code v${ref.codeVersion}${ref.lines ? ` · lines ${ref.lines[0]}–${ref.lines[1]}` : ""}`;
  }
  return `Run v${ref.codeVersion}${ref.caseId ? ` · ${ref.caseId}` : ""}`;
}

export function sameRef(a: EvidenceRef | null, b: EvidenceRef) {
  return !!a && JSON.stringify(a) === JSON.stringify(b);
}

export function FindingCard({ finding, selected, onSelectRef }: Props) {
  return (
    <li className="rounded-[26px] bg-cream-2 p-5 sm:p-6 shadow-[0_10px_18px_-6px_rgb(90_68_50/0.13)] transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-maroon">
          {label(finding.category)}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${RATING_STYLE[finding.rating]}`}
        >
          <span aria-hidden>{RATING_ICON[finding.rating]}</span>
          {label(finding.rating)}
        </span>
      </div>

      <p className="mt-3 text-[16px] leading-relaxed text-ink">{finding.summary}</p>

      {finding.evidence.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 pt-1">
          {finding.evidence.map((ref, i) => {
            const isSelected = sameRef(selected, ref);
            return (
              <button
                key={i}
                type="button"
                data-evidence-kind={ref.kind}
                onClick={() => onSelectRef(ref)}
                className={`rounded-full px-4 py-1.5 font-mono text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-maroon-soft focus-visible:outline-none ${
                  isSelected
                    ? "bg-maroon text-white shadow-sm ring-2 ring-maroon-soft"
                    : "bg-cream-3 text-ink hover:bg-[#EDE2D0] ring-1 ring-cream-line/50"
                }`}
              >
                {evidenceLabel(ref)}
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}
