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
        <blockquote className="whitespace-pre-wrap rounded-r-[18px] border-l-4 border-maroon bg-cream-2/95 p-5 shadow-sm">
          <p className="font-serif text-[17px] italic leading-relaxed text-ink sm:text-[18px]">
            “{turn.text}”
          </p>
        </blockquote>
        <figcaption className="mt-2.5 pl-2 font-mono text-xs font-medium text-ink-muted">
          {turn.speaker === "student" ? "You" : "Interviewer"} · {turn.id}
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
        className="overflow-x-auto rounded-[18px] bg-panel py-3.5 font-mono text-xs text-zinc-100 shadow-[0_12px_22px_-6px_rgb(90_68_50/0.14)]"
        data-testid="evidence-code"
      >
        {snap.source.split("\n").map((line, i) => {
          const n = i + 1;
          const hit = refValue.lines && n >= refValue.lines[0] && n <= refValue.lines[1];
          return (
            <div
              key={n}
              data-highlighted={hit || undefined}
              className={`flex px-3.5 leading-5 ${hit ? "bg-amber-400/20 text-amber-200" : ""}`}
            >
              <span className="w-9 shrink-0 select-none text-right text-zinc-500 font-mono pr-4">
                {n}
              </span>
              <span className="whitespace-pre text-zinc-100">{line || " "}</span>
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
      className="mt-5 rounded-[22px] bg-cream-3/90 p-5 sm:p-6 shadow-[0_10px_18px_-6px_rgb(90_68_50/0.13)] border border-cream-line/70"
      data-testid="evidence-panel"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-maroon" aria-hidden />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-maroon">
            {title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-1 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-cream-2 transition-colors focus-visible:ring-2 focus-visible:ring-maroon-soft focus-visible:outline-none"
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
      <div className="rounded-[14px] bg-red-50 p-4 text-xs font-mono text-red-900 border border-red-200">
        <p className="font-semibold">{run.error.message}</p>
        {run.error.line !== undefined && (
          <p className="mt-1 text-red-700">Line {run.error.line}</p>
        )}
      </div>
    );
  }
  return (
    <div data-testid="evidence-run" className="rounded-[18px] bg-panel p-4 text-zinc-100 shadow-[0_12px_22px_-6px_rgb(90_68_50/0.14)]">
      <div
        className={`mb-3 text-xs font-bold font-mono tracking-wide ${
          run.passed === run.total ? "text-emerald-400" : "text-amber-400"
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
              className={`grid grid-cols-[4rem_1fr] gap-x-3 rounded-[10px] px-3.5 py-2 font-mono text-xs leading-relaxed ${
                hit ? "bg-amber-400/25 ring-1 ring-amber-400" : "bg-[#141211]"
              }`}
            >
              <span className={c.pass ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                {c.caseId} {c.pass ? "✓" : "✗"}
              </span>
              <span className="text-zinc-300">
                {c.input} → expected <span className="text-zinc-100">{c.expected}</span>, got{" "}
                <span className={c.pass ? "text-emerald-300" : "text-amber-300"}>
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
  return <p className="text-sm font-medium text-amber-800 bg-amber-50 rounded-[12px] p-3">{what}</p>;
}

function CalmNote({ what }: { what: string }) {
  return <p className="text-sm italic text-ink-muted p-2">{what}</p>;
}
