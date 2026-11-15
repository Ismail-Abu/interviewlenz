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

// High-tech ratings: rose / amber / slate / muted.
const RATING_STYLE: Record<Finding["rating"], string> = {
  strong: "bg-rose-950/80 text-rose-300 border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.25)]",
  ok: "bg-amber-950/80 text-amber-300 border border-amber-500/40",
  needs_work: "bg-zinc-800 text-zinc-300 border border-zinc-700",
  insufficient_evidence: "bg-zinc-900 text-zinc-400 border border-zinc-800",
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
    <li className="rounded-[22px] bg-[#161720]/80 border border-white/[0.06] p-5 sm:p-6 shadow-lg transition-colors hover:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400">
          {categoryLabel(finding.category)}
        </span>
        <span className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider ${RATING_STYLE[finding.rating]}`}>
          {RATING_WORD[finding.rating]}
        </span>
      </div>

      <p className="mt-3 text-[15px] sm:text-[16px] leading-relaxed text-zinc-200">{finding.summary}</p>

      {quoted && (
        <figure className="mt-3.5 rounded-r-[14px] border-l-[3px] border-rose-500/80 bg-[#0E0F14]/90 px-4 py-3">
          <blockquote className="text-[14px] sm:text-[15px] italic leading-relaxed text-zinc-300">
            &ldquo;{quoted.text.length > 220 ? `${quoted.text.slice(0, 220).trimEnd()}…` : quoted.text}&rdquo;
          </blockquote>
          <figcaption className="mt-1.5 font-mono text-xs text-zinc-400">
            <span className={quoted.who === "You" ? "text-cyan-400 font-semibold" : "text-rose-400 font-semibold"}>
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
                    ? "bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                    : "bg-zinc-800/90 text-zinc-300 border border-white/10 hover:border-white/20 hover:bg-zinc-700 hover:text-white"
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
