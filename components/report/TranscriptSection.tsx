"use client";

import type { EvidenceRef, Session } from "@/lib/contract";

interface Props {
  session: Session;
  selected: EvidenceRef | null;
  turnRefs: React.MutableRefObject<Map<string, HTMLLIElement>>;
}

export function TranscriptSection({ session, selected, turnRefs }: Props) {
  return (
    <section className="rounded-[22px] bg-[#161720]/80 border border-white/[0.06] p-5 sm:p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
          Spoken Transcript Telemetry
        </h3>
        <span className="font-mono text-xs text-zinc-400">
          {session.turns.length} {session.turns.length === 1 ? "turn" : "turns"}
        </span>
      </div>

      {session.turns.length === 0 ? (
        <p className="text-sm italic text-zinc-500 font-mono">No spoken turns recorded in this attempt.</p>
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
                className={`rounded-[16px] p-4 text-[14px] sm:text-[15px] leading-relaxed transition-all ${
                  hit
                    ? "bg-rose-950/50 ring-2 ring-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] text-zinc-100"
                    : t.speaker === "student"
                    ? "bg-[#191A24] border border-white/[0.05] text-zinc-200"
                    : "bg-rose-950/20 border border-rose-500/20 text-zinc-200"
                }`}
              >
                <div className="mb-1 text-[11px] font-mono font-bold uppercase tracking-wider">
                  <span className={t.speaker === "student" ? "text-cyan-400" : "text-rose-400"}>
                    {t.speaker === "student" ? "You" : "Interviewer"}
                  </span>
                  <span className="text-zinc-500"> · {t.id}</span>
                </div>
                <div className="text-zinc-200 font-sans">{t.text}</div>
              </li>
            );
          })}
        </ol>
      )}

      {selected?.kind === "turn" && !session.turns.some((t) => t.id === selected.turnId) && (
        <p className="mt-3 rounded-[12px] bg-amber-950/40 p-3 text-xs font-mono text-amber-300 border border-amber-800/50">
          Turn {selected.turnId} is not in this attempt&apos;s transcript.
        </p>
      )}
    </section>
  );
}
