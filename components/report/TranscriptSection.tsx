"use client";

import type { EvidenceRef, Session } from "@/lib/contract";

interface Props {
  session: Session;
  selected: EvidenceRef | null;
  turnRefs: React.MutableRefObject<Map<string, HTMLLIElement>>;
}

export function TranscriptSection({ session, selected, turnRefs }: Props) {
  return (
    <section className="rounded-[26px] bg-cream-2 p-5 sm:p-6 shadow-[0_10px_18px_-6px_rgb(90_68_50/0.13)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          Transcript
        </h3>
        <span className="font-mono text-xs text-ink-muted">
          {session.turns.length} {session.turns.length === 1 ? "turn" : "turns"}
        </span>
      </div>

      {session.turns.length === 0 ? (
        <p className="text-sm italic text-ink-muted">No spoken turns in this attempt.</p>
      ) : (
        <ol className="flex max-h-96 flex-col gap-2.5 overflow-y-auto pr-1 scrollbar-thin">
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
                className={`rounded-[18px] p-4 text-[15px] leading-relaxed transition-all ${
                  hit
                    ? "bg-cream ring-2 ring-maroon shadow-md"
                    : t.speaker === "student"
                    ? "bg-cream-3 text-ink"
                    : "bg-[#EFE3CF] text-ink"
                }`}
              >
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-maroon/90">
                  {t.speaker === "student" ? "You" : "Interviewer"} · {t.id}
                </div>
                <div className="text-ink">{t.text}</div>
              </li>
            );
          })}
        </ol>
      )}

      {selected?.kind === "turn" && !session.turns.some((t) => t.id === selected.turnId) && (
        <p className="mt-3 rounded-[12px] bg-amber-50 p-3 text-xs font-medium text-amber-900 border border-amber-200">
          Turn {selected.turnId} is not in this attempt&apos;s transcript.
        </p>
      )}
    </section>
  );
}
