"use client";

import { useState } from "react";
import { Wordmark } from "./Logo";
import { ResumeDrop } from "./landing/ResumeDrop";
import { JobForm } from "./landing/JobForm";
import { TailorPanel } from "./landing/TailorPanel";
import { EMPTY_JOB, hasJob, type CandidateProfile, type JobInfo, type ResumeImage } from "./landing/profile";
import { coverBtn } from "./ui/buttons";
import { LiveDemoPanel } from "./landing/LiveDemoPanel";
import { RolePresets } from "./landing/RolePresets";
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
  checking: { icon: "…", text: "Checking your microphone…", tone: "text-ink-muted" },
  granted: { icon: "✓", text: "Microphone ready.", tone: "text-[#2f6b3f]" },
  denied: {
    icon: "!",
    text: "Microphone access was blocked. You can still practice: the interviewer will run in scripted mode. To talk out loud, allow the mic from your browser's address bar and reload.",
    tone: "text-[#7a4600]",
  },
  unsupported: {
    icon: "!",
    text: "This browser can't use a microphone here (it needs HTTPS or localhost). You can still practice in scripted mode.",
    tone: "text-[#7a4600]",
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
    // Cream is scoped to this wrapper ("beige marketing, dark app"): body and
    // the interview room keep the dark theme from globals.css.
    <div data-surface="cream" className="min-h-screen bg-cream text-ink [color-scheme:light]">
      <main className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        {/* Hero: 45 / 55 */}
        <section className="grid items-center gap-10 pb-12 pt-8 lg:grid-cols-[45fr_55fr] lg:gap-12 lg:pb-16 lg:pt-12">
          <div className="flex flex-col items-start">
            <Wordmark size={30} tone="light" />

            <span className="mt-12 inline-flex items-center gap-2.5 rounded-full bg-cream-3 px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.12em] text-maroon-deep lg:mt-16">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-maroon" />
              Studio online · Real-time voice
            </span>

            <h1 className="mt-6 font-brand text-[40px] font-bold leading-[1.08] tracking-[-0.02em] text-ink sm:text-[47px]">
              It asks you
              <br />
              the{" "}
              <span className="relative isolate whitespace-nowrap text-maroon">
                follow-up
                <span aria-hidden className="absolute inset-x-[0.12em] bottom-[0.02em] -z-10 h-[0.16em] rounded-full bg-maroon-soft/40" />
              </span>
              <br />
              question.
            </h1>

            <p className="mt-6 max-w-[29rem] text-[17px] leading-relaxed text-ink-muted">
              Not a grader. An interviewer that hears your reasoning, reads the code you just ran, and pushes back when
              the two disagree.
            </p>

            <RolePresets
              job={job}
              onPick={setJob}
              tone="hero"
              className="mt-8 w-full"
            />

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {onApply ? (
                <button type="button" onClick={onApply} data-testid="hero-start-practice" className={`${coverBtn.primary} min-w-48`}>
                  Build my interview
                </button>
              ) : (
                <a href="#practice-modes" data-testid="hero-start-practice" className={`${coverBtn.primary} min-w-48`}>
                  Build my interview
                </a>
              )}
              <button
                type="button"
                onClick={() => start("behavioral")}
                disabled={starting}
                data-testid="skip-behavioral"
                className={coverBtn.secondary}
              >
                Behavioral round <span aria-hidden>→</span>
              </button>
              {/* Hook for scripts that start a coding round directly. */}
              <button
                type="button"
                onClick={() => start("coding")}
                disabled={starting}
                data-testid="start-practice"
                className="sr-only"
              >
                Start a coding round now
              </button>
            </div>

            <ul className="mt-7 flex flex-wrap gap-2.5" aria-label="About Interviewlenz">
              {["No sign-up", "Python in your browser", "Free"].map((c) => (
                <li key={c} className="rounded-full bg-cream-3 px-5 py-2 text-sm text-ink">
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <LiveDemoPanel />
          </div>
        </section>


        {/* Practice modes */}
        <section id="practice-modes" className="scroll-mt-6 pt-16">
          <h2 className="font-brand text-[26px] font-bold tracking-tight text-ink">Choose your practice</h2>
          <p className="mt-1 text-[15px] text-ink-muted">Pick one interview, or run the full loop.</p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <ModeCard
              tag="Technical Coding Interview"
              meta="~20 mins"
              title="Technical Coding Interview"
              body="Problem solving, algorithm implementation and live reasoning. Solve a Python problem while the interviewer questions your logic, edge cases and test results."
            >
              <button
                type="button"
                onClick={() => start("coding")}
                disabled={starting}
                data-testid="start-coding"
                className={`${coverBtn.secondary} w-full`}
              >
                Start coding round
              </button>
            </ModeCard>
            <ModeCard
              tag="Behavioral Deep-Dive"
              meta="~15 mins"
              title="Behavioral Deep-Dive"
              body="Project defence and engineering trade-offs. Tell an engineering story and get live follow-ups about what you personally did and why."
            >
              <button
                type="button"
                onClick={() => start("behavioral", context)}
                disabled={starting}
                data-testid="start-behavioral"
                className={`${coverBtn.secondary} w-full`}
              >
                {context ? "Start tailored behavioral" : "Start behavioral round"}
              </button>
            </ModeCard>
            <ModeCard
              tag="Recommended"
              strong
              meta="Coding + behavioral"
              title="Full interview loop"
              body="The Technical Coding Interview, then straight into the Behavioral Deep-Dive."
              className="sm:col-span-2 lg:col-span-1"
            >
              <button
                type="button"
                onClick={() => start("full-mock", context)}
                disabled={starting}
                data-testid="start-full-mock"
                className={`${coverBtn.primary} w-full`}
              >
                Start full mock
              </button>
            </ModeCard>
          </div>
        </section>

        {/* Optional personalization */}
        <section id="setup" className="scroll-mt-6 pb-16 pt-10">
          <details className="group rounded-[26px] bg-cream-2 p-6 shadow-warm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-ink [&::-webkit-details-marker]:hidden">
              <span className="flex flex-wrap items-center gap-3">
                <span className="text-lg">Tailor your interview (optional)</span>
                {provided && (
                  <span className="rounded-full bg-cream-3 px-3 py-1 text-xs font-semibold text-maroon-deep" data-testid="setup-summary">
                    {resume.length > 0 ? `${resume.length} page${resume.length > 1 ? "s" : ""}` : ""}
                    {resume.length > 0 && hasJob(job) ? " · " : ""}
                    {hasJob(job) ? job.role.trim() || "job added" : ""}
                  </span>
                )}
              </span>
              <span aria-hidden className="text-sm text-ink-muted transition-transform group-open:rotate-180">
                ▼
              </span>
            </summary>

            <div className="mt-6 flex flex-col gap-6">
              <div className="grid gap-4 text-sm text-ink-muted sm:grid-cols-2">
                <div className="rounded-[22px] bg-white/70 p-4">
                  <div className="mb-1 font-semibold text-ink">For coding rounds</div>
                  <p>
                    Job details you enter (company, role, level, and listing) personalize your interviewer&apos;s framing and
                    report feedback. Resume screenshots stay local in your browser.
                  </p>
                </div>
                <div className="rounded-[22px] bg-white/70 p-4">
                  <div className="mb-1 font-semibold text-ink">For behavioral rounds</div>
                  <p>
                    Select <strong className="text-ink">Prepare my interview</strong> to extract one project and one focus
                    skill from your resume pages and listing. You can review and edit what the app understood before
                    starting. Skip starts immediately without analyzing anything.
                  </p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-[22px] bg-white/70 p-5">
                  <h3 className="mb-1 text-base font-semibold text-ink">Your resume</h3>
                  <p className="mb-4 text-sm text-ink-muted">Screenshots of your resume pages (up to 4 pages for tailoring).</p>
                  <ResumeDrop images={resume} onChange={setResume} />
                </div>
                <div className="rounded-[22px] bg-white/70 p-5">
                  <h3 className="mb-1 text-base font-semibold text-ink">Target role</h3>
                  <p className="mb-4 text-sm text-ink-muted">Enter your target role or paste the job posting.</p>
                  <JobForm job={job} onChange={setJob} />
                </div>
              </div>

              <TailorPanel resume={resume} job={job} onContextChange={setContext} onStartGeneric={() => start("behavioral")} />
            </div>
          </details>

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
                className="inline-flex items-center gap-2 rounded-full border border-[#D9C8B0] bg-cream-2 px-4 py-2 text-xs font-semibold text-ink-muted transition-colors hover:border-maroon-soft hover:bg-cream-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-soft"
              >
                <span aria-hidden>🎙️</span>
                <span>Test my microphone</span>
              </button>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-cream-2 py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 text-sm text-ink-muted sm:px-8 lg:px-10">
          <span className="flex items-center gap-3">
            <Wordmark size={20} tone="light" />
            <span>Built for Hack the Nest 2026.</span>
          </span>
          <span>Coding and behavioral practice for CS students</span>
        </div>
      </footer>
    </div>
  );
}

function ModeCard({
  tag,
  meta,
  title,
  body,
  strong = false,
  className = "",
  children,
}: {
  tag: string;
  meta: string;
  title: string;
  body: string;
  strong?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col justify-between rounded-[26px] p-6 shadow-warm ${strong ? "bg-white" : "bg-cream-2"} ${className}`}>
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
              strong ? "bg-maroon text-white" : "bg-cream-3 text-maroon-deep"
            }`}
          >
            {tag}
          </span>
          <span className="text-sm text-ink-muted">{meta}</span>
        </div>
        <h3 className="font-brand text-xl font-bold text-ink">{title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{body}</p>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
