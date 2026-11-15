"use client";

import { useEffect, useRef } from "react";
import type { ApiError, LiveState, TranscriptTurn } from "@/lib/contract";
import type { VoiceMode } from "./liveAdapter";
import type { MicStatus } from "./StartScreen";
import { btn } from "./ui/buttons";
import { AudioVisualizer } from "./behavioral/AudioVisualizer";

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
    <section className="flex h-[20rem] shrink-0 flex-col border-t border-[#2D2623] bg-[#161312] 2xl:h-[25rem]">
      {/* Studio Header Bar */}
      <header className="flex items-center justify-between gap-3 px-5 pt-3.5 pb-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 items-center justify-center">
            <span className={`h-2 w-2 rounded-full ${p.connected ? (p.state === "speaking" ? "bg-maroon-soft animate-ping" : "bg-emerald-400") : "bg-zinc-600"}`} />
          </span>
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
            Live Interviewer
          </h2>
          {p.voiceMode === "mock" && (
            <span
              className="rounded bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-300"
              data-testid="mock-voice-badge"
            >
              MOCK VOICE{p.mockReason ? ` (${p.mockReason})` : ""}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex shrink-0 items-center gap-2">
          {!p.connected ? (
            <button
              onClick={p.onConnect}
              disabled={p.connecting}
              className={`${btn.primary} px-4 py-1.5 text-xs font-semibold shadow-sm`}
            >
              {p.connecting ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white" />
                  Connecting…
                </span>
              ) : (
                "Start Interview"
              )}
            </button>
          ) : (
            <>
              {p.disconnected && (
                <button
                  onClick={p.onReconnect}
                  disabled={p.reconnecting}
                  data-testid="reconnect"
                  className={`${btn.primary} px-3.5 py-1.5 text-xs font-semibold`}
                >
                  {p.reconnecting ? "Reconnecting…" : "Reconnect"}
                </button>
              )}
              <button
                onClick={p.onToggleMic}
                aria-pressed={p.micOn}
                className={`${p.micOn ? btn.neutral : "bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30"} px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5`}
              >
                <span>{p.micOn ? "🎙️ Mute" : "🔇 Unmute"}</span>
              </button>
              <button
                onClick={p.onEnd}
                className={`${btn.neutral} px-3 py-1.5 text-xs font-semibold`}
              >
                End
              </button>
            </>
          )}
        </div>
      </header>

      {/* Tactile Interviewer Status Row */}
      <div className="flex h-9 items-center gap-3 px-5">
        {p.disconnected ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-red-500/15 border border-red-500/30 px-3 py-1 text-xs font-semibold text-red-300">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            {p.reconnecting ? "Re-establishing connection…" : "Connection lost — click Reconnect"}
          </span>
        ) : !p.connected ? (
          <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-zinc-600" />
            Click &quot;Start Interview&quot; when ready to talk through your approach.
          </span>
        ) : p.state === "speaking" ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-maroon/25 border border-maroon/50 px-3 py-1 text-xs font-semibold text-[#FFDDE4]" aria-live="polite">
            <AudioVisualizer state="speaking" className="text-maroon-soft" />
            <span>Interviewer is speaking…</span>
          </span>
        ) : !p.micOn ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300" aria-live="polite">
            <span>🔇</span>
            <span>Microphone muted — click Unmute to respond out loud</span>
          </span>
        ) : p.state === "listening" ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-300" aria-live="polite">
            <AudioVisualizer state="listening" className="text-emerald-400" />
            <span>Listening to your reasoning — speak naturally</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-xs text-zinc-400" aria-live="polite">
            <AudioVisualizer state={p.state} />
            <span>Interview in progress</span>
          </span>
        )}
      </div>

      {/* Error Banner */}
      {p.error && (
        <div className="mx-5 mb-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300" role="alert">
          {p.error.message}
          {p.error.retryable && " — try again."}
        </div>
      )}

      {/* Transcript Turn Stream */}
      <ol
        ref={listRef}
        onScroll={onScroll}
        tabIndex={0}
        aria-label="Interview transcript"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4"
      >
        {p.turns.length === 0 && (
          <li className="flex flex-col items-center justify-center py-6 text-center text-xs text-zinc-400">
            <p>
              {p.connected
                ? "The interviewer will pose the opening challenge in a moment."
                : "Discuss your thought process before writing code — just like a real interview."}
            </p>
            {micBlocked && (
              <span className="mt-2 rounded bg-amber-400/15 border border-amber-400/30 px-2.5 py-1 text-[11px] text-amber-300">
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
              className={`max-w-[88%] rounded-[20px] px-4 py-3 text-[14px] leading-relaxed shadow-sm transition-all ${
                student
                  ? "self-end bg-[#2A221E] text-zinc-100 border border-[#3E342F]"
                  : "self-start bg-[#8B2E42] text-[#FFF4F6] border border-[#A33750]"
              }`}
            >
              <div
                className={`mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider ${
                  student ? "text-[#C7BDB7]" : "text-[#F8D2DA]"
                }`}
              >
                <span>{student ? "You" : "Interviewer"}</span>
                <span className="font-mono text-[9px] opacity-75">{t.id}</span>
              </div>
              <p className="whitespace-pre-wrap">{t.text}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
