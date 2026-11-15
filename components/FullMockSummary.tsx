"use client";

// End-of-interview debrief: an executive summary, one evaluation card per track
// (Technical Coding, Behavioral Deep-Dive) with meters and verified evidence,
// and an action plan. Bands and meters come from lib/score.ts (no percentages,
// unassessed dimensions excluded); evidence chips resolve against the attempt.
import { useState } from "react";
import type { AttemptRecord } from "./ReportView";
import type { CodingSession, EvidenceRef, RoundType } from "@/lib/contract";
import { Wordmark } from "./Logo";
import { isBehavioralSession } from "@/lib/behavioral";
import { nextAction, runFacts, scoreOverall, scoreRound, type RoundScore } from "@/lib/score";
import { BandBadge, DebriefHero, DimensionMeters, RunFactsBlock, SHADOW } from "./report/Scorecard";
import { FindingCard } from "./report/FindingCard";
import { EvidenceReceipt } from "./report/EvidenceReceipt";
import { DownloadDebrief } from "./report/DownloadDebrief";
import { buildDebrief, categoryLabel, describeEvidence, TRACK_LABEL, TRACK_SHORT } from "./report/debrief";

interface Props {
  codingRecord?: AttemptRecord;
  behavioralRecord?: AttemptRecord;
  onRetryReport: (attemptId: string) => void;
  onPracticeAgain: (round: RoundType) => void;
  onReturnHome: () => void;
  // "Practicing for X at Y", when the student gave job details.
  roleLabel?: string;
}

// The tested version and the final unrun draft, read off the coding session.
// They stay separate: the last snapshot can be newer than anything run.
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

  // One recommended action, from the weaker scored track (else any report).
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
    <div className="min-h-screen bg-[#0B0C0E] text-zinc-100 antialiased selection:bg-rose-500/30 selection:text-white" data-testid="full-mock-summary">
      <header className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#0B0C0E]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Wordmark size={26} tone="dark" />
          <span className="hidden text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 sm:inline">
            Executive Telemetry Debrief
          </span>
          <span className="rounded-full bg-zinc-800/90 border border-white/10 px-3 py-1 font-mono text-xs font-medium text-zinc-300" data-testid="summary-status">
            {ready} of {Math.max(started, 1)} evaluation{Math.max(started, 1) === 1 ? "" : "s"} ready
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <DownloadDebrief
              build={debrief}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-800/80 border border-white/10 px-4 py-2 font-mono text-xs font-semibold text-zinc-200 hover:bg-zinc-700/80 hover:border-white/20 transition-all"
              testId="download-debrief-header"
            />
            <button
              type="button"
              onClick={onReturnHome}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-transparent border border-white/10 px-4 py-2 font-mono text-xs font-semibold text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-all"
              data-testid="return-home-btn"
            >
              Return home
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-16 pt-4 sm:px-6">
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

        <section className={`rounded-[28px] bg-[#121318]/90 border border-white/[0.08] p-6 sm:p-8 backdrop-blur-xl ${SHADOW}`} data-testid="action-plan">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" aria-hidden />
            <h2 className="font-brand text-2xl font-bold tracking-tight text-white">Action Telemetry Plan</h2>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[20px] bg-[#161720]/80 border border-white/[0.06] p-5" data-testid="score-next-action">
              <p className="text-xs font-mono font-bold uppercase tracking-[0.1em] text-rose-400">Key takeaway</p>
              {action ? (
                <>
                  <p className="mt-2 text-lg font-semibold text-zinc-100">{categoryLabel(action.category)}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-zinc-400">{action.why}</p>
                </>
              ) : (
                <p className="mt-2 text-[15px] text-zinc-500 font-mono">Your takeaway will populate once an evaluation is complete.</p>
              )}
            </div>
            <div className="rounded-[20px] bg-[#161720]/80 border border-white/[0.06] p-5">
              <p className="text-xs font-mono font-bold uppercase tracking-[0.1em] text-rose-400">Next step to practice</p>
              <div className="mt-2 flex flex-col gap-3">
                {(["coding", "behavioral"] as const)
                  .filter((r) => records[r]?.report)
                  .map((r) => (
                    <p key={r} className="text-[15px] leading-relaxed text-zinc-300">
                      <span className="font-semibold text-zinc-100">{TRACK_SHORT[r]}:</span> {records[r]?.report?.nextStep}
                    </p>
                  ))}
                {!codingRecord?.report && !behavioralRecord?.report && <p className="text-[15px] text-zinc-500 font-mono">Awaiting evaluations.</p>}
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onPracticeAgain(actionRound)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#C8102E] to-[#E11D48] px-6 py-3 font-mono text-sm font-semibold text-white shadow-[0_0_20px_rgba(200,16,46,0.35)] hover:shadow-[0_0_28px_rgba(200,16,46,0.5)] transition-all"
              data-testid="score-practice-weaker"
            >
              Practice {TRACK_SHORT[actionRound]} again
            </button>
            <DownloadDebrief
              build={debrief}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-800/80 border border-white/10 px-6 py-3 font-mono text-sm font-semibold text-zinc-200 hover:bg-zinc-700/80 hover:border-white/20 transition-all"
            />
            <button
              type="button"
              onClick={onReturnHome}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-transparent border border-white/10 px-6 py-3 font-mono text-sm font-semibold text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-all"
              data-testid="action-return-home"
            >
              Return home
            </button>
          </div>
          <p className="mt-4 text-xs font-mono text-zinc-500">
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
  const shell = `scroll-mt-24 flex min-w-0 flex-col gap-5 rounded-[28px] bg-[#121318]/90 border border-white/[0.08] p-5 sm:p-7 shadow-2xl backdrop-blur-xl`;
  const toggle = (ref: EvidenceRef) => setSelected((cur) => (cur && JSON.stringify(cur) === JSON.stringify(ref) ? null : ref));

  const title = (
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="font-brand text-xl font-bold tracking-tight text-white">{TRACK_LABEL[round]}</h2>
      {score && <BandBadge band={score.band} />}
    </div>
  );
  const practice = (
    <button
      type="button"
      onClick={onPracticeAgain}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-800/80 border border-white/10 px-4 py-2 font-mono text-xs font-semibold text-zinc-200 hover:bg-zinc-700/80 hover:border-white/20 transition-all self-start"
      data-testid={`practice-again-${round}`}
    >
      {record ? `Practice ${TRACK_SHORT[round]} again` : `Start ${TRACK_SHORT[round]}`}
    </button>
  );

  if (!record) {
    return (
      <article id={`track-${round}`} className={shell} data-testid={testId}>
        {title}
        <p className="text-[14px] font-mono text-zinc-400">Not completed in this interview loop.</p>
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
        <p className="text-xs font-mono text-zinc-400">
          {isBehavioralSession(session)
            ? `${session.turns.filter((t) => t.speaker === "student").length} answers · ${session.turns.length} turns`
            : `${session.runs.length} runs · ${session.snapshots.length} code versions · ${session.turns.length} turns`}
          {score ? ` · ${score.ratedCount} of ${score.totalCount} dimensions assessed` : ""}
        </p>
        {record.fromFixture && (
          <span className="self-start rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40 px-3 py-1 text-xs font-mono font-bold" data-testid={`fixture-${round}`}>
            Sample feedback: no report service is configured
          </span>
        )}
      </div>

      {status === "loading" && (
        <div className="flex flex-col gap-3" role="status" aria-label={`Writing your ${TRACK_LABEL[round]}`}>
          <div className="h-3 w-40 animate-pulse rounded-full bg-zinc-800" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-[14px] bg-zinc-800/70" />
            ))}
          </div>
          <p className="text-sm font-mono text-zinc-400">Generating telemetry evaluation. You can review the other track in the meantime.</p>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-[20px] bg-rose-950/40 border border-rose-800/60 p-5 text-sm text-rose-200" role="alert">
          <p className="font-semibold text-rose-100">Evaluation unavailable</p>
          <p className="mt-1 text-rose-300">{error?.message ?? "The report service didn't respond."} Your attempt is saved.</p>
          {error?.retryable !== false && (
            <button
              type="button"
              onClick={() => onRetryReport(session.attemptId)}
              className="mt-3 inline-flex items-center justify-center rounded-xl bg-zinc-800 border border-white/10 px-4 py-2 font-mono text-xs font-semibold text-rose-300 hover:bg-zinc-700 hover:text-white transition-colors"
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
            <p className="rounded-[16px] bg-[#161720]/90 border border-white/[0.06] px-4 py-2.5 text-sm text-zinc-300" data-testid={`score-caveat-${round}`}>
              {score.caveat}
            </p>
          )}
          <DimensionMeters score={score} />
          {facts && <RunFactsBlock facts={facts} complexity={score.dimensions.find((d) => d.category === "complexity")} />}

          <div className="rounded-[20px] bg-[#161720]/80 border border-white/[0.06] p-4.5" data-testid={`takeaway-${round}`}>
            <p className="text-xs font-mono font-bold uppercase tracking-[0.1em] text-rose-400">Next step to practice</p>
            <p className="mt-1 text-[15px] leading-relaxed text-zinc-200">{report.nextStep}</p>
            {primary && (
              <button
                type="button"
                onClick={() => toggle(primary)}
                className="mt-2.5 rounded-full bg-zinc-800/90 border border-white/10 px-3.5 py-1 font-mono text-xs text-zinc-300 hover:border-white/20 hover:bg-zinc-700 hover:text-white transition-all"
                data-testid={`evidence-chip-${round}`}
              >
                Evidence: {describeEvidence(primary, session).label}
              </button>
            )}
          </div>

          {findings.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-[0.1em] text-zinc-400">Concrete Evidence</h3>
              <ul className="flex flex-col gap-3">
                {shown.map((f) => (
                  <FindingCard key={f.id} finding={f} session={session} selected={selected} onSelectRef={toggle} />
                ))}
              </ul>
              {findings.length > 2 && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-rose-400 hover:text-rose-300 self-start transition-colors"
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
