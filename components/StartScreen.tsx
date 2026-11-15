"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ResumeDrop } from "./landing/ResumeDrop";
import { JobForm } from "./landing/JobForm";
import { TailorPanel } from "./landing/TailorPanel";
import { EMPTY_JOB, hasJob, type CandidateProfile, type JobInfo, type ResumeImage } from "./landing/profile";
import { LiveDemoPanel } from "./landing/LiveDemoPanel";
import { RolePresets } from "./landing/RolePresets";
import { CompanyRail } from "./landing/CompanyRail";
import { NavAuth } from "./NavAuth";
import { SessionHistory } from "./SessionHistory";
import type { BehavioralContext } from "@/lib/contract";

export type MicStatus = "unchecked" | "checking" | "granted" | "denied" | "unsupported";
export type PracticeMode = "coding" | "behavioral" | "full-mock";

// Ask for the microphone once, then release it right away. Never throws.
export async function checkMicrophone(): Promise<MicStatus> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    if (typeof navigator.permissions?.query === "function") {
      try {
        const queryRes = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (queryRes.state === "granted") return "granted";
        if (queryRes.state === "denied") return "denied";
      } catch {
        // Fall back to getUserMedia if permissions.query throws (e.g. Safari)
      }
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch {
    return "denied";
  }
}

const MIC_MESSAGE: Record<Exclude<MicStatus, "unchecked">, { icon: string; text: string; tone: string }> = {
  checking: { icon: "…", text: "Checking your microphone…", tone: "text-muted-foreground" },
  granted: { icon: "✓", text: "Microphone ready.", tone: "text-emerald-600" },
  denied: {
    icon: "!",
    text: "Microphone access was blocked. You can still practice: the interviewer will run in scripted mode. To talk out loud, allow the mic from your browser's address bar and reload.",
    tone: "text-amber-700",
  },
  unsupported: {
    icon: "!",
    text: "This browser can't use a microphone here (it needs HTTPS or localhost). You can still practice in scripted mode.",
    tone: "text-amber-700",
  },
};

interface Props {
  micStatus: MicStatus;
  onMicStatus: (s: MicStatus) => void;
  onStart: (profile: CandidateProfile, mode: PracticeMode, context?: BehavioralContext) => void;
  onApply?: () => void;
}

export function StartScreen({ micStatus, onMicStatus, onStart }: Props) {
  const [starting, setStarting] = useState(false);
  const [selectedMode, setSelectedMode] = useState<PracticeMode>("coding");
  const [resume, setResume] = useState<ResumeImage[]>([]);
  const [job, setJob] = useState<JobInfo>(EMPTY_JOB);
  const [context, setContext] = useState<BehavioralContext | undefined>(undefined);

  // Proactively request microphone permission on page load so candidates never get interrupted during navigation
  useEffect(() => {
    if (micStatus === "unchecked") {
      let active = true;
      onMicStatus("checking");
      void checkMicrophone().then((status) => {
        if (active) onMicStatus(status);
      });
      return () => {
        active = false;
      };
    }
  }, [micStatus, onMicStatus]);

  const provided = resume.length > 0 || hasJob(job);

  async function testMic() {
    onMicStatus("checking");
    onMicStatus(await checkMicrophone());
  }

  // Check the mic on the way in if unchecked, but never block on it.
  async function start(mode: PracticeMode = selectedMode, ctx?: BehavioralContext) {
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
    <div className="min-h-screen bg-background text-foreground [color-scheme:light]">
      {/* Top Navbar */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-8">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link
              className="inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
              aria-label="Interviewlenz home"
              href="/"
            >
              <svg
                className="shrink-0 text-primary h-[22px] w-5"
                viewBox="0 0 356 394"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M170 0a170 170 0 1 0 0 340a170 170 0 1 0 0-340zm0 39a131 131 0 1 1 0 262a131 131 0 1 1 0-262z"
                />
                <path
                  d="M232 316 L324 246 L352 383 Q353 391 345 388 Z"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinejoin="round"
                />
                <rect x="83" y="136" width="27" height="66" rx="13.5" />
                <rect x="130" y="98" width="27" height="139" rx="13.5" />
                <rect x="177" y="121" width="27" height="96" rx="13.5" />
                <rect x="223" y="146" width="27" height="48" rx="13.5" />
              </svg>
              <span className="text-[17px] font-semibold tracking-tight text-foreground font-brand">
                Interviewlenz
              </span>
            </Link>

            <span className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  micStatus === "granted"
                    ? "bg-success"
                    : micStatus === "checking"
                    ? "bg-amber-500 animate-pulse"
                    : micStatus === "denied"
                    ? "bg-rose-500"
                    : "bg-success live-dot"
                }`}
                aria-hidden="true"
              />
              {micStatus === "checking"
                ? "Connecting Microphone…"
                : micStatus === "granted"
                ? "Microphone Connected"
                : micStatus === "denied"
                ? "Mic Blocked (Scripted Mode)"
                : "Live Voice Engine Ready"}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <NavAuth />
            <button
              type="button"
              onClick={() => start(selectedMode)}
              disabled={starting}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground shadow-cta hover:bg-primary-hover active:translate-y-px rounded-md text-xs h-9 px-3 sm:px-4"
            >
              Start Interview
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-5 pb-10 pt-6 sm:px-8 sm:pb-14 sm:pt-16 lg:pb-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground sm:hidden">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                micStatus === "granted"
                  ? "bg-success"
                  : micStatus === "checking"
                  ? "bg-amber-500 animate-pulse"
                  : micStatus === "denied"
                  ? "bg-rose-500"
                  : "bg-success live-dot"
              }`}
              aria-hidden="true"
            />
            {micStatus === "checking"
              ? "Connecting Microphone…"
              : micStatus === "granted"
              ? "Microphone Connected"
              : micStatus === "denied"
              ? "Mic Blocked (Scripted Mode)"
              : "Live Voice Engine Ready"}
          </span>

          <h1 className="mt-4 max-w-3xl text-[36px] font-semibold leading-[1.04] tracking-[-0.035em] text-foreground sm:mt-0 sm:text-6xl lg:text-[72px]">
            The mock interview that actually{" "}
            <span className="font-display text-[1.08em] font-normal italic tracking-[-0.01em]">
              listens.
            </span>
          </h1>

          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
            Practice coding and behavioral rounds with an AI interviewer that hears your reasoning out loud, evaluates
            your code, and asks realistic follow-up questions in real time.
          </p>

          <div className="mt-8 grid gap-6 lg:mt-10 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-8">
            <div className="flex flex-col gap-6 sm:gap-7 min-w-0 max-w-full">
              <RolePresets job={job} onPick={setJob} />

              <div role="radiogroup" aria-label="Interview mode" className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedMode === "coding"}
                  onClick={() => {
                    if (selectedMode === "coding") {
                      start("coding");
                    } else {
                      setSelectedMode("coding");
                    }
                  }}
                  data-testid="start-coding"
                  className={`flex flex-col justify-between gap-1.5 rounded-xl border p-3.5 text-left text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
                    selectedMode === "coding"
                      ? "border-foreground bg-background text-foreground shadow-card ring-1 ring-foreground/20"
                      : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`grid h-4 w-4 place-items-center rounded-full border shrink-0 ${
                          selectedMode === "coding" ? "border-foreground" : "border-muted-foreground/50"
                        }`}
                        aria-hidden="true"
                      >
                        {selectedMode === "coding" && <span className="h-2 w-2 rounded-full bg-foreground" />}
                      </span>
                      <span className="font-semibold text-foreground text-xs sm:text-sm">Technical Coding</span>
                    </div>
                    <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                      1 Round
                    </span>
                  </div>
                  <p className="pl-6 text-[11px] sm:text-xs text-muted-foreground leading-normal">
                    Python IDE, real test cases, and real-time voice feedback
                  </p>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedMode === "behavioral"}
                  onClick={() => {
                    if (selectedMode === "behavioral") {
                      start("behavioral");
                    } else {
                      setSelectedMode("behavioral");
                    }
                  }}
                  data-testid="start-behavioral"
                  className={`flex flex-col justify-between gap-1.5 rounded-xl border p-3.5 text-left text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
                    selectedMode === "behavioral"
                      ? "border-foreground bg-background text-foreground shadow-card ring-1 ring-foreground/20"
                      : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`grid h-4 w-4 place-items-center rounded-full border shrink-0 ${
                          selectedMode === "behavioral" ? "border-foreground" : "border-muted-foreground/50"
                        }`}
                        aria-hidden="true"
                      >
                        {selectedMode === "behavioral" && <span className="h-2 w-2 rounded-full bg-foreground" />}
                      </span>
                      <span className="font-semibold text-foreground text-xs sm:text-sm">Behavioral Deep-Dive</span>
                    </div>
                    <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                      1 Round
                    </span>
                  </div>
                  <p className="pl-6 text-[11px] sm:text-xs text-muted-foreground leading-normal">
                    STAR method live conversation tailored to your target role
                  </p>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedMode === "full-mock"}
                  onClick={() => {
                    if (selectedMode === "full-mock") {
                      start("full-mock");
                    } else {
                      setSelectedMode("full-mock");
                    }
                  }}
                  data-testid="start-full-mock"
                  className={`flex flex-col justify-between gap-1.5 rounded-xl border p-3.5 text-left text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
                    selectedMode === "full-mock"
                      ? "border-foreground bg-background text-foreground shadow-card ring-1 ring-foreground/20"
                      : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`grid h-4 w-4 place-items-center rounded-full border shrink-0 ${
                          selectedMode === "full-mock" ? "border-foreground" : "border-muted-foreground/50"
                        }`}
                        aria-hidden="true"
                      >
                        {selectedMode === "full-mock" && <span className="h-2 w-2 rounded-full bg-foreground" />}
                      </span>
                      <span className="font-semibold text-foreground text-xs sm:text-sm">Full Mock Loop</span>
                    </div>
                    <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider shrink-0">
                      2 Rounds
                    </span>
                  </div>
                  <p className="pl-6 text-[11px] sm:text-xs text-muted-foreground leading-normal">
                    Coding followed by behavioral deep-dive in one continuous session
                  </p>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => start(selectedMode)}
              disabled={starting}
              data-testid="hero-start-practice"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow-cta hover:bg-primary-hover active:translate-y-px h-12 rounded-xl px-6 text-[15px] font-semibold w-full sm:w-auto"
            >
              {selectedMode === "full-mock"
                ? "Launch Full Mock Interview (2 Rounds)"
                : selectedMode === "behavioral"
                ? "Launch Behavioral Deep-Dive"
                : "Launch Technical Coding Session"}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-arrow-right"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Proactive mic status feedback */}
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            {micStatus === "granted" && (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Microphone connected and ready for live voice interview
              </span>
            )}
            {micStatus === "checking" && (
              <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Prompting for microphone permission…
              </span>
            )}
            {micStatus === "denied" && (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                Microphone blocked — practice runs seamlessly in interactive text mode
              </span>
            )}
          </div>

          {/* Hidden helper links for browser automation / direct anchors */}
          <button
            type="button"
            onClick={() => start("coding")}
            disabled={starting}
            data-testid="start-practice"
            className="sr-only"
          >
            Start a coding round now
          </button>
          <button
            type="button"
            onClick={() => start("behavioral")}
            disabled={starting}
            data-testid="skip-behavioral"
            className="sr-only"
          >
            Start behavioral round now
          </button>
        </section>

        <SessionHistory />

        {/* Live Product Preview */}
        <section aria-label="Live product preview" className="mx-auto max-w-6xl px-5 sm:px-8">
          <LiveDemoPanel />
        </section>

        {/* Company Styles Rail */}
        <CompanyRail />

        {/* Optional Tailoring & Mic Test Section */}
        <section id="setup" className="mx-auto max-w-6xl px-5 sm:px-8 py-8 border-t border-border">
          <details className="group rounded-2xl border border-border bg-card p-5 shadow-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-foreground [&::-webkit-details-marker]:hidden">
              <span className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold">Tailor your interview (optional)</span>
                {provided && (
                  <span
                    className="rounded-full bg-muted border border-border px-3 py-0.5 text-xs font-medium text-foreground"
                    data-testid="setup-summary"
                  >
                    {resume.length > 0 ? `${resume.length} page${resume.length > 1 ? "s" : ""}` : ""}
                    {resume.length > 0 && hasJob(job) ? " · " : ""}
                    {hasJob(job) ? job.role.trim() || "job added" : ""}
                  </span>
                )}
              </span>
              <span aria-hidden className="text-xs text-muted-foreground transition-transform group-open:rotate-180">
                ▼
              </span>
            </summary>

            <div className="mt-5 flex flex-col gap-6 pt-2">
              <div className="grid gap-4 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-1 font-semibold text-foreground">For coding rounds</div>
                  <p>
                    Job details personalize your interviewer&apos;s framing and report feedback. Resume images stay local in
                    your browser.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-1 font-semibold text-foreground">For behavioral rounds</div>
                  <p>
                    Prepare interview extracts one project and one focus skill from your resume pages and listing. Review
                    and edit before starting.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-background p-4">
                  <h3 className="mb-1 text-sm font-semibold text-foreground">Your resume</h3>
                  <p className="mb-3 text-xs text-muted-foreground">Screenshots of your resume pages (up to 4 pages).</p>
                  <ResumeDrop images={resume} onChange={setResume} />
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <h3 className="mb-1 text-sm font-semibold text-foreground">Target role</h3>
                  <p className="mb-3 text-xs text-muted-foreground">Enter your target role or paste the job posting.</p>
                  <JobForm job={job} onChange={setJob} />
                </div>
              </div>

              <TailorPanel
                resume={resume}
                job={job}
                onContextChange={setContext}
                onStartGeneric={() => start("behavioral")}
              />
            </div>
          </details>

          <div className="mt-4 flex min-h-[2.5rem] items-center">
            {msg ? (
              <p
                className={`flex max-w-2xl items-center gap-2 text-xs font-medium ${msg.tone}`}
                role="status"
                data-testid="mic-status"
              >
                <span aria-hidden className="font-bold">
                  {msg.icon}
                </span>
                <span>{msg.text}</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={testMic}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
              >
                <span aria-hidden>🎙️</span>
                <span>Test my microphone</span>
              </button>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted-foreground sm:px-8">
          <span>© 2026 Interviewlenz</span>
          <span>Hack The Nest 2026</span>
        </div>
      </footer>
    </div>
  );
}
