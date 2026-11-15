"use client";

import { useState } from "react";
import type { AttemptRecord } from "./ReportView";
import type { CodingSession, EvidenceRef, Finding, RoundType } from "@/lib/contract";
import { Wordmark } from "./Logo";
import { btn } from "./ui/buttons";
import { isBehavioralSession } from "@/lib/behavioral";

interface Props {
  codingRecord?: AttemptRecord;
  behavioralRecord?: AttemptRecord;
  onRetryReport: (attemptId: string) => void;
  onPracticeAgain: (round: RoundType) => void;
  onReturnHome: () => void;
}

const RATING_STYLE: Record<Finding["rating"], string> = {
  strong: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  ok: "bg-zinc-200/10 text-zinc-100 border-zinc-700",
  needs_work: "bg-red-500/15 text-red-400 border-red-500/30",
  insufficient_evidence: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const RATING_ICON: Record<Finding["rating"], string> = {
  strong: "✓",
  ok: "●",
  needs_work: "!",
  insufficient_evidence: "?",
};

function formatEvidenceLabel(ref: EvidenceRef) {
  if (ref.kind === "turn") return `Turn ${ref.turnId}`;
  if (ref.kind === "code") return `Code v${ref.codeVersion}${ref.lines ? ` · lines ${ref.lines[0]}–${ref.lines[1]}` : ""}`;
  return `Run v${ref.codeVersion}${ref.caseId ? ` · ${ref.caseId}` : ""}`;
}

export function FullMockSummary({
  codingRecord,
  behavioralRecord,
  onRetryReport,
  onPracticeAgain,
  onReturnHome,
}: Props) {
  const [expandedRound, setExpandedRound] = useState<RoundType | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<{ round: RoundType; ref: EvidenceRef } | null>(null);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100" data-testid="full-mock-summary">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-4">
          <Wordmark size={26} />
          <span className="text-base font-semibold text-zinc-200">Full Mock Interview Summary</span>
          <span className="rounded bg-brand-coral/15 px-2 py-0.5 text-xs font-bold text-brand-coral uppercase tracking-wider">
            2 Rounds Complete
          </span>
        </div>
        <button
          onClick={onReturnHome}
          className={`${btn.neutral} px-4 py-2 text-sm`}
          data-testid="return-home-btn"
        >
          Return to home
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Interview Performance Overview</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Review your findings and evidence-backed practice takeaways from both rounds below.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Card 1: Coding Round */}
          <RoundSummaryCard
            round="coding"
            record={codingRecord}
            onRetryReport={onRetryReport}
            onPracticeAgain={() => onPracticeAgain("coding")}
            onToggleExpand={() => setExpandedRound(expandedRound === "coding" ? null : "coding")}
            isExpanded={expandedRound === "coding"}
            onSelectEvidence={(ref) => setSelectedEvidence({ round: "coding", ref })}
            selectedEvidence={selectedEvidence?.round === "coding" ? selectedEvidence.ref : null}
          />

          {/* Card 2: Behavioral Round */}
          <RoundSummaryCard
            round="behavioral"
            record={behavioralRecord}
            onRetryReport={onRetryReport}
            onPracticeAgain={() => onPracticeAgain("behavioral")}
            onToggleExpand={() => setExpandedRound(expandedRound === "behavioral" ? null : "behavioral")}
            isExpanded={expandedRound === "behavioral"}
            onSelectEvidence={(ref) => setSelectedEvidence({ round: "behavioral", ref })}
            selectedEvidence={selectedEvidence?.round === "behavioral" ? selectedEvidence.ref : null}
          />
        </div>
      </main>
    </div>
  );
}

function RoundSummaryCard({
  round,
  record,
  onRetryReport,
  onPracticeAgain,
  onToggleExpand,
  isExpanded,
  onSelectEvidence,
  selectedEvidence,
}: {
  round: RoundType;
  record?: AttemptRecord;
  onRetryReport: (attemptId: string) => void;
  onPracticeAgain: () => void;
  onToggleExpand: () => void;
  isExpanded: boolean;
  onSelectEvidence: (ref: EvidenceRef) => void;
  selectedEvidence: EvidenceRef | null;
}) {
  const isCoding = round === "coding";
  const title = isCoding ? "Round 1: Coding Practice" : "Round 2: Behavioral Practice";
  const testId = isCoding ? "summary-coding-card" : "summary-behavioral-card";

  if (!record) {
    return (
      <div className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6" data-testid={testId}>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</span>
          <p className="mt-3 text-sm text-zinc-400">Round not started yet.</p>
        </div>
        <button onClick={onPracticeAgain} className={`${btn.secondary} mt-6 w-full justify-center text-sm`}>
          Start {round} round
        </button>
      </div>
    );
  }

  const { session, status, report, error } = record;
  const isBehavioral = isBehavioralSession(session);
  const codingSession = !isBehavioral ? (session as CodingSession) : null;
  const lastRun = codingSession?.runs.at(-1);

  // Derive top takeaway from nextSteps or first actionable finding
  const takeaway =
    report?.nextSteps?.[0] ||
    report?.findings.find((f) => f.rating === "needs_work" || f.rating === "ok")?.summary ||
    (report?.findings[0]?.summary ?? null);

  const primaryFinding = report?.findings.find((f) => f.evidence?.length > 0) || report?.findings[0];
  const primaryEvidence = primaryFinding?.evidence?.[0];

  const hasInsufficientEvidence =
    report?.findings.some((f) => f.rating === "insufficient_evidence") ||
    session.turns.length === 0;

  return (
    <article className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6" data-testid={testId}>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="rounded bg-zinc-800 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-zinc-300">
            {title}
          </span>
          {isCoding && lastRun?.status === "completed" && (
            <span
              className={`rounded px-2 py-0.5 text-xs font-bold ${
                lastRun.passed === lastRun.total
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-brand-coral/15 text-brand-coral"
              }`}
            >
              {lastRun.passed}/{lastRun.total} passed
            </span>
          )}
        </div>

        {/* Status / Content */}
        {status === "loading" && (
          <div className="mt-6 flex flex-col items-center justify-center gap-3 py-8 text-center text-zinc-400">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-500 border-t-white" />
            <p className="text-sm">Synthesizing {round} report feedback…</p>
          </div>
        )}

        {status === "error" && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            <p className="font-semibold">Report unavailable</p>
            <p className="mt-1 text-xs text-red-300/80">{error?.message ?? "Provider timed out."}</p>
            <button
              onClick={() => onRetryReport(session.attemptId)}
              className={`${btn.primary} mt-3 text-xs px-3 py-1.5`}
              data-testid={`retry-report-${round}`}
            >
              Retry report
            </button>
          </div>
        )}

        {status === "done" && report && (
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-zinc-300">{report.summary}</p>

            {/* Evidence-backed practice takeaway */}
            {takeaway && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4" data-testid={`takeaway-${round}`}>
                <div className="text-xs font-semibold uppercase tracking-wider text-brand-coral mb-1">
                  Key Practice Takeaway
                </div>
                <p className="text-sm text-zinc-200">{takeaway}</p>

                {primaryEvidence && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Supporting evidence:</span>
                    <button
                      type="button"
                      onClick={() => onSelectEvidence(primaryEvidence)}
                      className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-brand-coral hover:bg-zinc-700 transition-colors"
                      data-testid={`evidence-chip-${round}`}
                    >
                      {formatEvidenceLabel(primaryEvidence)}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Insufficient evidence advisory */}
            {hasInsufficientEvidence && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-200">
                <span className="font-semibold">Need more evidence:</span>{" "}
                {isCoding
                  ? "Run your solution and explain your logic out loud so the interviewer can evaluate your approach."
                  : "Describe the situation, what you personally built or decided, and how you measured success."}
              </div>
            )}

            {/* Quote / Code Viewer Popover */}
            {selectedEvidence && (
              <div className="rounded-xl border border-brand-coral/40 bg-zinc-950 p-3.5 text-xs animate-in fade-in">
                <div className="font-semibold text-brand-coral mb-1 flex items-center justify-between">
                  <span>Evidence Detail ({formatEvidenceLabel(selectedEvidence)})</span>
                  <button onClick={() => onSelectEvidence(selectedEvidence)} className="text-zinc-500 hover:text-zinc-300">
                    ✕
                  </button>
                </div>
                {selectedEvidence.kind === "turn" && (
                  <div className="mt-1">
                    {session.turns.find((t) => t.id === selectedEvidence.turnId) ? (
                      <blockquote className="border-l-2 border-brand-coral pl-2.5 text-zinc-200 italic">
                        &ldquo;{session.turns.find((t) => t.id === selectedEvidence.turnId)?.text}&rdquo;
                      </blockquote>
                    ) : (
                      <span className="text-zinc-500">Turn quote recorded in transcript.</span>
                    )}
                  </div>
                )}
                {selectedEvidence.kind === "code" && codingSession && (
                  <div className="mt-1">
                    <pre className="max-h-32 overflow-x-auto rounded bg-zinc-900 p-2 font-mono text-[11px] text-zinc-300">
                      {codingSession.snapshots.find((s) => s.codeVersion === selectedEvidence.codeVersion)?.source ||
                        "Code version saved in attempt."}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Expanded Detailed Findings */}
            {isExpanded && (
              <div className="mt-2 flex flex-col gap-3 border-t border-zinc-800 pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Detailed Findings</h4>
                {report.findings.map((f, i) => (
                  <div key={i} className="rounded-lg border border-zinc-800/80 bg-zinc-950 p-3 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded border px-1.5 py-0.2 text-[10px] font-bold ${RATING_STYLE[f.rating]}`}>
                        {RATING_ICON[f.rating]} {f.category}
                      </span>
                    </div>
                    <p className="text-zinc-300">{f.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Action Buttons */}
      <div className="mt-6 flex flex-col gap-2 pt-4 border-t border-zinc-800/80">
        <div className="flex gap-2">
          {status === "done" && (
            <button
              type="button"
              onClick={onToggleExpand}
              className={`${btn.neutral} flex-1 justify-center py-2 text-xs font-medium`}
              data-testid={`toggle-details-${round}`}
            >
              {isExpanded ? "Collapse details" : "View full report"}
            </button>
          )}
          <button
            type="button"
            onClick={onPracticeAgain}
            className={`${btn.secondary} flex-1 justify-center py-2 text-xs font-semibold`}
            data-testid={`practice-again-${round}`}
          >
            Practice {round} again
          </button>
        </div>
      </div>
    </article>
  );
}
