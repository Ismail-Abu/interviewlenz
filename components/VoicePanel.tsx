"use client";

import { useEffect, useRef } from "react";
import type { ApiError, LiveState, TranscriptTurn } from "@/lib/contract";
import type { VoiceMode } from "./liveAdapter";
import type { MicStatus } from "./StartScreen";

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
  disconnected: boolean;
  reconnecting: boolean;
  onReconnect: () => void;
  onConnect: () => void;
  onToggleMic: () => void;
  onEnd: () => void;
}

export function VoicePanel(p: Props) {
  const listRef = useRef<HTMLDivElement>(null);
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
    <div className="border-t border-border bg-background lg:sticky lg:bottom-0" aria-label="Live voice console">
      {/* Console Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex items-center gap-[3px] h-5" aria-hidden="true">
            <span
              className="eq-bar h-full rounded-full bg-primary w-[3px]"
              style={{ animationDelay: "0s", animationDuration: "0.8s" }}
            />
            <span
              className="eq-bar h-full rounded-full bg-primary w-[3px]"
              style={{ animationDelay: "0.17s", animationDuration: "1s" }}
            />
            <span
              className="eq-bar h-full rounded-full bg-primary w-[3px]"
              style={{ animationDelay: "0.34s", animationDuration: "1.2s" }}
            />
          </span>

          <span className="text-sm font-medium text-foreground truncate" role="status">
            {p.disconnected
              ? p.reconnecting
                ? "Re-establishing connection…"
                : "Connection interrupted — click Reconnect"
              : !p.connected
              ? p.connecting
                ? "Connecting to live voice…"
                : "Interviewer ready — click Start Voice"
              : p.state === "speaking"
              ? "Interviewer is speaking…"
              : !p.micOn
              ? "Microphone muted"
              : "Interviewer listening to you explain…"}
          </span>

          {p.voiceMode === "mock" && (
            <span
              className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
              data-testid="mock-voice-badge"
            >
              MOCK VOICE{p.mockReason ? ` (${p.mockReason})` : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!p.connected ? (
            <button
              onClick={p.onConnect}
              disabled={p.connecting}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium cursor-pointer transition-all border border-border bg-background text-foreground shadow-card hover:bg-muted h-8 rounded-md px-3 text-xs"
            >
              {p.connecting ? "Connecting…" : "Start Voice"}
            </button>
          ) : (
            <>
              <button
                onClick={p.onToggleMic}
                aria-pressed={!p.micOn}
                className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium cursor-pointer transition-all border border-border bg-background text-foreground shadow-card hover:bg-muted h-8 rounded-md px-3 text-xs"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-mic"
                  aria-hidden="true"
                >
                  <path d="M12 19v3" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <rect x="9" y="2" width="6" height="13" rx="3" />
                </svg>
                {p.micOn ? "Mute" : "Unmute"}
              </button>

              <button
                onClick={p.onReconnect}
                disabled={p.reconnecting}
                data-testid="reconnect"
                className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium cursor-pointer transition-all border border-border bg-background text-foreground shadow-card hover:bg-muted h-8 rounded-md px-3 text-xs"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`lucide lucide-rotate-cw ${p.reconnecting ? "animate-spin" : ""}`}
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
                {p.reconnecting ? "Reconnecting…" : "Reconnect"}
              </button>
            </>
          )}
        </div>
      </div>

      {p.error && (
        <div className="mx-5 mb-2 rounded-lg border border-red-500/20 bg-red-50 p-2.5 text-xs text-red-700" role="alert">
          {p.error.message}
          {p.error.retryable && " — try again."}
        </div>
      )}

      {/* Transcript Log */}
      <div
        ref={listRef}
        onScroll={onScroll}
        tabIndex={0}
        aria-live="polite"
        aria-label="Transcript"
        className="flex h-52 flex-col gap-3.5 overflow-y-auto border-t border-border bg-card px-5 py-4 sm:px-6 lg:h-60"
      >
        {p.turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-muted-foreground">
            <p>
              {p.connected
                ? "The interviewer will pose the opening challenge in a moment."
                : "Discuss your thought process before writing code — just like a real interview."}
            </p>
            {micBlocked && (
              <span className="mt-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] text-amber-700">
                Microphone access blocked: interviewer running in scripted response mode.
              </span>
            )}
          </div>
        ) : (
          p.turns.map((t) => {
            const student = t.speaker === "student";
            return (
              <div key={t.id} className="flex flex-col gap-0.5 turn-in">
                <span
                  className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
                    student ? "text-foreground" : "text-primary"
                  }`}
                >
                  {student ? "You" : "Interviewer"}
                </span>
                <p className={`text-[14px] leading-relaxed ${student ? "text-muted-foreground" : "text-foreground"}`}>
                  {t.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
