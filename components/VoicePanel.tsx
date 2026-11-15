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
  // Real voice lost its connection; the client is kept for an in-place reconnect.
  disconnected: boolean;
  reconnecting: boolean;
  onReconnect: () => void;
  onConnect: () => void;
  onToggleMic: () => void;
  onEnd: () => void;
}

const STATE_STYLE: Record<LiveState, { label: string; dot: string; text: string }> = {
  connecting: { label: "Connecting…", dot: "bg-amber-400 animate-pulse", text: "text-amber-300" },
  listening: { label: "Listening", dot: "bg-emerald-400 animate-pulse", text: "text-emerald-300" },
  speaking: { label: "Interviewer speaking", dot: "bg-maroon-soft animate-pulse", text: "text-maroon-soft" },
  idle: { label: "Paused", dot: "bg-zinc-500", text: "text-zinc-400" },
  error: { label: "Error", dot: "bg-red-500", text: "text-red-400" },
};

export function VoicePanel(p: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  // Follow the newest turn, but don't yank the view back if the student has
  // scrolled up to re-read something. Measured before the paint that adds the
  // new turn, so "was at the bottom" means the state they were in.
  const wasAtBottom = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (wasAtBottom.current) el.scrollTop = el.scrollHeight;
  }, [p.turns.length]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    wasAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  }

  const s = p.disconnected
    ? p.reconnecting
      ? STATE_STYLE.connecting
      : { label: "Connection lost", dot: "bg-red-500", text: "text-red-400" }
    : p.state
      ? STATE_STYLE[p.state]
      : null;
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
              {p.disconnected && (
                <button
                  onClick={p.onReconnect}
                  disabled={p.reconnecting}
                  data-testid="reconnect"
                  className={`${btn.primary} px-4 py-2 text-base`}
                >
                  {p.reconnecting ? "Reconnecting…" : "Reconnect"}
                </button>
              )}
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
          <span
            className={`inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1 text-sm font-medium ${s.text}`}
            aria-live="polite"
          >
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

      <ol
        ref={listRef}
        onScroll={onScroll}
        tabIndex={0}
        aria-label="Interview transcript"
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-6 pb-4"
      >
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
        {p.turns.map((t) => {
          const student = t.speaker === "student";
          return (
            <li
              key={t.id}
              className={`max-w-[88%] rounded-[22px] px-4 py-3 text-[15px] leading-relaxed ${
                student ? "self-end bg-[#332C29] text-zinc-100" : "self-start bg-maroon text-[#FFF4F6]"
              }`}
            >
              <div
                className={`mb-1 text-[10.5px] font-bold uppercase tracking-[0.08em] ${
                  student ? "text-zinc-400" : "text-[#F2C9D2]"
                }`}
              >
                {student ? "You" : "Interviewer"} · {t.id}
              </div>
              {t.text}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
