"use client";

// End-of-interview debrief: an executive summary, one evaluation card per track
// (Technical Coding, Behavioral Deep-Dive) with meters and verified evidence,
// and an action plan. Bands and meters come from lib/score.ts (no percentages,
// unassessed dimensions excluded); evidence chips resolve against the attempt.
import { useState } from "react";
import type { AttemptRecord } from "./ReportView";
import type { CodingSession, EvidenceRef, RoundType } from "@/lib/contract";
import { Wordmark } from "./Logo";
import { coverBtn, coverBtnSm } from "./ui/buttons";
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
    <div data-surface="cream" className="min-h-screen bg-cream text-ink [color-scheme:light]" data-testid="full-mock-summary">
      <header className="sticky top-0 z-10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Wordmark size={26} tone="light" />
          <span className="hidden text-base font-semibold text-ink sm:inline">Interview debrief</span>
          <span className="rounded-full bg-cream-3 px-3 py-1 text-xs font-semibold text-[#5F5249]" data-testid="summary-status">
            {ready} of {Math.max(started, 1)} evaluation{Math.max(started, 1) === 1 ? "" : "s"} ready
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <DownloadDebrief build={debrief} className={coverBtnSm.secondary} testId="download-debrief-header" />
            <button type="button" onClick={onReturnHome} className={coverBtnSm.neutral} data-testid="return-home-btn">
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

        <section className={`rounded-[30px] bg-cream-2 p-6 sm:p-8 ${SHADOW}`} data-testid="action-plan">
          <h2 className="font-brand text-2xl font-bold tracking-tight">Your action plan</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] bg-white/75 p-5" data-testid="score-next-action">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-maroon-deep">Key takeaway</p>
              {action ? (
                <>
                  <p className="mt-2 text-lg font-semibold text-ink">{categoryLabel(action.category)}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">{action.why}</p>
                </>
              ) : (
                <p className="mt-2 text-[15px] text-ink-muted">Your takeaway appears here once an evaluation is ready.</p>
              )}
            </div>
            <div className="rounded-[22px] bg-white/75 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-maroon-deep">Next step to practice</p>
              <div className="mt-2 flex flex-col gap-3">
                {(["coding", "behavioral"] as const)
                  .filter((r) => records[r]?.report)
                  .map((r) => (
                    <p key={r} className="text-[15px] leading-relaxed text-ink">
                      <span className="font-semibold">{TRACK_SHORT[r]}:</span> {records[r]?.report?.nextStep}
                    </p>
                  ))}
                {!codingRecord?.report && !behavioralRecord?.report && <p className="text-[15px] text-ink-muted">Waiting for your evaluations.</p>}
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => onPracticeAgain(actionRound)} className={coverBtn.primary} data-testid="score-practice-weaker">
              Practice the {TRACK_SHORT[actionRound].toLowerCase()} evaluation again
            </button>
            <DownloadDebrief build={debrief} className={coverBtn.secondary} />
            <button type="button" onClick={onReturnHome} className={coverBtn.neutral} data-testid="action-return-home">
              Return home
            </button>
          </div>
          <p className="mt-4 text-xs text-ink-muted">Practicing again starts a fresh attempt with the same target role. This debrief stays here.</p>
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
  const shell = `scroll-mt-24 flex min-w-0 flex-col gap-5 rounded-[30px] bg-cream-2 p-5 sm:p-7 ${SHADOW}`;
  const toggle = (ref: EvidenceRef) => setSelected((cur) => (cur && JSON.stringify(cur) === JSON.stringify(ref) ? null : ref));

  const title = (
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="font-brand text-xl font-bold tracking-tight text-ink">{TRACK_LABEL[round]}</h2>
      {score && <BandBadge band={score.band} />}
    </div>
  );
  const practice = (
    <button type="button" onClick={onPracticeAgain} className={`${coverBtnSm.secondary} self-start`} data-testid={`practice-again-${round}`}>
      {record ? `Practice ${TRACK_SHORT[round].toLowerCase()} again` : `Start the ${TRACK_SHORT[round].toLowerCase()} evaluation`}
    </button>
  );

  if (!record) {
    return (
      <article id={`track-${round}`} className={shell} data-testid={testId}>
        {title}
        <p className="text-[15px] text-ink-muted">Not completed in this interview.</p>
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
        <p className="text-xs text-ink-muted">
          {isBehavioralSession(session)
            ? `${session.turns.filter((t) => t.speaker === "student").length} answers · ${session.turns.length} turns`
            : `${session.runs.length} runs · ${session.snapshots.length} code versions · ${session.turns.length} turns`}
          {score ? ` · ${score.ratedCount} of ${score.totalCount} dimensions assessed` : ""}
        </p>
        {record.fromFixture && (
          <span className="self-start rounded-full bg-[#fbe9c8] px-3 py-1 text-xs font-bold text-[#7a4600]" data-testid={`fixture-${round}`}>
            Sample feedback: no report service is configured
          </span>
        )}
      </div>

      {status === "loading" && (
        <div className="flex flex-col gap-3" role="status" aria-label={`Writing your ${TRACK_LABEL[round]}`}>
          <div className="h-3 w-40 animate-pulse rounded-full bg-[#EADECE]" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-[14px] bg-[#EADECE]/70" />
            ))}
          </div>
          <p className="text-sm text-ink-muted">Writing your evaluation. You can read the other one meanwhile.</p>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-[22px] bg-[#FBEDEF] p-5 text-sm text-ink" role="alert">
          <p className="font-semibold">Evaluation unavailable</p>
          <p className="mt-1 text-ink-muted">{error?.message ?? "The report service didn't respond."} Your attempt is saved.</p>
          {error?.retryable !== false && (
            <button type="button" onClick={() => onRetryReport(session.attemptId)} className={`${coverBtnSm.primary} mt-3`} data-testid={`retry-report-${round}`}>
              Retry report
            </button>
          )}
        </div>
      )}

      {status === "done" && report && score && (
        <>
          {score.caveat && (
            <p className="rounded-[16px] bg-cream-3 px-4 py-2.5 text-sm text-ink" data-testid={`score-caveat-${round}`}>
              {score.caveat}
            </p>
          )}
          <DimensionMeters score={score} />
          {facts && <RunFactsBlock facts={facts} complexity={score.dimensions.find((d) => d.category === "complexity")} />}

          <div className="rounded-[22px] bg-white/75 p-4" data-testid={`takeaway-${round}`}>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-maroon-deep">Next step to practice</p>
            <p className="mt-1 text-[15px] leading-relaxed text-ink">{report.nextStep}</p>
            {primary && (
              <button
                type="button"
                onClick={() => toggle(primary)}
                className="mt-2 rounded-full bg-cream-3 px-3 py-1 font-mono text-xs text-ink hover:bg-[#EDE2D0]"
                data-testid={`evidence-chip-${round}`}
              >
                Evidence: {describeEvidence(primary, session).label}
              </button>
            )}
          </div>

          {findings.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">Evidence</h3>
              <ul className="flex flex-col gap-3">
                {shown.map((f) => (
                  <FindingCard key={f.id} finding={f} session={session} selected={selected} onSelectRef={toggle} />
                ))}
              </ul>
              {findings.length > 2 && (
                <button type="button" onClick={() => setExpanded((v) => !v)} className={`${coverBtnSm.neutral} self-start`} data-testid={`toggle-details-${round}`}>
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
