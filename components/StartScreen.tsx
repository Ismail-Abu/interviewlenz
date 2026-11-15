"use client";

import { useState } from "react";
import { Wordmark } from "./Logo";
import { ResumeDrop } from "./landing/ResumeDrop";
import { JobForm } from "./landing/JobForm";
import { TailorPanel } from "./landing/TailorPanel";
import { EMPTY_JOB, hasJob, type CandidateProfile, type JobInfo, type ResumeImage } from "./landing/profile";
import { btn } from "./ui/buttons";
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
}

export function StartScreen({ micStatus, onMicStatus, onStart }: Props) {
  const [starting, setStarting] = useState(false);
  const [resume, setResume] = useState<ResumeImage[]>([]);
  const [job, setJob] = useState<JobInfo>(EMPTY_JOB);
  const [context, setContext] = useState<BehavioralContext | undefined>(undefined);

  const provided = resume.length > 0 || hasJob(job);

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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <Wordmark size={28} />
          <div className="ml-auto flex items-center gap-4">
            <a href="#practice-modes" className="text-sm text-zinc-400 hover:text-zinc-100">
              Practice modes
            </a>
            <a href="#setup" className="text-sm text-zinc-400 hover:text-zinc-100">
              Tailor interview
            </a>
            <button
              onClick={() => start("full-mock")}
              disabled={starting}
              className={`${btn.primary} px-4 py-2 text-sm`}
            >
              Start full mock
            </button>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        {/* Hero Section */}
        <section className="flex flex-col items-start gap-4 pb-8">
          <span className="rounded-full border border-brand-coral/40 bg-brand-coral/10 px-3 py-1 text-sm font-medium text-brand-coral">
            Mock interviews for CS students
          </span>
          <h1 className="max-w-3xl font-brand text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
            A coding and behavioral interview that <span className="text-brand-coral">listens</span>
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-zinc-300">
            The mock interviewer that asks follow-ups about the code you write or the experience you describe.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="#practice-modes"
              data-testid="hero-start-practice"
              className={`${btn.primary} rounded-xl px-7 py-3 text-lg font-semibold`}
            >
              Start practice
            </a>
            {/* Backward-compatibility hook for automated scripts expecting direct start button */}
            <button
              type="button"
              onClick={() => start("coding")}
              disabled={starting}
              data-testid="start-practice"
              className="sr-only"
            >
              Start practice direct
            </button>
            <button
              type="button"
              onClick={() => start("behavioral")}
              disabled={starting}
              data-testid="skip-behavioral"
              className="sr-only"
            >
              Skip to behavioral
            </button>
          </div>
        </section>

        {/* Practice Mode Choice Cards (Fits within first viewport on 1366x768) */}
        <section id="practice-modes" className="scroll-mt-20 py-4">
          <div className="mb-4">
            <h2 className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">Choose your practice</h2>
            <p className="text-sm text-zinc-400">Select a standalone round or complete a full interview loop.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* 1. Coding Round */}
            <div className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-zinc-700">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded bg-brand-coral/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-coral">
                    Round 1
                  </span>
                  <span className="text-xs text-zinc-500">~20 mins</span>
                </div>
                <h3 className="text-xl font-bold text-zinc-100">Coding Practice</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Solve a Python problem while an interviewer questions your logic, edge cases, and test results.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => start("coding")}
                  disabled={starting}
                  data-testid="start-coding"
                  className={`${btn.secondary} w-full justify-center rounded-xl py-2.5 text-base font-semibold`}
                >
                  Start coding round
                </button>
              </div>
            </div>

            {/* 2. Behavioral Round */}
            <div className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-zinc-700">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded bg-emerald-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Round 2
                  </span>
                  <span className="text-xs text-zinc-500">~15 mins</span>
                </div>
                <h3 className="text-xl font-bold text-zinc-100">Behavioral Practice</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Answer engineering-story questions and live follow-ups about your personal contributions and technical decisions.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => start("behavioral", context)}
                  disabled={starting}
                  data-testid="start-behavioral"
                  className={`${btn.secondary} w-full justify-center rounded-xl py-2.5 text-base font-semibold`}
                >
                  {context ? "Start tailored behavioral" : "Start behavioral round"}
                </button>
              </div>
            </div>

            {/* 3. Full Mock */}
            <div className="flex flex-col justify-between rounded-2xl border border-brand-coral/30 bg-gradient-to-b from-brand-coral/10 via-zinc-900/50 to-zinc-900/80 p-6 sm:col-span-2 lg:col-span-1">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded bg-brand-coral px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-950">
                    Recommended
                  </span>
                  <span className="text-xs text-zinc-400">Coding + Behavioral</span>
                </div>
                <h3 className="text-xl font-bold text-zinc-100">Full Mock Interview</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  A complete 2-round interview: solve the coding problem, then transition directly into the behavioral round.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-brand-coral/20">
                <button
                  type="button"
                  onClick={() => start("full-mock", context)}
                  disabled={starting}
                  data-testid="start-full-mock"
                  className={`${btn.primary} w-full justify-center rounded-xl py-2.5 text-base font-semibold`}
                >
                  Start full mock
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Collapsed Optional Personalization */}
        <section id="setup" className="scroll-mt-20 py-8">
          <details className="group rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 transition-colors open:bg-zinc-900/50">
            <summary className="flex cursor-pointer items-center justify-between font-semibold text-zinc-200 hover:text-zinc-100">
              <div className="flex items-center gap-3">
                <span className="text-lg">Tailor your interview (optional)</span>
                {provided && (
                  <span className="rounded-full bg-brand-coral/15 px-2.5 py-0.5 text-xs text-brand-coral font-medium" data-testid="setup-summary">
                    {resume.length > 0 ? `${resume.length} page${resume.length > 1 ? "s" : ""}` : ""}
                    {resume.length > 0 && hasJob(job) ? " · " : ""}
                    {hasJob(job) ? (job.role.trim() || "job added") : ""}
                  </span>
                )}
              </div>
              <span className="text-xs text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>

            <div className="mt-6 flex flex-col gap-6 pt-6 border-t border-zinc-800/80">
              {/* Specific Disclosures */}
              <div className="grid gap-4 sm:grid-cols-2 text-xs text-zinc-400">
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950 p-4">
                  <div className="font-semibold text-zinc-300 mb-1">For Coding Rounds</div>
                  <p>
                    Job details you enter (company, role, level, and listing) personalize your interviewer&apos;s framing and report feedback. Resume screenshots stay local in your browser.
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950 p-4">
                  <div className="font-semibold text-zinc-300 mb-1">For Behavioral Rounds</div>
                  <p>
                    Select <strong className="text-zinc-200">Prepare my interview</strong> to extract one project and one focus skill from your resume pages and listing. You can review and edit what the app understood before starting. Skip starts immediately without analyzing anything.
                  </p>
                </div>
              </div>

              {/* Upload & Form inputs */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                  <h3 className="mb-1 text-base font-semibold text-zinc-200">Your resume</h3>
                  <p className="mb-4 text-xs text-zinc-500">Screenshots of your resume pages (up to 4 pages for tailoring).</p>
                  <ResumeDrop images={resume} onChange={setResume} />
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                  <h3 className="mb-1 text-base font-semibold text-zinc-200">Target role</h3>
                  <p className="mb-4 text-xs text-zinc-500">Enter your target role or paste the job posting.</p>
                  <JobForm job={job} onChange={setJob} />
                </div>
              </div>

              {/* Tailoring Preparation for Behavioral */}
              <TailorPanel
                resume={resume}
                job={job}
                onContextChange={setContext}
                onStartGeneric={() => start("behavioral")}
              />
            </div>
          </details>

          {/* Microphone Status Banner */}
          <div className="mt-6 flex min-h-[2.5rem] items-center">
            {msg ? (
              <p className={`flex max-w-2xl items-center gap-2 text-sm ${msg.tone}`} role="status" data-testid="mic-status">
                <span aria-hidden className="font-bold">
                  {msg.icon}
                </span>
                <span>{msg.text}</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={testMic}
                className="text-xs text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline"
              >
                Test my microphone
              </button>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-900 bg-zinc-950 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <Wordmark size={20} />
            <span>Built for Hack the Nest 2026.</span>
          </div>
          <span>Coding + Behavioral practice for CS students</span>
        </div>
      </footer>
    </div>
  );
}
