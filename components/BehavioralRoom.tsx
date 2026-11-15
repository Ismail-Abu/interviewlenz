"use client";

import type { ComponentProps } from "react";
import type { LiveState, TranscriptTurn } from "@/lib/contract";
import { VoicePanel } from "./VoicePanel";
import { Wordmark } from "./Logo";
import { AudioVisualizer, type VisualizerState } from "./behavioral/AudioVisualizer";
import { CONSOLE, PILL, PILL_BASE, SessionClock, type LiveTone } from "./behavioral/studio";

type VoiceProps = ComponentProps<typeof VoicePanel>;

interface Props {
  voice: VoiceProps;
  attemptNumber: number;
  // Shown under the title when the interview was tailored (confirmed focus only).
  focusLabel?: string;
  onFinish: () => void;
}

// Whose turn it is, in words, from the live state. The texts are relied on by
// browser checks: keep "Your turn…", "Interviewer is speaking", "Muted…".
function turnLabel(connected: boolean, state: LiveState | null, disconnected: boolean, micOn: boolean): { text: string; viz: VisualizerState; tone: LiveTone } {
  if (disconnected) return { text: "Connection lost — click Reconnect", viz: "error", tone: "lost" };
  if (!connected) return { text: "Click Start Interview when you're ready", viz: "idle", tone: "idle" };
  if (state === "connecting") return { text: "Connecting to interviewer…", viz: "connecting", tone: "connecting" };
  if (state === "speaking") return { text: "Interviewer is speaking", viz: "speaking", tone: "speaking" };
  if (!micOn) return { text: "Muted — unmute to answer", viz: "idle", tone: "muted" };
  return { text: "Your turn — speak naturally out loud", viz: "listening", tone: "listening" };
}

const STAR = [
  { k: "S", title: "Situation", hint: "Where and when, in one or two sentences.", icon: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" },
  { k: "T", title: "Task", hint: "What you specifically owned.", icon: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { k: "A", title: "Action", hint: "What you did, in first person.", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
  { k: "R", title: "Result", hint: "How you measured it.", icon: "M3 3v18h18M7 15l4-4 3 3 5-6" },
];

export function BehavioralRoom({ voice, attemptNumber, focusLabel, onFinish }: Props) {
  const question = [...voice.turns].reverse().find((t: TranscriptTurn) => t.speaker === "interviewer");
  const turn = turnLabel(voice.connected, voice.state, voice.disconnected, voice.micOn);
  const studentTurns = voice.turns.filter((t) => t.speaker === "student").length;

  return (
    <div className={`flex min-h-screen flex-col ${CONSOLE.page}`} data-testid="behavioral-room">
      <header className={`sticky top-0 z-20 ${CONSOLE.header}`}>
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <Wordmark size={26} tone="dark" />
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-950/50 px-3 py-1 text-xs font-bold text-rose-200">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]" />
            Behavioral Deep-Dive Interview
          </span>
          {attemptNumber > 1 && (
            <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-0.5 text-xs font-semibold text-zinc-300">Attempt {attemptNumber}</span>
          )}
          <span
            className="ml-auto rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-zinc-300 max-sm:sr-only"
            data-testid="session-stats"
          >
            {voice.turns.length} turns · {studentTurns} responses · <SessionClock />
          </span>
          <button type="button" onClick={onFinish} className={`${CONSOLE.finish} max-sm:ml-auto`} data-testid="finish-btn">
            Finish Interview
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        {focusLabel && (
          <span
            className="inline-flex items-center gap-2 self-start rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-1 text-xs text-zinc-300"
            data-testid="behavioral-focus"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" aria-hidden />
            Tailored focus: <strong className="font-semibold text-zinc-100">{focusLabel}</strong>
          </span>
        )}

        {/* Question spotlight */}
        <section className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#111215] p-6 shadow-2xl shadow-black/60 sm:p-8" aria-live="polite">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/70 to-transparent" />
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-full bg-rose-600/15 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-rose-300">Current question</span>
              <span className="rounded-full border border-white/[0.1] px-2.5 py-0.5 font-mono text-[11px] text-zinc-400">LIVE EVALUATION</span>
            </div>
            <p className="mt-4 font-brand text-[22px] font-bold leading-snug text-zinc-50 sm:text-[28px]" data-testid="current-question">
              {question ? question.text : "The interviewer will ask an engineering-story question when you start."}
            </p>
            <div className="mt-6">
              <span className={`${PILL_BASE} ${PILL[turn.tone]} px-3.5 py-1.5`} data-testid="whose-turn">
                <AudioVisualizer state={turn.viz} />
                <span>{turn.text}</span>
              </span>
            </div>
          </div>
        </section>

        {/* Voice + transcript console */}
        <div className={`overflow-hidden ${CONSOLE.panel}`}>
          <VoicePanel {...voice} />
        </div>

        {/* STAR coaching */}
        <footer className="rounded-[18px] border border-white/[0.08] bg-[#0F1013] p-4 sm:p-5">
          <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">Answer with STAR</p>
          <ol className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {STAR.map((s) => (
              <li key={s.k} className="flex items-start gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-rose-500/30 bg-rose-950/50 text-rose-300">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={s.icon} />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-100">{s.title}</span>
                  <span className="block text-xs leading-snug text-zinc-400">{s.hint}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-zinc-400">Select Finish Interview when you&apos;re done answering.</p>
        </footer>
      </main>
    </div>
  );
}
