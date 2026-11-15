"use client";

import { useEffect, useRef } from "react";
import type { ApiError, LiveState, TranscriptTurn } from "@/lib/contract";
import type { VoiceMode } from "./liveAdapter";
import type { MicStatus } from "./StartScreen";
import { AudioVisualizer } from "./behavioral/AudioVisualizer";
import { CONSOLE, PILL, PILL_BASE } from "./behavioral/studio";

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

  const micBlocked = p.micStatus === "denied" || p.micStatus === "unsupported";

  return (
    <section className="flex h-[20rem] shrink-0 flex-col border-t border-white/[0.08] bg-[#0E0F12] 2xl:h-[25rem]">
      {/* Studio header bar */}
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pb-2 pt-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
            {p.connected && !p.disconnected && (
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping ${p.state === "speaking" ? "bg-rose-400" : "bg-emerald-400"}`} />
            )}
            <span className={`relative h-2 w-2 rounded-full ${p.disconnected ? "bg-red-500" : p.connected ? (p.state === "speaking" ? "bg-rose-400" : "bg-emerald-400") : "bg-zinc-600"}`} />
          </span>
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-300">Live Interviewer</h2>
          {p.voiceMode === "mock" && (
            <span className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-amber-300" data-testid="mock-voice-badge">
              MOCK VOICE{p.mockReason ? ` (${p.mockReason})` : ""}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!p.connected ? (
            <button onClick={p.onConnect} disabled={p.connecting} className={`${CONSOLE.primary} px-4 py-1.5 text-xs`}>
              {p.connecting ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white" aria-hidden />
                  Connecting…
                </>
              ) : (
                "Start Interview"
              )}
            </button>
          ) : (
            <>
              {p.disconnected && (
                <button onClick={p.onReconnect} disabled={p.reconnecting} data-testid="reconnect" className={`${CONSOLE.primary} px-3.5 py-1.5 text-xs`}>
                  {p.reconnecting ? "Reconnecting…" : "Reconnect"}
                </button>
              )}
              <button
                onClick={p.onToggleMic}
                aria-pressed={p.micOn}
                className={
                  p.micOn
                    ? `${CONSOLE.ghost} px-3 py-1.5 text-xs`
                    : "inline-flex items-center gap-1.5 rounded-[12px] border border-amber-500/40 bg-amber-950/60 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-900/60"
                }
              >
                <MicIcon off={!p.micOn} />
                {p.micOn ? "Mute" : "Unmute"}
              </button>
              <button onClick={p.onEnd} className={`${CONSOLE.ghost} px-3 py-1.5 text-xs`}>
                End
              </button>
            </>
          )}
        </div>
      </header>

      {/* Live status pill */}
      <div className="flex min-h-9 items-center gap-3 px-4 sm:px-5" aria-live="polite">
        {p.disconnected ? (
          <span className={`${PILL_BASE} ${PILL.lost}`}>
            <span className="h-2 w-2 rounded-full bg-red-500" />
            {p.reconnecting ? "Re-establishing connection…" : "Connection lost — click Reconnect"}
          </span>
        ) : !p.connected ? (
          <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
            <AudioVisualizer state="idle" className="text-zinc-500" />
            Click &quot;Start Interview&quot; when ready to talk through your approach.
          </span>
        ) : p.state === "speaking" ? (
          <span className={`${PILL_BASE} ${PILL.speaking}`}>
            <AudioVisualizer state="speaking" />
            Interviewer is speaking…
          </span>
        ) : !p.micOn ? (
          <span className={`${PILL_BASE} ${PILL.muted}`}>
            <MicIcon off />
            Microphone muted — click Unmute to respond out loud
          </span>
        ) : p.state === "listening" ? (
          <span className={`${PILL_BASE} ${PILL.listening}`}>
            <AudioVisualizer state="listening" />
            <span className="motion-safe:animate-pulse">Listening to your reasoning — speak naturally</span>
          </span>
        ) : (
          <span className={`${PILL_BASE} ${PILL.idle}`}>
            <AudioVisualizer state={p.state} />
            Interview in progress
          </span>
        )}
      </div>

      {p.error && (
        <div className="mx-4 mb-2 rounded-[12px] border border-red-500/40 bg-red-950/50 px-3 py-2 text-xs text-red-200 sm:mx-5" role="alert">
          {p.error.message}
          {p.error.retryable && " — try again."}
        </div>
      )}

      {/* Transcript */}
      <ol
        ref={listRef}
        onScroll={onScroll}
        tabIndex={0}
        aria-label="Interview transcript"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 pt-1 sm:px-5"
      >
        {p.turns.length === 0 && (
          <li className="flex flex-col items-center justify-center py-6 text-center text-xs text-zinc-400">
            <p>
              {p.connected
                ? "The interviewer will pose the opening challenge in a moment."
                : "Discuss your thought process before writing code — just like a real interview."}
            </p>
            {micBlocked && (
              <span className="mt-2 rounded border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-300">
                Microphone access blocked: interviewer running in scripted response mode.
              </span>
            )}
          </li>
        )}

        {p.turns.map((t) => {
          const student = t.speaker === "student";
          return (
            <li
              key={t.id}
              className={`max-w-[88%] rounded-[18px] px-4 py-3 text-[14px] leading-relaxed ${
                student
                  ? "self-end border border-white/[0.08] bg-[#1C1D21] text-zinc-100"
                  : "self-start border border-rose-400/25 bg-gradient-to-br from-[#5A1426]/90 to-[#3A0E1A]/90 text-rose-50 shadow-[0_0_20px_-10px_rgba(244,63,94,0.6)] backdrop-blur"
              }`}
            >
              <div className={`mb-1 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider ${student ? "text-zinc-400" : "text-rose-200"}`}>
                <span>{student ? "You" : "Interviewer"}</span>
                <span className="font-mono text-[10px] opacity-80">{t.id}</span>
              </div>
              <p className="whitespace-pre-wrap">{t.text}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function MicIcon({ off = false }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}
