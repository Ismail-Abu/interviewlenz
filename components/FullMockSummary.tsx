"use client";

import { useState } from "react";
import type { AttemptRecord } from "./ReportView";
import { timingLabel } from "./roundClock";
import type { CodingSession, EvidenceRef, RoundType } from "@/lib/contract";
import { Wordmark } from "./Logo";
import { isBehavioralSession } from "@/lib/behavioral";
import { BAND_LABEL, nextAction, runFacts, scoreOverall, scoreRound, type RoundScore } from "@/lib/score";
import { BandBadge, DebriefHero, DimensionMeters, RunFactsBlock, SHADOW } from "./report/Scorecard";
import { FindingCard } from "./report/FindingCard";
import { EvidenceReceipt } from "./report/EvidenceReceipt";
import { ReportExtras } from "./report/ReportExtras";
import { DownloadDebrief } from "./report/DownloadDebrief";
import { buildDebrief, categoryLabel, describeEvidence, TRACK_LABEL, TRACK_SHORT } from "./report/debrief";

interface Props {
  codingRecord?: AttemptRecord;
  behavioralRecord?: AttemptRecord;
  onRetryReport: (attemptId: string) => void;
  onPracticeAgain: (round: RoundType) => void;
  onReturnHome: () => void;
  roleLabel?: string;
}

function codingFacts(record?: AttemptRecord) {
  const s = record?.session;
  if (!s || isBehavioralSession(s)) return { lastRun: null, draftVersion: null };
  const coding = s as CodingSession;
  const lastRun = coding.runs.at(-1) ?? null;
  const lastSnapshot = coding.snapshots.at(-1);
  const draftVersion = lastSnapshot && lastSnapshot.codeVersion !== lastRun?.codeVersion ? lastSnapshot.codeVersion : null;
  return { lastRun, draftVersion };
}

const scoreOf = (round: RoundType, r?: AttemptRecord): RoundScore | null =>
  r?.status === "done" && r.report ? scoreRound(round, r.report.findings) : null;
const stateOf = (r?: AttemptRecord) => (!r ? "missing" : r.status === "done" && r.report ? "done" : r.status === "error" ? "error" : "loading") as
  | "done"
  | "loading"
  | "error"
  | "missing";

export function FullMockSummary({ codingRecord, behavioralRecord, onRetryReport, onPracticeAgain, onReturnHome, roleLabel }: Props) {
  const records = { coding: codingRecord, behavioral: behavioralRecord } as const;
  const scores = { coding: scoreOf("coding", codingRecord), behavioral: scoreOf("behavioral", behavioralRecord) };
  const overall = scoreOverall([scores.coding, scores.behavioral].filter((s): s is RoundScore => s !== null));
  const ready = (["coding", "behavioral"] as const).filter((r) => scores[r]).length;
  const started = (["coding", "behavioral"] as const).filter((r) => records[r]).length;

  const weaker = [scores.coding, scores.behavioral]
    .filter((s): s is RoundScore => s !== null && s.level !== null)
    .sort((a, b) => (a.level as number) - (b.level as number))[0];
  const actionRound: RoundType = weaker?.round ?? (scores.coding ? "coding" : scores.behavioral ? "behavioral" : "coding");
  const action = nextAction(records[actionRound]?.report ?? codingRecord?.report ?? behavioralRecord?.report ?? null);

  const debrief = () =>
    buildDebrief({
      roleLabel,
      overall: overall.band,
      keyTakeaway: action ? `${categoryLabel(action.category)}: ${action.why}` : undefined,
      tracks: (["coding", "behavioral"] as const).map((round) => ({ round, session: records[round]?.session, report: records[round]?.report ?? null })),
    });

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-rose-500/20 [color-scheme:light]" data-testid="full-mock-summary">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Wordmark size={24} tone="light" />
          <span className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
            Executive Telemetry Debrief
          </span>
          <span className="rounded-full bg-card border border-border px-3 py-1 font-mono text-xs font-medium text-foreground" data-testid="summary-status">
            {ready} of {Math.max(started, 1)} evaluation{Math.max(started, 1) === 1 ? "" : "s"} ready
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <DownloadDebrief
              build={debrief}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-card border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-all cursor-pointer"
              testId="download-debrief-header"
            />
            <button
              type="button"
              onClick={onReturnHome}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-background border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
              data-testid="return-home-btn"
            >
              Return home
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-16 pt-6 sm:px-6">
        <DebriefHero
          overall={overall}
          roleLabel={roleLabel}
          rounds={(["coding", "behavioral"] as const).map((round) => ({ round, score: scores[round], state: stateOf(records[round]) }))}
        />

        <div className="grid items-start gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          {(["coding", "behavioral"] as const).map((round) => (
            <TrackCard
              key={round}
              round={round}
              record={records[round]}
              score={scores[round]}
              onRetryReport={onRetryReport}
              onPracticeAgain={() => onPracticeAgain(round)}
            />
          ))}
        </div>

        <section className={`rounded-2xl bg-muted/40 border border-border p-6 sm:p-8 ${SHADOW}`} data-testid="action-plan">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
            <h2 className="font-brand text-xl font-bold tracking-tight text-foreground">Action Telemetry Plan</h2>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-card border border-border p-5 shadow-card" data-testid="score-next-action">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Key takeaway</p>
              {action ? (
                <>
                  <p className="mt-2 text-base font-semibold text-foreground">{categoryLabel(action.category)}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{action.why}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground font-mono">Your takeaway will populate once an evaluation is complete.</p>
              )}
            </div>
            <div className="rounded-xl bg-card border border-border p-5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Next step to practice</p>
              <div className="mt-2 flex flex-col gap-3">
                {(["coding", "behavioral"] as const)
                  .filter((r) => records[r]?.report)
                  .map((r) => (
                    <p key={r} className="text-sm leading-relaxed text-secondary-foreground">
                      <span className="font-semibold text-foreground">{TRACK_SHORT[r]}:</span> {records[r]?.report?.nextStep}
                    </p>
                  ))}
                {!codingRecord?.report && !behavioralRecord?.report && <p className="text-sm text-muted-foreground font-mono">Awaiting evaluations.</p>}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onPracticeAgain(actionRound)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold shadow-cta hover:bg-primary-hover active:translate-y-px transition-all cursor-pointer"
              data-testid="score-practice-weaker"
            >
              Practice {TRACK_SHORT[actionRound]} again
            </button>
            <DownloadDebrief
              build={debrief}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-card border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-all cursor-pointer"
            />
            <button
              type="button"
              onClick={onReturnHome}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-transparent border border-border px-6 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
              data-testid="action-return-home"
            >
              Return home
            </button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Practicing again initiates a fresh attempt calibrated to your target role. This telemetry debrief is preserved.
          </p>
        </section>
      </main>
    </div>
  );
}

function TrackCard({
  round,
  record,
  score,
  onRetryReport,
  onPracticeAgain,
}: {
  round: RoundType;
  record?: AttemptRecord;
  score: RoundScore | null;
  onRetryReport: (attemptId: string) => void;
  onPracticeAgain: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<EvidenceRef | null>(null);
  const testId = round === "coding" ? "summary-coding-card" : "summary-behavioral-card";
  const shell = `scroll-mt-24 flex min-w-0 flex-col gap-5 rounded-2xl bg-card border border-border p-5 sm:p-7 shadow-card`;
  const toggle = (ref: EvidenceRef) => setSelected((cur) => (cur && JSON.stringify(cur) === JSON.stringify(ref) ? null : ref));

  const title = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-brand text-xl font-bold tracking-tight text-foreground">{TRACK_LABEL[round]}</h2>
      {score && <BandBadge band={score.band} />}
    </div>
  );
  const practice = (
    <button
      type="button"
      onClick={onPracticeAgain}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-background border border-border px-4 py-2 font-mono text-xs font-semibold text-foreground hover:bg-muted transition-all self-start cursor-pointer"
      data-testid={`practice-again-${round}`}
    >
      {record ? `Practice ${TRACK_SHORT[round]} again` : `Start ${TRACK_SHORT[round]}`}
    </button>
  );

  if (!record) {
    return (
      <article id={`track-${round}`} className={shell} data-testid={testId}>
        {title}
        <p className="text-sm text-muted-foreground">Not completed in this interview loop.</p>
        {practice}
      </article>
    );
  }

  const { session, status, report, error } = record;
  const facts = round === "coding" ? (() => {
    const { lastRun, draftVersion } = codingFacts(record);
    return runFacts(lastRun, draftVersion);
  })() : null;
  const findings = report?.findings ?? [];
  const shown = expanded ? findings : findings.slice(0, 2);
  const primary = findings.find((f) => f.evidence.length > 0)?.evidence[0];

  return (
    <article id={`track-${round}`} className={shell} data-testid={testId}>
      <div className="flex flex-col gap-2">
        {title}
        <p className="text-xs text-muted-foreground font-mono">
          {isBehavioralSession(session)
            ? `${session.turns.filter((t) => t.speaker === "student").length} answers · ${session.turns.length} turns`
            : `${session.runs.length} runs · ${session.snapshots.length} code versions · ${session.turns.length} turns`}
          {score ? ` · ${score.ratedCount} of ${score.totalCount} dimensions assessed` : ""}
        </p>
        {record.timing && (
          <span
            className={`self-start rounded-full border px-3 py-0.5 font-mono text-xs font-semibold ${
              record.timing.timedOut ? "border-amber-200 bg-amber-50 text-amber-800" : "border-border bg-background text-foreground"
            }`}
            data-testid={`summary-time-${round}`}
          >
            {timingLabel(record.timing)}
          </span>
        )}
        {record.fromFixture && (
          <span className="self-start rounded-full bg-amber-500/10 text-amber-800 border border-amber-500/20 px-3 py-1 text-xs font-mono font-semibold" data-testid={`fixture-${round}`}>
            Sample feedback: no report service is configured
          </span>
        )}
      </div>

      {status === "loading" && (
        <div className="flex flex-col gap-3" role="status" aria-label={`Writing your ${TRACK_LABEL[round]}`}>
          <div className="h-3 w-40 animate-pulse rounded-full bg-muted" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
          <p className="text-sm text-muted-foreground font-mono">Generating telemetry evaluation. You can review the other track in the meantime.</p>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-5 text-sm text-red-800" role="alert">
          <p className="font-semibold text-red-900">Evaluation unavailable</p>
          <p className="mt-1 text-red-700">{error?.message ?? "The report service didn't respond."} Your attempt is saved.</p>
          {error?.retryable !== false && (
            <button
              type="button"
              onClick={() => onRetryReport(session.attemptId)}
              className="mt-3 inline-flex items-center justify-center rounded-xl bg-card border border-border px-4 py-2 font-mono text-xs font-semibold text-red-700 hover:bg-muted transition-colors cursor-pointer"
              data-testid={`retry-report-${round}`}
            >
              Retry report
            </button>
          )}
        </div>
      )}

      {status === "done" && report && score && (
        <>
          {score.caveat && (
            <p className="rounded-xl bg-muted/50 border border-border px-4 py-2.5 text-xs text-muted-foreground" data-testid={`score-caveat-${round}`}>
              {score.caveat}
            </p>
          )}
          <DimensionMeters score={score} />
          {score && <ReportExtras key={report.reportId} report={report} band={BAND_LABEL[score.band]} />}
          {facts && <RunFactsBlock facts={facts} complexity={score.dimensions.find((d) => d.category === "complexity")} />}

          <div className="rounded-xl bg-background border border-border p-4" data-testid={`takeaway-${round}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Next step to practice</p>
            <p className="mt-1 text-sm leading-relaxed text-secondary-foreground">{report.nextStep}</p>
            {primary && (
              <button
                type="button"
                onClick={() => toggle(primary)}
                className="mt-2.5 rounded-full bg-card border border-border px-3.5 py-1 font-mono text-xs text-foreground hover:bg-muted transition-all cursor-pointer"
                data-testid={`evidence-chip-${round}`}
              >
                Evidence: {describeEvidence(primary, session).label}
              </button>
            )}
          </div>

          {findings.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Concrete Evidence</h3>
              <ul className="flex flex-col gap-3">
                {shown.map((f) => (
                  <FindingCard key={f.id} finding={f} session={session} selected={selected} onSelectRef={toggle} />
                ))}
              </ul>
              {findings.length > 2 && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover self-start transition-colors cursor-pointer"
                  data-testid={`toggle-details-${round}`}
                >
                  {expanded ? "Show key evidence only" : `View all ${findings.length} findings`}
                </button>
              )}
            </div>
          )}

          {selected && <EvidenceReceipt refValue={selected} session={session} onClose={() => setSelected(null)} />}
        </>
      )}

      {practice}
    </article>
  );
}
