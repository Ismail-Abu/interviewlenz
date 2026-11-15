"use client";

// "What are you applying for?" as a dark command modal. Controlled component:
// renders props and calls callbacks (components/flow/types.ts).
import { useEffect, useRef } from "react";
import { Wordmark } from "../Logo";
import { JobForm } from "../landing/JobForm";
import { RolePresets } from "../landing/RolePresets";
import { ResumeDrop } from "../landing/ResumeDrop";
import { TailorPanel } from "../landing/TailorPanel";
import { takeSetupSeed } from "../landing/setupSeed";
import { studio, studioBtn, studioBtnSm } from "../landing/studioUi";
import type { ApplicationSetupProps } from "./types";

function Step({ n, title, note, children }: { n: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className={`${studio.inset} p-5 sm:p-6`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-baseline gap-3 text-base font-bold text-zinc-50">
          <span className="font-mono text-xs text-rose-300">{n}</span>
          {title}
        </h2>
        {note && <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-400">{note}</span>}
      </div>
      {children}
    </section>
  );
}

export function ApplicationSetup({ draft, onDraftChange, status, sendPreview, canAnalyze, onAnalyze, onBack, onQuickPractice }: ApplicationSetupProps) {
  const busy = status.kind === "analyzing";

  // A preset picked on the homepage (components/landing/setupSeed.ts), applied
  // once and only if the student hasn't entered a role or company here yet.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const seed = takeSetupSeed();
    if (seed && !draft.job.role.trim() && !draft.job.company.trim()) onDraftChange({ ...draft, job: { ...draft.job, ...seed } });
  }, [draft, onDraftChange]);

  return (
    <div className={studio.page} data-testid="application-setup">
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex items-center justify-between gap-3">
          <Wordmark size={26} tone="dark" />
          <button type="button" onClick={onBack} className={studioBtnSm.neutral} data-testid="setup-back">
            ← Home
          </button>
        </div>

        {/* Command modal */}
        <div className={`${studio.glass} overflow-hidden`}>
          <div className="flex items-center gap-3 border-b border-white/[0.08] bg-white/[0.02] px-5 py-3 font-mono text-xs text-zinc-400">
            <span aria-hidden className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
            </span>
            <span className="truncate">interviewlenz / new-interview</span>
          </div>

          <div className="flex flex-col gap-5 p-5 sm:p-8">
            <div>
              <span className={studio.eyebrow}>Application setup</span>
              <h1 className="mt-3 font-brand text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">What are you applying for?</h1>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-zinc-300">
                Paste the job listing or just type the role. Your resume is optional. Next you&apos;ll review your plan (Technical
                Coding, then Behavioral Deep-Dive) before anything starts.
              </p>
            </div>

            <fieldset disabled={busy} className="flex min-w-0 flex-col gap-5">
              <Step n="01" title="The role" note="Required">
                <RolePresets job={draft.job} onPick={(job) => onDraftChange({ ...draft, job })} className="mb-5" />
                <JobForm job={draft.job} onChange={(job) => onDraftChange({ ...draft, job })} />
              </Step>
              <Step n="02" title="Your resume" note="Optional">
                <p className="mb-4 text-sm text-zinc-400">Used only to suggest a project for the behavioral round, and only if you choose Prepare below.</p>
                <ResumeDrop images={draft.resume} onChange={(resume) => onDraftChange({ ...draft, resume })} />
              </Step>
            </fieldset>

            <TailorPanel
              resume={draft.resume}
              job={draft.job}
              onContextChange={(resumeContext) => onDraftChange({ ...draft, resumeContext })}
              onStartGeneric={() => onQuickPractice("behavioral")}
            />

            <section className={`${studio.inset} p-5`} data-testid="send-preview">
              <h2 className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-zinc-300">What happens when you build your plan</h2>
              <ul className="mt-3 flex flex-col gap-2.5 text-sm">
                {sendPreview.map((item) => (
                  <li key={item.destination} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                    <span className="font-semibold text-zinc-100 sm:min-w-52">{item.destination}:</span>
                    <span className="text-zinc-400">{item.fields.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </section>

            {status.kind === "fell-back" && (
              <div role="status" className={studio.warn} data-testid="setup-fallback">
                {status.message}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={onAnalyze} disabled={!canAnalyze || busy} className={`${studioBtn.primary} min-w-56`} data-testid="build-plan">
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                    Building your plan…
                  </>
                ) : (
                  <>
                    Build my interview plan <span aria-hidden>→</span>
                  </>
                )}
              </button>
              {!canAnalyze && <span className="text-sm text-zinc-400">Enter a role or paste a listing first.</span>}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/[0.08] bg-white/[0.02] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-sm text-zinc-400">
              <span className="font-semibold text-zinc-200">Skip the plan.</span> Start a round now; you can build a plan later.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onQuickPractice("coding")} className={studioBtnSm.secondary} data-testid="setup-quick-coding">
                Technical Coding
              </button>
              <button type="button" onClick={() => onQuickPractice("behavioral")} className={studioBtnSm.secondary} data-testid="setup-quick-behavioral">
                Behavioral Deep-Dive
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
