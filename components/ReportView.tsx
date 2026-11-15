"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiError, EvidenceRef, Report, Session } from "@/lib/contract";
import { Wordmark } from "./Logo";
import { isBehavioralSession } from "@/lib/behavioral";
import { VerdictBanner } from "./report/VerdictBanner";
import { FindingCard } from "./report/FindingCard";
import { EvidenceReceipt } from "./report/EvidenceReceipt";
import { TranscriptSection } from "./report/TranscriptSection";
import { UnrunDraftDisclosure } from "./report/UnrunDraftDisclosure";
import { BandBadge, DimensionMeters } from "./report/Scorecard";
import { DownloadDebrief } from "./report/DownloadDebrief";
import { buildDebrief, TRACK_LABEL } from "./report/debrief";
import { scoreOverall, scoreRound } from "@/lib/score";
import { coverBtnSm } from "./ui/buttons";

export interface AttemptRecord {
  session: Session;
  status: "loading" | "done" | "error";
  report?: Report;
  fromFixture?: boolean;
  fallbackReason?: string;
  error?: ApiError;
}

interface Props {
  records: AttemptRecord[];
  onRetryReport: (attemptId: string) => void;
  onRetryAttempt: () => void;
}

export function ReportView({ records, onRetryReport, onRetryAttempt }: Props) {
  const busy = records.some((r) => r.status === "loading");
  const latestIsBehavioral = isBehavioralSession(records.at(-1)?.session);
  // The latest scored attempt per track, for the downloadable debrief.
  const latest = (b: boolean) => [...records].reverse().find((r) => isBehavioralSession(r.session) === b);
  const debrief = () => {
    const tracks = ([["coding", latest(false)], ["behavioral", latest(true)]] as const)
      .filter(([, r]) => r)
      .map(([round, r]) => ({ round, session: r!.session, report: r!.report ?? null }));
    const scored = tracks.filter((t) => t.report).map((t) => scoreRound(t.round, t.report!.findings));
    return buildDebrief({ tracks, overall: scoreOverall(scored).band });
  };

  return (
    <div data-surface="cream" className="min-h-screen bg-cream text-ink antialiased [color-scheme:light] selection:bg-maroon-soft/30 selection:text-ink">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-cream-line bg-cream/95 px-4 py-3 backdrop-blur shadow-[0_4px_12px_-4px_rgb(90_68_50/0.05)] sm:px-6">
        <Wordmark size={26} tone="light" />
        <span className="hidden text-base font-medium text-ink-muted sm:inline">Interview report</span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
        {records.some((r) => r.report) && <DownloadDebrief build={debrief} className={coverBtnSm.secondary} />}
        <button
          type="button"
          onClick={onRetryAttempt}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-maroon px-5 py-2.5 text-[15px] font-semibold text-white shadow-[0_10px_18px_-6px_rgb(90_68_50/0.25)] transition-colors hover:bg-maroon-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {latestIsBehavioral ? "Practice again" : "Retry problem"}
        </button>
        </span>
      </header>

      <main className={`grid gap-8 px-4 py-6 sm:p-8 ${records.length > 1 ? "xl:grid-cols-2" : "mx-auto max-w-4xl"}`}>
        {records.map((r, i) => (
          <ReportCard key={r.session.attemptId} record={r} index={i} onRetryReport={onRetryReport} />
        ))}
      </main>
    </div>
  );
}

function ReportCard({
  record,
  index,
  onRetryReport,
}: {
  record: AttemptRecord;
  index: number;
  onRetryReport: (attemptId: string) => void;
}) {
  const { session, report } = record;
  const isBehavioral = isBehavioralSession(session);
  const lastSnapshot = isBehavioral ? undefined : session.snapshots.at(-1);
  const lastRun = isBehavioral ? undefined : session.runs.at(-1);
  const unrunDraft = lastSnapshot && lastSnapshot.codeVersion !== lastRun?.codeVersion ? lastSnapshot : undefined;
  const score = report ? scoreRound(isBehavioral ? "behavioral" : "coding", report.findings) : null;

  const [selected, setSelected] = useState<EvidenceRef | null>(null);
  const turnRefs = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    if (selected?.kind === "turn") {
      turnRefs.current.get(selected.turnId)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [selected]);

  return (
    <article
      data-attempt={session.attemptId}
      className="flex min-w-0 flex-col gap-6 rounded-[28px] bg-cream-2/80 p-5 sm:p-8 shadow-[0_10px_18px_-6px_rgb(90_68_50/0.13)] border border-cream-line/60"
    >
      {/* Top Header & Context Badges */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
              isBehavioral
                ? "bg-maroon/10 text-maroon"
                : "bg-cream-3 text-ink-muted border border-cream-line"
            }`}
          >
            {TRACK_LABEL[isBehavioral ? "behavioral" : "coding"]}
          </span>

          <h2 className="text-2xl font-bold font-brand tracking-tight text-ink">
            Attempt {index + 1}
          </h2>

          <span className="font-mono text-xs text-ink-muted">
            {session.attemptId.slice(0, 8)}
          </span>

          {session.priorAttemptId && (
            <span className="text-xs text-ink-muted">
              retry of {session.priorAttemptId.slice(0, 8)}
            </span>
          )}

          {record.fromFixture && (
            <span
              className="rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-3 py-0.5 text-xs font-bold tracking-wider"
              data-testid="report-fixture-badge"
            >
              FIXTURE DATA{record.fallbackReason ? ` (${record.fallbackReason})` : ""}
            </span>
          )}

          <span className="font-mono text-xs text-ink-muted sm:ml-auto" data-testid="attempt-stats">
            {isBehavioral
              ? `Behavioral · ${session.turns.length} turns · ${
                  session.turns.filter((t) => t.speaker === "student").length
                } answers`
              : `${session.snapshots.length} snapshots · ${session.runs.length} runs · ${session.turns.length} turns`}
          </span>
        </div>
      </header>

      {/* Unrun Draft Disclosure for Coding Rounds */}
      {unrunDraft && <UnrunDraftDisclosure unrunDraft={unrunDraft} lastRun={lastRun} />}

      {/* Loading Skeleton */}
      {record.status === "loading" && <SoftReportSkeleton />}

      {/* Error State */}
      {record.status === "error" && record.error && (
        <div
          className="rounded-[22px] border border-red-200 bg-[#FDF2F2] p-5 sm:p-6 text-sm text-red-900 shadow-[0_10px_18px_-6px_rgb(90_68_50/0.08)]"
          role="alert"
          data-testid="report-error"
        >
          <div className="font-bold text-red-950 text-base">
            {record.error.code === "timeout" ? "Report timed out" : "Report unavailable"}
          </div>
          <div className="mt-1 text-red-800">{record.error.message}</div>
          {record.error.retryable ? (
            <>
              <div className="mt-2 text-ink-muted">
                Your session is saved. Retry uses this same attempt.
              </div>
              <button
                type="button"
                onClick={() => onRetryReport(session.attemptId)}
                className="mt-4 inline-flex items-center justify-center rounded-[16px] bg-cream-3 px-5 py-2.5 font-semibold text-sm text-maroon-deep shadow-sm hover:bg-[#EFE0CA] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-soft"
              >
                Retry report
              </button>
            </>
          ) : (
            <div className="mt-2 text-ink-muted">
              This attempt couldn&apos;t be evaluated, and retrying won&apos;t change that. You can still start a new attempt.
            </div>
          )}
        </div>
      )}

      {/* Report Findings & Verdict */}
      {report && (
        <>
          {score && score.dimensions.length > 0 && (
            <section className="flex flex-col gap-4 rounded-[22px] bg-white/70 p-5" data-testid="attempt-scorecard">
              <div className="flex flex-wrap items-center gap-3">
                <BandBadge band={score.band} />
                <span className="text-xs text-ink-muted">
                  {score.ratedCount} of {score.totalCount} dimensions assessed
                </span>
              </div>
              {score.caveat && <p className="text-sm text-ink">{score.caveat}</p>}
              <DimensionMeters score={score} />
            </section>
          )}

          <VerdictBanner nextStep={report.nextStep} />

          <ul className="flex flex-col gap-4">
            {report.findings.map((f) => (
              <FindingCard
                key={f.id}
                finding={f}
                session={session}
                selected={selected}
                onSelectRef={setSelected}
              />
            ))}
          </ul>

          {selected && (
            <EvidenceReceipt
              refValue={selected}
              session={session}
              onClose={() => setSelected(null)}
            />
          )}
        </>
      )}

      {/* Transcript Section */}
      <TranscriptSection session={session} selected={selected} turnRefs={turnRefs} />
    </article>
  );
}

function SoftReportSkeleton() {
  const bar = "animate-pulse rounded bg-[#EADECE]";
  return (
    <div className="flex flex-col gap-4" aria-label="Writing your report" role="status">
      <div className="h-24 animate-pulse rounded-[22px] bg-[#EADECE]/60" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-[26px] bg-[#F2E8DA]/60 p-6">
          <div className="mb-3 flex gap-2">
            <div className={`h-5 w-32 ${bar}`} />
            <div className={`h-5 w-20 ${bar}`} />
          </div>
          <div className={`mb-2 h-4 w-full ${bar}`} />
          <div className={`mb-4 h-4 w-3/4 ${bar}`} />
          <div className={`h-7 w-36 ${bar}`} />
        </div>
      ))}
    </div>
  );
}
