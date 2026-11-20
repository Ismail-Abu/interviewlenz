"use client";

import { Fragment } from "react";
import type { EvidenceRef, Session } from "@/lib/contract";
import { questionTimeStart } from "@/lib/transcript";

interface Props {
  session: Session;
  selected: EvidenceRef | null;
  turnRefs: React.MutableRefObject<Map<string, HTMLLIElement>>;
}

export function TranscriptSection({ session, selected, turnRefs }: Props) {
  // Turns after "Do you have any questions for me?" are the candidate's
  // question time; the report does not grade them (app/api/report/route.ts).
  const start = questionTimeStart(session.turns);
  const questionStart = start >= 0 && start < session.turns.length - 1 ? start : -2;
  return (
    <section className="rounded-xl bg-card border border-border p-5 sm:p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
          Spoken Transcript Telemetry
        </h3>
        <span className="font-mono text-xs text-muted-foreground">
          {session.turns.length} {session.turns.length === 1 ? "turn" : "turns"}
        </span>
      </div>

      {session.turns.length === 0 ? (
        <p className="text-sm italic text-muted-foreground font-mono">No spoken turns recorded in this attempt.</p>
      ) : (
        <ol className="flex max-h-96 flex-col gap-2.5 overflow-y-auto pr-1 scrollbar-thin">
          {session.turns.map((t, i) => {
            const hit = selected?.kind === "turn" && selected.turnId === t.id;
            return (
              <Fragment key={t.id}>
              {i === questionStart + 1 && (
                <li className="mt-1 border-t border-border pt-2 text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground" data-testid="question-time-divider">
                  Your questions for the interviewer · not graded
                </li>
              )}
              <li
                key={t.id}
                data-turn-id={t.id}
                data-highlighted={hit || undefined}
                ref={(el) => {
                  if (el) turnRefs.current.set(t.id, el);
                  else turnRefs.current.delete(t.id);
                }}
                className={`rounded-lg p-3.5 text-[14px] leading-relaxed transition-all ${
                  hit
                    ? "bg-rose-50 border border-primary/40 ring-1 ring-primary text-foreground"
                    : t.speaker === "student"
                    ? "bg-card border border-border text-foreground"
                    : "bg-muted/60 border border-border/80 text-foreground"
                }`}
              >
                <div className="mb-1 text-[11px] font-mono font-bold uppercase tracking-wider">
                  <span className={t.speaker === "student" ? "text-primary" : "text-foreground"}>
                    {t.speaker === "student" ? "You" : "Interviewer"}
                  </span>
                  <span className="text-muted-foreground"> · {t.id}</span>
                </div>
                <div className="text-foreground font-sans">{t.text}</div>
              </li>
              </Fragment>
            );
          })}
        </ol>
      )}

      {selected?.kind === "turn" && !session.turns.some((t) => t.id === selected.turnId) && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-mono text-amber-700 border border-amber-200">
          Turn {selected.turnId} is not in this attempt&apos;s transcript.
        </p>
      )}
    </section>
  );
}
