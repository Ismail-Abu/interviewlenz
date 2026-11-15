"use client";

import type { ComponentProps } from "react";
import type { LiveState, TranscriptTurn } from "@/lib/contract";
import { VoicePanel } from "./VoicePanel";
import { WordmarkCream } from "./behavioral/WordmarkCream";

type VoiceProps = ComponentProps<typeof VoicePanel>;

interface Props {
  voice: VoiceProps;
  attemptNumber: number;
  // Shown under the title when the interview was tailored (confirmed focus only).
  focusLabel?: string;
  onFinish: () => void;
}

const SHADOW = "shadow-[0_10px_18px_-6px_rgb(90_68_50/0.13)]";

// Whose turn it is, in words, from the live state. Tones are chosen for the
// cream surface: the old coral/emerald/zinc set is too light to read on it.
function turnLabel(connected: boolean, state: LiveState | null, disconnected: boolean, micOn: boolean) {
  if (disconnected) return { text: "Connection lost — use Reconnect", dot: "bg-[#B3261E]", tone: "text-[#B3261E]" };
  if (!connected) return { text: "Start the interview when you're ready", dot: "bg-ink-muted", tone: "text-ink-muted" };
  if (state === "connecting") return { text: "Connecting…", dot: "bg-[#B07A1E] animate-pulse", tone: "text-[#B07A1E]" };
  if (state === "speaking") return { text: "Interviewer is speaking", dot: "bg-maroon animate-pulse", tone: "text-maroon" };
  if (!micOn) return { text: "Muted — unmute to answer", dot: "bg-ink-muted", tone: "text-ink-muted" };
  return { text: "Your turn — answer out loud", dot: "bg-[#2E7D4F] animate-pulse", tone: "text-[#2E7D4F]" };
}

// A behavioral round: no code, editor, tests, or runs. The question, whose turn
// it is, the voice controls and transcript, and Finish.
//
// This page is cream. It is the one in-app page with no Monaco editor, so it can
// follow the landing page without fighting the editor's dark theme. The coding
// room is untouched and stays dark. The surface is scoped to the wrapper below,
// never to <body>.
export function BehavioralRoom({ voice, attemptNumber, focusLabel, onFinish }: Props) {
  const question = [...voice.turns].reverse().find((t: TranscriptTurn) => t.speaker === "interviewer");
  const turn = turnLabel(voice.connected, voice.state, voice.disconnected, voice.micOn);
  const studentTurns = voice.turns.filter((t) => t.speaker === "student").length;

  return (
    <div
      data-surface="cream"
      className="flex min-h-screen flex-col bg-cream text-ink"
      data-testid="behavioral-room"
    >
      <div className="mx-auto w-full max-w-3xl px-4 pt-5 sm:px-6">
        <header className={`flex flex-wrap items-center gap-3 rounded-[26px] bg-cream-2 px-5 py-4 ${SHADOW}`}>
          <WordmarkCream size={26} />
          <span className="text-base text-ink-muted">
            Behavioral round{attemptNumber > 1 && ` · Attempt ${attemptNumber}`}
          </span>
          <span className="ml-auto text-sm text-ink-muted" data-testid="session-stats">
            {voice.turns.length} turns · {studentTurns} answers
          </span>
          <button
            onClick={onFinish}
            className="inline-flex items-center justify-center rounded-[18px] bg-cream-3 px-6 py-3 text-[15px] font-semibold text-maroon-deep transition-colors hover:bg-[#EFE0CA]"
          >
            Finish
          </button>
        </header>
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        {focusLabel && (
          <p className="text-sm text-ink-muted" data-testid="behavioral-focus">
            Tailored: {focusLabel}
          </p>
        )}

        <section className={`rounded-[30px] bg-cream-2 p-7 ${SHADOW}`} aria-live="polite">
          <div className="text-xs font-bold uppercase tracking-[0.1em] text-maroon">Current question</div>
          <p className="mt-3 text-[23px] font-medium leading-snug text-ink" data-testid="current-question">
            {question ? question.text : "The interviewer will ask an engineering-story question when you start."}
          </p>
          <p
            className={`mt-5 inline-flex items-center gap-2.5 rounded-full bg-cream-3 px-4 py-2 text-[15px] font-semibold ${turn.tone}`}
            data-testid="whose-turn"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${turn.dot}`} aria-hidden />
            {turn.text}
          </p>
        </section>

        {/* The voice panel is still styled for a dark surface, so it sits in the
            dark "demo panel" from the Concept C mockup rather than being forced
            onto cream. If task 2 gives VoicePanel a light tone, this wrapper can
            become cream-2 and pass tone="light". */}
        <div className={`overflow-hidden rounded-[30px] bg-panel ${SHADOW}`}>
          <VoicePanel {...voice} />
        </div>

        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          Tip: describe the situation, what you personally did and why, and how you knew it worked. You can finish at any
          time.
        </p>
      </main>
    </div>
  );
}
