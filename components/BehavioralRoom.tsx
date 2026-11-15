"use client";

import type { ComponentProps } from "react";
import type { LiveState, TranscriptTurn } from "@/lib/contract";
import { VoicePanel } from "./VoicePanel";
import { Wordmark } from "./Logo";
import { btn } from "./ui/buttons";

type VoiceProps = ComponentProps<typeof VoicePanel>;

interface Props {
  voice: VoiceProps;
  attemptNumber: number;
  // Shown under the title when the interview was tailored (confirmed focus only).
  focusLabel?: string;
  onFinish: () => void;
}

// Whose turn it is, in words, from the live state.
function turnLabel(connected: boolean, state: LiveState | null, disconnected: boolean, micOn: boolean) {
  if (disconnected) return { text: "Connection lost — use Reconnect", tone: "text-red-300" };
  if (!connected) return { text: "Start the interview when you're ready", tone: "text-zinc-300" };
  if (state === "connecting") return { text: "Connecting…", tone: "text-amber-300" };
  if (state === "speaking") return { text: "Interviewer is speaking", tone: "text-brand-coral" };
  if (!micOn) return { text: "Muted — unmute to answer", tone: "text-zinc-300" };
  return { text: "Your turn — answer out loud", tone: "text-emerald-300" };
}

// A behavioral round: no code, editor, tests, or runs. The question, whose turn
// it is, the voice controls and transcript, and Finish.
export function BehavioralRoom({ voice, attemptNumber, focusLabel, onFinish }: Props) {
  const question = [...voice.turns].reverse().find((t: TranscriptTurn) => t.speaker === "interviewer");
  const turn = turnLabel(voice.connected, voice.state, voice.disconnected, voice.micOn);
  const studentTurns = voice.turns.filter((t) => t.speaker === "student").length;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100" data-testid="behavioral-room">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-4 py-3 sm:px-6">
        <Wordmark size={26} />
        <span className="text-base text-zinc-400">
          Behavioral round{attemptNumber > 1 && ` · Attempt ${attemptNumber}`}
        </span>
        <span className="ml-auto text-sm text-zinc-500" data-testid="session-stats">
          {voice.turns.length} turns · {studentTurns} answers
        </span>
        <button onClick={onFinish} className={`${btn.secondary} px-5 py-2 text-base`}>
          Finish
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        {focusLabel && (
          <p className="text-sm text-zinc-400" data-testid="behavioral-focus">
            Tailored: {focusLabel}
          </p>
        )}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5" aria-live="polite">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Current question</div>
          <p className="mt-2 text-xl leading-snug text-zinc-50" data-testid="current-question">
            {question ? question.text : "The interviewer will ask an engineering-story question when you start."}
          </p>
          <p className={`mt-4 text-base font-semibold ${turn.tone}`} data-testid="whose-turn">
            {turn.text}
          </p>
        </section>
        <div className="overflow-hidden rounded-2xl border border-zinc-800">
          <VoicePanel {...voice} />
        </div>
        <p className="text-sm text-zinc-500">
          Tip: describe the situation, what you personally did and why, and how you knew it worked. You can finish at any
          time.
        </p>
      </main>
    </div>
  );
}
