"use client";

import { useState } from "react";
import { Wordmark } from "./Logo";
import { EMPTY_JOB, type CandidateProfile, type JobInfo, type ResumeImage } from "./landing/profile";
import { BentoGrid } from "./landing/BentoGrid";
import { writeSetupSeed } from "./landing/setupSeed";
import { studio, studioBtn, studioBtnSm } from "./landing/studioUi";
import { LiveDemoPanel } from "./landing/LiveDemoPanel";
import { RolePresets } from "./landing/RolePresets";
import { CompanyRail } from "./landing/CompanyRail";
import type { BehavioralContext } from "@/lib/contract";

export type MicStatus = "unchecked" | "checking" | "granted" | "denied" | "unsupported";
export type PracticeMode = "coding" | "behavioral" | "full-mock";

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
  // profile: local profile with optional job/resume info
  // mode: "coding" | "behavioral" | "full-mock"
  // context: confirmed behavioral personalization from TailorPanel
  onStart: (profile: CandidateProfile, mode: PracticeMode, context?: BehavioralContext) => void;
  // Primary action: open "What are you applying for?" (application-first flow).
  // Optional so the screen still works standalone (then it scrolls to the modes).
  onApply?: () => void;
}

export function StartScreen({ micStatus, onMicStatus, onStart, onApply }: Props) {
  const [starting, setStarting] = useState(false);
  const [resume] = useState<ResumeImage[]>([]);
  const [job, setJob] = useState<JobInfo>(EMPTY_JOB);
  // No tailoring on the homepage any more; behavioral context comes from setup.
  const context: BehavioralContext | undefined = undefined;

  async function testMic() {
    onMicStatus("checking");
    onMicStatus(await checkMicrophone());
  }

  // Check the mic on the way in if unchecked, but never block on it.
  async function start(mode: PracticeMode = "coding", ctx?: BehavioralContext) {
    setStarting(true);
    if (micStatus === "unchecked") {
      onMicStatus("checking");
      onMicStatus(await checkMicrophone());
    }
    const chosenContext = mode === "behavioral" || mode === "full-mock" ? (ctx ?? context) : undefined;
    onStart({ resume, job }, mode, chosenContext);
  }

  const msg = micStatus === "unchecked" ? null : MIC_MESSAGE[micStatus];

  // The setup screen's draft lives outside this component, so a preset picked
  // here is handed over for this tab only (components/landing/setupSeed.ts).
  function buildInterview() {
    if (job.role.trim() || job.company.trim()) writeSetupSeed(job);
    onApply?.();
  }

  return (
    <div className={studio.page}>
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 pt-6 sm:px-8 lg:px-10">
        <Wordmark size={28} tone="dark" />
        <span className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] text-zinc-300 sm:inline-flex">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
          No sign-up · Python in your browser · Free
        </span>
      </header>

      <main className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        {/* Hero */}
        <section className="grid items-center gap-10 pb-14 pt-10 lg:grid-cols-[46fr_54fr] lg:gap-12 lg:pt-16">
          <div className="flex min-w-0 flex-col items-start">
            <span className={studio.eyebrow}>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]" />
              Live voice interview
            </span>

            <h1 className="mt-6 font-brand text-[40px] font-bold leading-[1.06] tracking-[-0.02em] text-zinc-50 sm:text-[52px]">
              It asks you
              <br />
              the{" "}
              <span className="whitespace-nowrap bg-gradient-to-r from-[#FB7185] to-[#F43F5E] bg-clip-text text-transparent [filter:drop-shadow(0_0_18px_rgba(244,63,94,0.45))]">
                follow-up
              </span>
              <br />
              question.
            </h1>

            <p className="mt-6 max-w-[30rem] text-[17px] leading-relaxed text-zinc-300">
              Not a grader. An interviewer that hears your reasoning, reads the code you just ran, and pushes back when the two
              disagree.
            </p>

            <RolePresets job={job} onPick={setJob} tone="hero" className="mt-8 w-full" />

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {onApply ? (
                <button type="button" onClick={buildInterview} data-testid="hero-start-practice" className={`${studioBtn.primary} min-w-52`}>
                  Build My Interview <span aria-hidden>→</span>
                </button>
              ) : (
                <a href="#bento-heading" data-testid="hero-start-practice" className={`${studioBtn.primary} min-w-52`}>
                  Build My Interview <span aria-hidden>→</span>
                </a>
              )}
            </div>

            {/* Quick standalone rounds (no plan). */}
            <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Quick rounds without a plan">
              <span className="mr-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">Quick round</span>
              <button type="button" onClick={() => start("coding")} disabled={starting} data-testid="start-coding" className={studioBtnSm.secondary}>
                Technical coding
              </button>
              <button type="button" onClick={() => start("behavioral")} disabled={starting} data-testid="start-behavioral" className={studioBtnSm.secondary}>
                Behavioral
              </button>
              <button type="button" onClick={() => start("full-mock")} disabled={starting} data-testid="start-full-mock" className={studioBtnSm.secondary}>
                Full mock
              </button>
              {/* Hooks for scripts that start a round directly. */}
              <button type="button" onClick={() => start("coding")} disabled={starting} data-testid="start-practice" className="sr-only" tabIndex={-1}>
                Start a coding round now
              </button>
            </div>
          </div>

          <div className="min-w-0">
            <LiveDemoPanel />
          </div>
        </section>

        <CompanyRail />

        <BentoGrid onTryVoice={() => start("behavioral")} disabled={starting} />
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-zinc-400 sm:px-8 lg:px-10">
          <span className="flex items-center gap-3">
            <Wordmark size={20} tone="dark" />
            <span>Built for Hack the Nest 2026.</span>
          </span>
          <span className="flex min-h-[2rem] items-center">
            {msg ? (
              <span className={`flex items-center gap-2 ${msg.tone}`} role="status" data-testid="mic-status">
                <span aria-hidden className="font-bold">
                  {msg.icon}
                </span>
                <span>{msg.text}</span>
              </span>
            ) : (
              <button type="button" onClick={testMic} className="text-zinc-300 underline-offset-4 hover:text-white hover:underline">
                Test my microphone
              </button>
            )}
          </span>
        </div>
      </footer>
    </div>
  );
}
