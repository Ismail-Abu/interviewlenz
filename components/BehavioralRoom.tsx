"use client";

import type { ComponentProps } from "react";
import type { LiveState, TranscriptTurn } from "@/lib/contract";
import { VoicePanel } from "./VoicePanel";
import { WordmarkCream } from "./behavioral/WordmarkCream";
import { AudioVisualizer } from "./behavioral/AudioVisualizer";
import { coverBtnSm } from "./ui/buttons";

type VoiceProps = ComponentProps<typeof VoicePanel>;

interface Props {
  voice: VoiceProps;
  attemptNumber: number;
  // Shown under the title when the interview was tailored (confirmed focus only).
  focusLabel?: string;
  onFinish: () => void;
}

const SHADOW = "shadow-[0_10px_20px_-6px_rgb(90_68_50/0.14)]";

// Whose turn it is, in words, from the live state.
function turnLabel(connected: boolean, state: LiveState | null, disconnected: boolean, micOn: boolean) {
  if (disconnected) return { text: "Connection lost — click Reconnect", visualizerState: "error" as const, tone: "text-[#B3261E] bg-[#FCE8E6] border-[#F5C2BE]" };
  if (!connected) return { text: "Click Start Interview when you're ready", visualizerState: "idle" as const, tone: "text-ink-muted bg-cream-3 border-cream-line" };
  if (state === "connecting") return { text: "Connecting to interviewer…", visualizerState: "connecting" as const, tone: "text-[#B07A1E] bg-[#FEF7E0] border-[#FCE8B2]" };
  if (state === "speaking") return { text: "Interviewer is speaking…", visualizerState: "speaking" as const, tone: "text-maroon bg-[#FCE8EC] border-maroon-soft/40" };
  if (!micOn) return { text: "Muted — unmute to answer", visualizerState: "idle" as const, tone: "text-amber-800 bg-[#FEF7E0] border-[#FCE8B2]" };
  return { text: "Your turn — speak naturally out loud", visualizerState: "listening" as const, tone: "text-[#1E7E34] bg-[#E6F4EA] border-[#CEEAD6]" };
}

export function BehavioralRoom({ voice, attemptNumber, focusLabel, onFinish }: Props) {
  const question = [...voice.turns].reverse().find((t: TranscriptTurn) => t.speaker === "interviewer");
  const turn = turnLabel(voice.connected, voice.state, voice.disconnected, voice.micOn);
  const studentTurns = voice.turns.filter((t) => t.speaker === "student").length;

  return (
    <div
      data-surface="cream"
      className="flex min-h-screen flex-col bg-cream text-ink [color-scheme:light]"
      data-testid="behavioral-room"
    >
      {/* Studio Header Bar */}
      <div className="mx-auto w-full max-w-4xl px-4 pt-5 sm:px-6">
        <header className={`flex flex-wrap items-center gap-3 rounded-[26px] bg-cream-2/95 px-5 py-4 border border-cream-line/60 ${SHADOW}`}>
          <WordmarkCream size={26} />

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-maroon/10 border border-maroon/20 px-3 py-1 text-xs font-bold text-maroon">
              <span className="h-1.5 w-1.5 rounded-full bg-maroon" />
              Behavioral Deep-Dive Interview
            </span>
            {attemptNumber > 1 && (
              <span className="rounded-full bg-cream-3 px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
                Attempt {attemptNumber}
              </span>
            )}
          </div>

          <span className="ml-auto text-xs sm:text-sm font-medium text-ink-muted" data-testid="session-stats">
            {voice.turns.length} turns · {studentTurns} responses
          </span>

          <button
            type="button"
            onClick={onFinish}
            className={`${coverBtnSm.secondary} px-5 py-2 text-xs font-semibold`}
            data-testid="finish-btn"
          >
            Finish Interview
          </button>
        </header>
      </div>

      {/* Main Studio Arena */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        {/* Tailored Focus Chip */}
        {focusLabel && (
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full bg-cream-2 border border-cream-line px-3.5 py-1 text-xs font-semibold text-maroon-deep shadow-sm"
              data-testid="behavioral-focus"
            >
              <span>🎯</span>
              <span>Tailored project focus: <strong>{focusLabel}</strong></span>
            </span>
          </div>
        )}

        {/* Current Question Spotlight */}
        <section
          className={`flex flex-col rounded-[28px] bg-cream-2/95 p-7 border border-cream-line/60 ${SHADOW}`}
          aria-live="polite"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-maroon">
              Current Interviewer Question
            </span>
            <span className="rounded-full bg-cream-3 px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">
              Live Evaluation
            </span>
          </div>

          <p
            className="mt-4 font-brand text-2xl sm:text-[26px] font-bold leading-snug text-ink"
            data-testid="current-question"
          >
            {question ? question.text : "The interviewer will pose your behavioral challenge once you start."}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${turn.tone}`}
              data-testid="whose-turn"
            >
              <AudioVisualizer state={turn.visualizerState} />
              <span>{turn.text}</span>
            </div>
          </div>
        </section>

        {/* Live Audio & Transcript Studio Console */}
        <div className={`overflow-hidden rounded-[26px] bg-[#161312] border border-[#2D2623] shadow-warm-panel`}>
          <VoicePanel {...voice} />
        </div>

        {/* Interview Strategy Guidance */}
        <footer className="rounded-[20px] bg-cream-2/60 border border-cream-line/50 p-4 text-xs leading-relaxed text-ink-muted flex items-start gap-3">
          <span className="text-base text-maroon">💡</span>
          <div>
            <strong className="font-semibold text-ink">Interview Advice (STAR Method):</strong> Clearly describe the
            <strong> Situation</strong>, the <strong>Task</strong> at hand, your specific individual <strong>Actions</strong>,
            and the quantifiable <strong>Result</strong>. Click Finish whenever you have completed your responses.
          </div>
        </footer>
      </main>
    </div>
  );
}
