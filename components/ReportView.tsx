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
    <div className="min-h-screen bg-[#0B0C0E] text-zinc-100 antialiased selection:bg-rose-500/30 selection:text-white">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.08] bg-[#0B0C0E]/90 px-4 py-3 backdrop-blur-xl shadow-lg sm:px-6">
        <Wordmark size={26} tone="dark" />
        <span className="hidden text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 sm:inline">
          Telemetry Evaluation Report
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {records.some((r) => r.report) && (
            <DownloadDebrief
              build={debrief}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-800/80 border border-white/10 px-4 py-2 font-mono text-xs font-semibold text-zinc-200 hover:bg-zinc-700/80 hover:border-white/20 transition-all"
            />
          )}
          <button
            type="button"
            onClick={onRetryAttempt}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#C8102E] to-[#E11D48] px-5 py-2 font-mono text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(200,16,46,0.35)] hover:shadow-[0_0_28px_rgba(200,16,46,0.5)] transition-all disabled:cursor-not-allowed disabled:opacity-50"
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
      className="flex min-w-0 flex-col gap-6 rounded-[28px] bg-[#121318]/90 border border-white/[0.08] p-5 sm:p-8 shadow-2xl backdrop-blur-xl"
    >
      {/* Top Header & Context Badges */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider ${
              isBehavioral
                ? "bg-rose-950/80 text-rose-300 border border-rose-500/40 shadow-[0_0_10px_rgba(225,29,72,0.2)]"
                : "bg-zinc-800 text-zinc-300 border border-white/10"
            }`}
          >
            {TRACK_LABEL[isBehavioral ? "behavioral" : "coding"]}
          </span>

          <h2 className="text-2xl font-bold font-brand tracking-tight text-white">
            Attempt {index + 1}
          </h2>

          <span className="font-mono text-xs text-zinc-400">
            {session.attemptId.slice(0, 8)}
          </span>

          {session.priorAttemptId && (
            <span className="text-xs text-zinc-400">
              retry of {session.priorAttemptId.slice(0, 8)}
            </span>
          )}

          {record.fromFixture && (
            <span
              className="rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40 px-3 py-0.5 text-xs font-mono font-bold tracking-wider"
              data-testid="report-fixture-badge"
            >
              FIXTURE DATA{record.fallbackReason ? ` (${record.fallbackReason})` : ""}
            </span>
          )}

          <span className="font-mono text-xs text-zinc-400 sm:ml-auto" data-testid="attempt-stats">
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
          className="rounded-[22px] border border-rose-800/60 bg-rose-950/40 p-5 sm:p-6 text-sm text-rose-200 shadow-xl"
          role="alert"
          data-testid="report-error"
        >
          <div className="font-bold text-rose-100 text-base">
            {record.error.code === "timeout" ? "Report timed out" : "Report unavailable"}
          </div>
          <div className="mt-1 text-rose-300">{record.error.message}</div>
          {record.error.retryable ? (
            <>
              <div className="mt-2 text-zinc-400">
                Your session is saved. Retry uses this same attempt.
              </div>
              <button
                type="button"
                onClick={() => onRetryReport(session.attemptId)}
                className="mt-4 inline-flex items-center justify-center rounded-[14px] bg-zinc-800 border border-white/10 px-5 py-2 font-mono text-xs font-semibold text-rose-300 hover:bg-zinc-700 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Retry report
              </button>
            </>
          ) : (
            <div className="mt-2 text-zinc-400">
              This attempt couldn&apos;t be evaluated, and retrying won&apos;t change that. You can still start a new attempt.
            </div>
          )}
        </div>
      )}

      {/* Report Findings & Verdict */}
      {report && (
        <>
          {score && score.dimensions.length > 0 && (
            <section className="flex flex-col gap-4 rounded-[22px] bg-[#161720]/80 border border-white/[0.06] p-5 shadow-xl" data-testid="attempt-scorecard">
              <div className="flex flex-wrap items-center gap-3">
                <BandBadge band={score.band} />
                <span className="text-xs font-mono text-zinc-400">
                  {score.ratedCount} of {score.totalCount} dimensions assessed
                </span>
              </div>
              {score.caveat && <p className="text-sm text-zinc-300">{score.caveat}</p>}
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
  const bar = "animate-pulse rounded bg-zinc-800";
  return (
    <div className="flex flex-col gap-4" aria-label="Writing your report" role="status">
      <div className="h-24 animate-pulse rounded-[22px] bg-zinc-800/60" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-[26px] bg-zinc-900/60 border border-white/[0.04] p-6">
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
