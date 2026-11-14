"use client";

import { useEffect, useRef } from "react";
import type { ApiError, LiveState, TranscriptTurn } from "@/lib/contract";

interface Props {
  connected: boolean;
  connecting: boolean;
  micOn: boolean;
  state: LiveState | null;
  turns: TranscriptTurn[];
  error: ApiError | null;
  mocked: boolean;
  onConnect: () => void;
  onToggleMic: () => void;
  onEnd: () => void;
}

const STATE_STYLE: Record<LiveState, { label: string; dot: string; text: string }> = {
  connecting: { label: "Connecting…", dot: "bg-amber-400 animate-pulse", text: "text-amber-300" },
  listening: { label: "Listening", dot: "bg-emerald-400 animate-pulse", text: "text-emerald-300" },
  speaking: { label: "Interviewer speaking", dot: "bg-sky-400 animate-pulse", text: "text-sky-300" },
  idle: { label: "Idle", dot: "bg-zinc-500", text: "text-zinc-400" },
  error: { label: "Error", dot: "bg-red-500", text: "text-red-400" },
};

export function VoicePanel(p: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [p.turns.length]);

  const s = p.state ? STATE_STYLE[p.state] : null;

  return (
    <section className="flex min-h-0 flex-col border-t border-zinc-800">
      <header className="flex flex-wrap items-center gap-3 px-6 py-3">
        <h2 className="text-sm font-semibold text-zinc-200">Interviewer</h2>
        {p.mocked && (
          <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold tracking-wider text-amber-300">
            MOCK VOICE
          </span>
        )}
        {s && (
          <span className={`flex items-center gap-2 text-xs font-medium ${s.text}`} aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {!p.connected ? (
            <button
              onClick={p.onConnect}
              disabled={p.connecting}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
            >
              {p.connecting ? "Connecting…" : "Start interview"}
            </button>
          ) : (
            <>
              <button
                onClick={p.onToggleMic}
                aria-pressed={p.micOn}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold text-white ${
                  p.micOn ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {p.micOn ? "Mute mic" : "Unmute mic"}
              </button>
              <button
                onClick={p.onEnd}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                End
              </button>
            </>
          )}
        </div>
      </header>

      {p.error && (
        <div className="mx-6 mb-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {p.error.message}
          {p.error.retryable && " — try again."}
        </div>
      )}

      <ol ref={listRef} className="flex max-h-64 flex-col gap-2 overflow-y-auto px-6 pb-4">
        {p.turns.length === 0 && (
          <li className="text-sm text-zinc-500">
            {p.connected ? "Unmute and explain your approach out loud." : "Start the interview to talk through your solution."}
          </li>
        )}
        {p.turns.map((t) => (
          <li
            key={t.id}
            className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
              t.speaker === "student" ? "self-end bg-zinc-800 text-zinc-100" : "self-start bg-sky-500/10 text-sky-100"
            }`}
          >
            <div className="mb-0.5 text-[11px] uppercase tracking-wide text-zinc-500">
              {t.speaker === "student" ? "You" : "Interviewer"} · {t.id}
            </div>
            {t.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
