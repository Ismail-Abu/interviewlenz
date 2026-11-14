"use client";

import { useState } from "react";
import { Wordmark } from "./Logo";

export type MicStatus = "unchecked" | "checking" | "granted" | "denied" | "unsupported";

// Ask for the microphone once, then release it right away. Never throws.
export async function checkMicrophone(): Promise<MicStatus> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch {
    return "denied";
  }
}

const MIC_MESSAGE: Record<Exclude<MicStatus, "unchecked">, { icon: string; text: string; tone: string }> = {
  checking: { icon: "…", text: "Checking your microphone…", tone: "text-zinc-300" },
  granted: { icon: "✓", text: "Microphone ready.", tone: "text-emerald-400" },
  denied: {
    icon: "!",
    text: "Microphone access was blocked. You can still practice: the interviewer will run in scripted mode. To talk out loud, allow the mic from your browser's address bar and reload.",
    tone: "text-amber-300",
  },
  unsupported: {
    icon: "!",
    text: "This browser can't use a microphone here (it needs HTTPS or localhost). You can still practice in scripted mode.",
    tone: "text-amber-300",
  },
};

interface Props {
  micStatus: MicStatus;
  onMicStatus: (s: MicStatus) => void;
  onStart: () => void;
}

export function StartScreen({ micStatus, onMicStatus, onStart }: Props) {
  const [starting, setStarting] = useState(false);

  async function testMic() {
    onMicStatus("checking");
    onMicStatus(await checkMicrophone());
  }

  // Check the mic on the way in if it hasn't been checked, but never block on it.
  async function start() {
    setStarting(true);
    if (micStatus === "unchecked") {
      onMicStatus("checking");
      onMicStatus(await checkMicrophone());
    }
    onStart();
  }

  const msg = micStatus === "unchecked" ? null : MIC_MESSAGE[micStatus];

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <main className="flex w-full max-w-2xl flex-col items-center text-center">
        <h1>
          <Wordmark size={84} tagline />
        </h1>
        <p className="mt-10 text-xl text-zinc-200">A coding interview that listens to how you explain your code</p>
        <p className="mt-3 max-w-xl text-base text-zinc-500">
          Solve a Python problem, talk through your reasoning, and get questions grounded in what you actually wrote.
        </p>

        <button
          onClick={start}
          disabled={starting}
          className="mt-10 rounded-xl bg-brand px-8 py-3.5 text-lg font-semibold text-white shadow-lg shadow-black/40 transition-colors hover:bg-brand-hover disabled:opacity-70"
        >
          {starting ? "Starting…" : "Start practice"}
        </button>

        <div className="mt-8 flex min-h-[4.5rem] flex-col items-center gap-2">
          {msg ? (
            <p className={`flex max-w-xl items-start gap-2 text-base ${msg.tone}`} role="status" data-testid="mic-status">
              <span aria-hidden className="font-bold">
                {msg.icon}
              </span>
              <span>{msg.text}</span>
            </p>
          ) : (
            <button onClick={testMic} className="text-base text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline">
              Test my microphone
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
