"use client";

import type { ComponentProps } from "react";
import type { LiveState, TranscriptTurn } from "@/lib/contract";
import { ReadAloud } from "./ReadAloud";
import { VoicePanel } from "./VoicePanel";
import { Wordmark } from "./Logo";
import { AudioVisualizer } from "./behavioral/AudioVisualizer";
import { FINAL_WARN_AT_MS, WARN_AT_MS, describeClock, formatClock } from "./roundClock";

type VoiceProps = ComponentProps<typeof VoicePanel>;

interface Props {
  voice: VoiceProps;
  attemptNumber: number;
  // Shown under the title when the interview was tailored (confirmed focus only).
  focusLabel?: string;
  onFinish: () => void;
  // Countdown for this attempt. It starts with the interview and finishes the
  // round at zero (ProblemRoom owns the clock and the auto-finish).
  clock: { started: boolean; elapsedMs: number; limitMs: number };
}

function Countdown({ clock }: { clock: Props["clock"] }) {
  const left = Math.max(0, clock.limitMs - clock.elapsedMs);
  const tone = !clock.started
    ? "border-border bg-card text-muted-foreground"
    : left <= FINAL_WARN_AT_MS
      ? "border-red-200 bg-red-50 text-red-700"
      : left <= WARN_AT_MS
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-border bg-card text-foreground";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 font-mono text-sm font-semibold tabular-nums ${tone}`}
      data-testid="round-clock"
      role="timer"
      aria-label={clock.started ? `${describeClock(left)} left of ${describeClock(clock.limitMs)}` : `${describeClock(clock.limitMs)} limit, starts with the interview`}
    >
      <span aria-hidden="true">{clock.started ? `${formatClock(left)} left` : `${formatClock(clock.limitMs)} limit`}</span>
    </span>
  );
}

// Whose turn it is, in words, from the live state.
function turnLabel(connected: boolean, state: LiveState | null, disconnected: boolean, micOn: boolean) {
  if (disconnected) return { text: "Connection lost — click Reconnect", visualizerState: "error" as const, tone: "text-red-700 bg-red-50 border-red-200" };
  if (!connected) return { text: "Click Start Voice when ready", visualizerState: "idle" as const, tone: "text-muted-foreground bg-muted border-border" };
  if (state === "connecting") return { text: "Connecting to interviewer…", visualizerState: "connecting" as const, tone: "text-amber-700 bg-amber-50 border-amber-200" };
  if (state === "speaking") return { text: "Interviewer is speaking…", visualizerState: "speaking" as const, tone: "text-primary bg-primary-soft border-primary/20" };
  if (!micOn) return { text: "Muted — unmute to answer", visualizerState: "idle" as const, tone: "text-amber-700 bg-amber-50 border-amber-200" };
  return { text: "Your turn — speak naturally out loud", visualizerState: "listening" as const, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
}

export function BehavioralRoom({ voice, attemptNumber, focusLabel, onFinish, clock }: Props) {
  const left = clock.limitMs - clock.elapsedMs;
  // One message per stage, so a screen reader announces each change once.
  const warning = !clock.started
    ? null
    : left <= FINAL_WARN_AT_MS
      ? "Less than a minute left. Wrap up your answer; the round ends automatically at 0:00."
      : left <= WARN_AT_MS
        ? "Two minutes left. Start bringing your answer to its result."
        : null;
  const question = [...voice.turns].reverse().find((t: TranscriptTurn) => t.speaker === "interviewer");
  const turn = turnLabel(voice.connected, voice.state, voice.disconnected, voice.micOn);
  const studentTurns = voice.turns.filter((t) => t.speaker === "student").length;

  return (
    <div
      className="flex min-h-screen flex-col bg-background text-foreground [color-scheme:light]"
      data-testid="behavioral-room"
    >
      {/* Header Bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Wordmark size={22} tone="light" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-0.5 text-xs font-semibold text-foreground max-sm:hidden">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Behavioral Deep-Dive Interview
            </span>
            {attemptNumber > 1 && (
              <span className="rounded-full bg-muted border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Attempt {attemptNumber}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Countdown clock={clock} />
            <span className="text-xs text-muted-foreground max-sm:sr-only" data-testid="session-stats">
              {voice.turns.length} turns · {studentTurns} responses
            </span>

            <button
              type="button"
              onClick={onFinish}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium cursor-pointer transition-all bg-primary text-primary-foreground shadow-cta hover:bg-primary-hover active:translate-y-px py-2 h-9 px-4"
              data-testid="finish-btn"
            >
              <span className="sm:hidden">Finish</span>
              <span className="hidden sm:inline">Finish Interview</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Arena */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <div role="status" aria-live="polite">
          {warning && (
            <p
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                left <= FINAL_WARN_AT_MS ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
              data-testid="time-warning"
            >
              {warning}
            </p>
          )}
        </div>

        {/* Tailored Focus Chip */}
        {focusLabel && (
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1 text-xs font-semibold text-primary shadow-sm"
              data-testid="behavioral-focus"
            >
              <span>🎯</span>
              <span>
                Tailored project focus: <strong>{focusLabel}</strong>
              </span>
            </span>
          </div>
        )}

        {/* Current Question Spotlight */}
        <section
          className="flex flex-col rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-card"
          aria-live="polite"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Current Interviewer Question
            </span>
            <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              Live Evaluation
            </span>
          </div>

          <p
            className="mt-4 font-brand text-2xl sm:text-[26px] font-semibold leading-snug text-foreground"
            data-testid="current-question"
          >
            {question ? question.text : "The interviewer will pose your behavioral challenge once you start."}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${turn.tone}`}
              data-testid="whose-turn"
            >
              <AudioVisualizer state={turn.visualizerState} />
              <span>{turn.text}</span>
            </div>
            {question && voice.state !== "speaking" && (!voice.micOn || !voice.connected) &&
              <ReadAloud key={question.id + question.text} text={question.text} label="Play question" />}
            {question && voice.connected && voice.micOn && voice.state !== "speaking" &&
              <span className="text-xs text-muted-foreground">Mute your mic to replay the question.</span>}
          </div>
        </section>

        {/* Live Audio & Transcript Console */}
        <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-lift">
          <VoicePanel {...voice} />
        </div>

        {/* Interview Strategy Guidance */}
        <footer className="rounded-xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground flex items-start gap-3">
          <span className="text-base text-primary">💡</span>
          <div>
            <strong className="font-semibold text-foreground">Interview Advice (STAR Method):</strong> Clearly describe
            the <strong>Situation</strong>, the <strong>Task</strong> at hand, your specific individual{" "}
            <strong>Actions</strong>, and the quantifiable <strong>Result</strong>. Click Finish whenever you have
            completed your responses. You have {formatClock(clock.limitMs)} once the interview starts; the round ends and is
            scored automatically when time runs out.
          </div>
        </footer>
      </main>
    </div>
  );
}
