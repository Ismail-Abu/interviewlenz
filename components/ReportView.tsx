"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiError, EvidenceRef, Finding, Report, RunResult, Session } from "@/lib/contract";

export interface AttemptRecord {
  session: Session;
  status: "loading" | "done" | "error";
  report?: Report;
  fromFixture?: boolean;
  error?: ApiError;
}

interface Props {
  records: AttemptRecord[];
  onRetryReport: (attemptId: string) => void;
  onRetryAttempt: () => void;
}

const RATING_STYLE: Record<Finding["rating"], string> = {
  strong: "bg-emerald-500/15 text-emerald-400",
  ok: "bg-sky-500/15 text-sky-300",
  needs_work: "bg-red-500/15 text-red-400",
  insufficient_evidence: "bg-zinc-700/50 text-zinc-300",
};

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

function evidenceLabel(ref: EvidenceRef) {
  if (ref.kind === "turn") return `Transcript ${ref.turnId}`;
  if (ref.kind === "code") return `Code v${ref.codeVersion}${ref.lines ? ` · lines ${ref.lines[0]}–${ref.lines[1]}` : ""}`;
  return `Run v${ref.codeVersion}${ref.caseId ? ` · ${ref.caseId}` : ""}`;
}

const sameRef = (a: EvidenceRef | null, b: EvidenceRef) => !!a && JSON.stringify(a) === JSON.stringify(b);

export function ReportView({ records, onRetryReport, onRetryAttempt }: Props) {
  const busy = records.some((r) => r.status === "loading");
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-zinc-800 bg-zinc-950/95 px-6 py-3 backdrop-blur">
        <span className="text-lg font-semibold tracking-tight">Interviewlenz</span>
        <span className="text-sm text-zinc-500">Interview report</span>
        <button
          onClick={onRetryAttempt}
          disabled={busy}
          className="ml-auto rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          Retry problem
        </button>
      </header>
      <main className={`grid gap-6 p-6 ${records.length > 1 ? "xl:grid-cols-2" : "mx-auto max-w-4xl"}`}>
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
      className="flex flex-col gap-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
    >
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Attempt {index + 1}</h2>
        <span className="font-mono text-xs text-zinc-500">{session.attemptId.slice(0, 8)}</span>
        {session.priorAttemptId && (
          <span className="text-xs text-zinc-500">retry of {session.priorAttemptId.slice(0, 8)}</span>
        )}
        {record.fromFixture && (
          <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold tracking-wider text-amber-300">
            FIXTURE DATA
          </span>
        )}
        <span className="ml-auto text-xs text-zinc-500" data-testid="attempt-stats">
          {session.snapshots.length} snapshots · {session.runs.length} runs · {session.turns.length} turns
        </span>
      </header>

      {record.status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200" />
          Writing your report…
        </div>
      )}

      {record.status === "error" && record.error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <div className="font-semibold text-red-300">Report unavailable</div>
          <div className="mt-1 text-red-200">{record.error.message}</div>
          <div className="mt-1 text-zinc-400">Your session is saved.</div>
          <button
            onClick={() => onRetryReport(session.attemptId)}
            className="mt-3 rounded-md border border-red-400/50 px-3 py-1.5 text-sm font-semibold text-red-200 hover:bg-red-500/20"
          >
            Retry report
          </button>
        </div>
      )}

      {report && (
        <>
          <section className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-300">Next step</div>
            <p className="mt-1 text-base font-medium text-zinc-50">{report.nextStep}</p>
          </section>

          <ul className="flex flex-col gap-3">
            {report.findings.map((f) => (
              <li key={f.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-200">{label(f.category)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${RATING_STYLE[f.rating]}`}>
                    {label(f.rating)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-300">{f.summary}</p>
                {f.evidence.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {f.evidence.map((ref, i) => (
                      <button
                        key={i}
                        data-evidence-kind={ref.kind}
                        onClick={() => setSelected(ref)}
                        className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
                          sameRef(selected, ref)
                            ? "border-sky-400 bg-sky-500/20 text-sky-100"
                            : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                        }`}
                      >
                        {evidenceLabel(ref)}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {selected && selected.kind !== "turn" && (
            <EvidencePanel refValue={selected} session={session} onClose={() => setSelected(null)} />
          )}
        </>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">Transcript</h3>
        {session.turns.length === 0 ? (
          <p className="text-sm text-zinc-500">No spoken turns in this attempt.</p>
        ) : (
          <ol className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
            {session.turns.map((t) => {
              const hit = selected?.kind === "turn" && selected.turnId === t.id;
              return (
                <li
                  key={t.id}
                  data-turn-id={t.id}
                  data-highlighted={hit || undefined}
                  ref={(el) => {
                    if (el) turnRefs.current.set(t.id, el);
                    else turnRefs.current.delete(t.id);
                  }}
                  className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                    hit ? "bg-amber-400/20 ring-2 ring-amber-400" : t.speaker === "student" ? "bg-zinc-800" : "bg-sky-500/10"
                  }`}
                >
                  <div className="mb-0.5 text-[11px] uppercase tracking-wide text-zinc-500">
                    {t.speaker === "student" ? "You" : "Interviewer"} · {t.id}
                  </div>
                  {t.text}
                </li>
              );
            })}
          </ol>
        )}
        {selected?.kind === "turn" && !session.turns.some((t) => t.id === selected.turnId) && (
          <p className="mt-2 text-sm text-amber-300">Turn {selected.turnId} is not in this attempt&apos;s transcript.</p>
        )}
      </section>
    </article>
  );
}

function EvidencePanel({
  refValue,
  session,
  onClose,
}: {
  refValue: Exclude<EvidenceRef, { kind: "turn" }>;
  session: Session;
  onClose: () => void;
}) {
  const title = evidenceLabel(refValue);
  let body: React.ReactNode;

  if (refValue.kind === "code") {
    const snap = session.snapshots.findLast((s) => s.codeVersion === refValue.codeVersion);
    body = snap ? (
      <pre className="overflow-x-auto rounded-md bg-[#1e1e1e] py-2 font-mono text-sm" data-testid="evidence-code">
        {snap.source.split("\n").map((line, i) => {
          const n = i + 1;
          const hit = refValue.lines && n >= refValue.lines[0] && n <= refValue.lines[1];
          return (
            <div key={n} data-highlighted={hit || undefined} className={`flex px-3 ${hit ? "bg-amber-400/20" : ""}`}>
              <span className="w-8 shrink-0 select-none text-right text-zinc-600">{n}</span>
              <span className="pl-4 whitespace-pre text-zinc-100">{line || " "}</span>
            </div>
          );
        })}
      </pre>
    ) : (
      <NotFound what={`No snapshot for version ${refValue.codeVersion} in this attempt.`} />
    );
  } else {
    const run = session.runs.findLast((r) => r.codeVersion === refValue.codeVersion);
    body = run ? <RunDetail run={run} caseId={refValue.caseId} /> : (
      <NotFound what={`No run of version ${refValue.codeVersion} in this attempt.`} />
    );
  }

  return (
    <section className="rounded-lg border border-sky-500/40 bg-zinc-900 p-4" data-testid="evidence-panel">
      <div className="mb-3 flex items-center">
        <h3 className="font-mono text-sm text-sky-200">{title}</h3>
        <button onClick={onClose} className="ml-auto text-xs text-zinc-400 hover:text-zinc-200">
          Close
        </button>
      </div>
      {body}
    </section>
  );
}

function RunDetail({ run, caseId }: { run: RunResult; caseId?: string }) {
  if (run.status === "error") {
    return (
      <div className="text-sm text-red-300">
        {run.error.message}
        {run.error.line !== undefined && ` (line ${run.error.line})`}
      </div>
    );
  }
  return (
    <div data-testid="evidence-run">
      <div className={`mb-2 text-sm font-semibold ${run.passed === run.total ? "text-emerald-400" : "text-red-400"}`}>
        {run.passed}/{run.total} passed
      </div>
      <ul className="flex flex-col gap-2">
        {run.cases.map((c) => {
          const hit = c.caseId === caseId;
          return (
            <li
              key={c.caseId}
              data-case-id={c.caseId}
              data-highlighted={hit || undefined}
              className={`grid grid-cols-[3.5rem_1fr] gap-x-3 rounded-md px-3 py-2 font-mono text-xs ${
                hit ? "bg-amber-400/20 ring-2 ring-amber-400" : "bg-zinc-950"
              }`}
            >
              <span className={c.pass ? "text-emerald-400" : "text-red-400"}>
                {c.caseId} {c.pass ? "✓" : "✗"}
              </span>
              <span className="text-zinc-300">
                {c.input} → expected {c.expected}, got {c.actual ?? c.error ?? "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NotFound({ what }: { what: string }) {
  return <p className="text-sm text-amber-300">{what}</p>;
}
