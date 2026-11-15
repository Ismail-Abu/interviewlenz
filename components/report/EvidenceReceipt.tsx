"use client";

import type { EvidenceRef, RunResult, Session } from "@/lib/contract";
import { isBehavioralSession } from "@/lib/behavioral";
import { evidenceLabel } from "./FindingCard";

interface Props {
  refValue: EvidenceRef;
  session: Session;
  onClose: () => void;
}

export function EvidenceReceipt({ refValue, session, onClose }: Props) {
  const title = evidenceLabel(refValue);
  let body: React.ReactNode;

  if (refValue.kind === "turn") {
    // The exact words from THIS attempt's transcript.
    const turn = session.turns.find((t) => t.id === refValue.turnId);
    body = turn ? (
      <figure data-testid="evidence-quote">
        <blockquote className="whitespace-pre-wrap rounded-r-lg border-l-2 border-primary bg-muted/40 p-4">
          <p className="font-serif text-[17px] italic leading-relaxed text-foreground sm:text-[18px]">
            “{turn.text}”
          </p>
        </blockquote>
        <figcaption className="mt-2.5 pl-2 font-mono text-xs font-medium text-muted-foreground">
          <span className={turn.speaker === "student" ? "text-primary font-semibold" : "text-foreground font-semibold"}>
            {turn.speaker === "student" ? "You" : "Interviewer"}
          </span>
          {" · "}
          {turn.id}
        </figcaption>
      </figure>
    ) : (
      <NotFound what={`Turn ${refValue.turnId} is not in this attempt's transcript.`} />
    );
  } else if (isBehavioralSession(session)) {
    body = <CalmNote what="This behavioral attempt has no code or runs." />;
  } else if (refValue.kind === "code") {
    const snap = session.snapshots.findLast((s) => s.codeVersion === refValue.codeVersion);
    body = snap ? (
      <pre
        className="overflow-x-auto rounded-xl bg-background border border-border py-3.5 font-mono text-xs text-foreground"
        data-testid="evidence-code"
      >
        {snap.source.split("\n").map((line, i) => {
          const n = i + 1;
          const hit = refValue.lines && n >= refValue.lines[0] && n <= refValue.lines[1];
          return (
            <div
              key={n}
              data-highlighted={hit || undefined}
              className={`flex px-3.5 leading-5 ${hit ? "bg-rose-50 text-rose-900 border-l-2 border-primary" : ""}`}
            >
              <span className="w-9 shrink-0 select-none text-right text-muted-foreground font-mono pr-4">
                {n}
              </span>
              <span className="whitespace-pre text-foreground">{line || " "}</span>
            </div>
          );
        })}
      </pre>
    ) : (
      <NotFound what={`No snapshot for version ${refValue.codeVersion} in this attempt.`} />
    );
  } else {
    const run = session.runs.findLast((r) => r.codeVersion === refValue.codeVersion);
    body = run ? (
      <RunDetail run={run} caseId={refValue.caseId} />
    ) : (
      <NotFound what={`No run of version ${refValue.codeVersion} in this attempt.`} />
    );
  }

  return (
    <section
      className="mt-5 rounded-xl bg-card border border-border p-5 sm:p-6 shadow-sm relative"
      data-testid="evidence-panel"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
            {title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-1 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          Close receipt ×
        </button>
      </div>
      {body}
    </section>
  );
}

function RunDetail({ run, caseId }: { run: RunResult; caseId?: string }) {
  if (run.status === "error") {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-xs font-mono text-red-800 border border-red-200">
        <p className="font-semibold">{run.error.message}</p>
        {run.error.line !== undefined && (
          <p className="mt-1 text-red-600">Line {run.error.line}</p>
        )}
      </div>
    );
  }
  return (
    <div data-testid="evidence-run" className="rounded-xl bg-background border border-border p-4 text-foreground">
      <div
        className={`mb-3 text-xs font-bold font-mono tracking-wide ${
          run.passed === run.total ? "text-emerald-600" : "text-amber-600"
        }`}
      >
        {run.passed}/{run.total} test cases passed
      </div>
      <ul className="flex flex-col gap-2">
        {run.cases.map((c) => {
          const hit = c.caseId === caseId;
          return (
            <li
              key={c.caseId}
              data-case-id={c.caseId}
              data-highlighted={hit || undefined}
              className={`grid grid-cols-[4rem_1fr] gap-x-3 rounded-lg px-3.5 py-2 font-mono text-xs leading-relaxed ${
                hit ? "bg-rose-50 ring-1 ring-primary" : "bg-card border border-border"
              }`}
            >
              <span className={c.pass ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                {c.caseId} {c.pass ? "✓" : "✗"}
              </span>
              <span className="text-muted-foreground">
                {c.input} → expected <span className="text-foreground">{c.expected}</span>, got{" "}
                <span className={c.pass ? "text-emerald-700" : "text-amber-700"}>
                  {c.actual ?? c.error ?? "—"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NotFound({ what }: { what: string }) {
  return <p className="text-sm font-medium text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded-[12px] p-3">{what}</p>;
}

function CalmNote({ what }: { what: string }) {
  return <p className="text-sm font-medium text-zinc-400 bg-zinc-900/60 border border-zinc-800 rounded-[12px] p-3">{what}</p>;
}
