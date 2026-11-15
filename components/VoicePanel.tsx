"use client";

import { useEffect, useRef } from "react";
import type { ApiError, LiveState, TranscriptTurn } from "@/lib/contract";
import type { VoiceMode } from "./liveAdapter";
import type { MicStatus } from "./StartScreen";
import { btn } from "./ui/buttons";

interface Props {
  connected: boolean;
  connecting: boolean;
  micOn: boolean;
  state: LiveState | null;
  turns: TranscriptTurn[];
  error: ApiError | null;
  voiceMode: VoiceMode | null;
  mockReason?: string;
  micStatus: MicStatus;
  onConnect: () => void;
  onToggleMic: () => void;
  onEnd: () => void;
}

const STATE_STYLE: Record<LiveState, { label: string; dot: string; text: string }> = {
  connecting: { label: "Connecting…", dot: "bg-amber-400 animate-pulse", text: "text-amber-300" },
  listening: { label: "Listening", dot: "bg-emerald-400 animate-pulse", text: "text-emerald-300" },
  speaking: { label: "Interviewer speaking", dot: "bg-brand-coral animate-pulse", text: "text-brand-coral" },
  idle: { label: "Paused", dot: "bg-zinc-500", text: "text-zinc-400" },
  error: { label: "Error", dot: "bg-red-500", text: "text-red-400" },
};

export function VoicePanel(p: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [p.turns.length]);

  const s = p.state ? STATE_STYLE[p.state] : null;
  const micBlocked = p.micStatus === "denied" || p.micStatus === "unsupported";

  return (
    <section className="flex h-[19rem] shrink-0 flex-col border-t border-zinc-800 2xl:h-[24rem]">
      <header className="flex items-center gap-3 px-6 pt-3">
        <h2 className="text-base font-semibold text-zinc-100">Interviewer</h2>
        <div className="ml-auto flex shrink-0 gap-2">
          {!p.connected ? (
            <button
              onClick={p.onConnect}
              disabled={p.connecting}
              className={`${btn.primary} px-4 py-2 text-base`}
            >
              {p.connecting ? "Connecting…" : "Start interview"}
            </button>
          ) : (
            <>
              <button
                onClick={p.onToggleMic}
                aria-pressed={p.micOn}
                className={`${p.micOn ? btn.neutral : btn.secondary} px-4 py-2 text-base`}
              >
                {p.micOn ? "Mute" : "Unmute"}
              </button>
              <button
                onClick={p.onEnd}
                className={`${btn.neutral} px-4 py-2 text-base`}
              >
                End
              </button>
            </>
          )}
        </div>
      </header>

      {/* Fixed-height status row so the transcript does not jump when it fills. */}
      <div className="flex h-9 items-center gap-3 px-6">
        {p.voiceMode === "mock" && (
          <span
            className="rounded bg-amber-400/15 px-2 py-0.5 text-xs font-bold tracking-wider text-amber-300"
            data-testid="mock-voice-badge"
          >
            MOCK VOICE{p.mockReason ? ` (${p.mockReason})` : ""}
          </span>
        )}
        {s && (
          <span className={`flex items-center gap-2 text-sm font-medium ${s.text}`} aria-live="polite">
            <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} aria-hidden />
            {s.label}
          </span>
        )}
      </div>

      {p.error && (
        <div className="mx-6 mb-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
          {p.error.message}
          {p.error.retryable && " — try again."}
        </div>
      )}

      <ol ref={listRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-6 pb-4">
        {p.turns.length === 0 && (
          <li className="text-base text-zinc-500">
            {p.connected
              ? "The interviewer will start in a moment."
              : "Start the interview to talk through your approach before you code."}
            {micBlocked && (
              <span className="mt-2 block text-sm text-amber-300/90">
                Microphone is blocked, so the interviewer runs in scripted mode. Everything else works.
              </span>
            )}
          </li>
        )}
        {p.turns.map((t) => (
          <li
            key={t.id}
            className={`max-w-[92%] rounded-lg px-3.5 py-2.5 text-[15px] leading-relaxed ${
              t.speaker === "student" ? "self-end bg-zinc-800 text-zinc-100" : "self-start bg-brand-coral/10 text-zinc-50"
            }`}
          >
            <div className="mb-0.5 text-xs uppercase tracking-wide text-zinc-500">
              {t.speaker === "student" ? "You" : "Interviewer"} · {t.id}
            </div>
            {t.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
