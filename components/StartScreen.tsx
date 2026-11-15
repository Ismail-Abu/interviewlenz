"use client";

import { useState } from "react";
import { Wordmark } from "./Logo";
import { ResumeDrop } from "./landing/ResumeDrop";
import { JobForm } from "./landing/JobForm";
import { EMPTY_JOB, hasJob, previewLoop, type CandidateProfile, type JobInfo, type ResumeImage } from "./landing/profile";
import { btn } from "./ui/buttons";
import type { RoundType } from "@/lib/contract";

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
  // The profile stays in the browser; ProblemRoom only displays it.
  onStart: (profile: CandidateProfile, round?: RoundType) => void;
}

const FEATURES = [
  {
    title: "It listens while you code",
    body: "Explain your plan out loud. The interviewer follows your words and your code, and asks about the gap between them.",
    live: true,
  },
  {
    title: "Questions grounded in your code",
    body: "Run your solution and the next question is about that exact version and its test results, not a generic script.",
    live: true,
  },
  {
    title: "A report with receipts",
    body: "Every finding links to what you said, the lines you wrote, or the test case it's about. Retry and compare attempts.",
    live: true,
  },
  {
    title: "Tailored to the job",
    body: "Paste a listing and your resume to preview the loop that employer is likely to run: rounds, types, and what good looks like.",
    live: false,
  },
];

export function StartScreen({ micStatus, onMicStatus, onStart }: Props) {
  const [starting, setStarting] = useState(false);
  const [resume, setResume] = useState<ResumeImage[]>([]);
  const [job, setJob] = useState<JobInfo>(EMPTY_JOB);

  const provided = resume.length > 0 || hasJob(job);
  const rounds = previewLoop(job);

  async function testMic() {
    onMicStatus("checking");
    onMicStatus(await checkMicrophone());
  }

  // Check the mic on the way in if it hasn't been checked, but never block on it.
  async function start(round: RoundType = "coding") {
    setStarting(true);
    if (micStatus === "unchecked") {
      onMicStatus("checking");
      onMicStatus(await checkMicrophone());
    }
    onStart({ resume, job }, round);
  }

  const msg = micStatus === "unchecked" ? null : MIC_MESSAGE[micStatus];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <Wordmark size={28} />
          <a href="#how" className="ml-auto hidden text-sm text-zinc-400 hover:text-zinc-100 sm:inline">
            How it works
          </a>
          <a
            href="#setup"
            className={`${btn.neutral} ml-auto whitespace-nowrap px-4 py-2 text-sm sm:ml-0`}
          >
            <span className="sm:hidden">Set up</span>
            <span className="hidden sm:inline">Set up my interview</span>
          </a>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 pb-16 pt-16 sm:pt-24">
          <span className="rounded-full border border-brand-coral/40 bg-brand-coral/10 px-3 py-1 text-sm font-medium text-brand-coral">
            Mock interviews for CS students
          </span>
          <h1 className="max-w-3xl font-brand text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
            A coding interview that <span className="text-brand-coral">listens</span> to how you explain your code
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-zinc-300">
            Most practice tools only grade your code after you submit it. Interviewlenz asks follow-up questions while you
            think out loud, grounded in what you actually wrote and how your tests did.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#setup"
              className={`${btn.primary} rounded-xl px-6 py-3 text-lg`}
            >
              Set up my interview
            </a>
            <button
              type="button"
              onClick={() => start("coding")}
              disabled={starting}
              className={`${btn.neutral} rounded-xl px-6 py-3 text-lg`}
            >
              Skip to a coding round
            </button>
            <button
              type="button"
              onClick={() => start("behavioral")}
              disabled={starting}
              data-testid="skip-behavioral"
              className={`${btn.neutral} rounded-xl px-6 py-3 text-lg`}
            >
              Skip to a behavioral round
            </button>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-zinc-900 bg-zinc-900/30">
          <div className="mx-auto grid max-w-6xl gap-4 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-base font-semibold text-zinc-100">{f.title}</h2>
                  {!f.live && (
                    <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-amber-300">
                      PREVIEW
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-zinc-400">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Setup */}
        <section id="setup" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16">
          <h2 className="font-brand text-3xl font-bold tracking-tight">Set up your interview</h2>
          <p className="mt-2 max-w-2xl text-base text-zinc-400">
            Add resume screenshots, enter the job, or both. Resume screenshots stay in this browser tab. Role details you type (title, company, level, and the listing for coding rounds) are sent to the interviewer to frame questions.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <h3 className="mb-1 text-lg font-semibold">Your resume</h3>
              <p className="mb-4 text-sm text-zinc-400">Screenshots of each page work best.</p>
              <ResumeDrop images={resume} onChange={setResume} />
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <h3 className="mb-1 text-lg font-semibold">The job</h3>
              <p className="mb-4 text-sm text-zinc-400">Enter it manually or paste the posting.</p>
              <JobForm job={job} onChange={setJob} />
            </div>
          </div>

          {/* Loop preview */}
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6" data-testid="loop-preview">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-semibold">
                Your interview loop
                {hasJob(job) && (
                  <span className="font-normal text-zinc-400">
                    {" "}
                    for {job.role.trim() || "this role"}
                    {job.company.trim() && ` at ${job.company.trim()}`}
                  </span>
                )}
              </h3>
              <span className="rounded bg-amber-400/15 px-2 py-0.5 text-xs font-bold tracking-wider text-amber-300">
                PREVIEW
              </span>
              <span className="text-sm text-zinc-500">Tailoring isn&apos;t live yet. The coding round runs today.</span>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {rounds.map((r, i) => (
                <li
                  key={r.kind}
                  className={`rounded-xl border p-4 ${r.live ? "border-emerald-500/40 bg-emerald-500/5" : "border-zinc-800 bg-zinc-950"}`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm text-zinc-500">Round {i + 1}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wider ${
                        r.live ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {r.live ? "✓ LIVE" : "COMING SOON"}
                    </span>
                  </div>
                  <div className="text-base font-semibold text-zinc-100">{r.title}</div>
                  <p className="mt-1 text-sm text-zinc-400">{r.why}</p>
                  <ul className="mt-3 flex flex-col gap-1 text-sm text-zinc-300">
                    {r.goodLooksLike.map((g) => (
                      <li key={g} className="flex gap-2">
                        <span className="text-zinc-600" aria-hidden>
                          •
                        </span>
                        {g}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>

          {/* Start */}
          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => start("coding")}
              disabled={starting}
              data-testid="start-practice"
              className={`${btn.primary} rounded-xl px-8 py-3.5 text-lg`}
            >
              {starting ? "Starting…" : "Start practice"}
            </button>
            <button
              type="button"
              onClick={() => start("behavioral")}
              disabled={starting}
              data-testid="start-behavioral"
              className={`${btn.secondary} rounded-xl px-8 py-3.5 text-lg`}
            >
              Start behavioral round
            </button>
            <span className="text-sm text-zinc-400" data-testid="setup-summary">
              {provided
                ? `${resume.length} resume screenshot${resume.length === 1 ? "" : "s"}${hasJob(job) ? " · job details added" : ""}. Choose a coding or behavioral round.`
                : "Nothing added yet. You can still start either round."}
            </span>
          </div>

          <div className="mt-6 flex min-h-[3rem] items-start">
            {msg ? (
              <p className={`flex max-w-2xl items-start gap-2 text-base ${msg.tone}`} role="status" data-testid="mic-status">
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
        </section>
      </main>

      <footer className="border-t border-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-6 text-sm text-zinc-500">
          <Wordmark size={20} />
          <span>Built for Hack the Nest 2026.</span>
        </div>
      </footer>
    </div>
  );
}
