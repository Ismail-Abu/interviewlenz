"use client";

// "What are you applying for?" Functional version so the flow runs end to end.
// PRESENTATION OWNER: Gemini #2. Replace the markup freely; keep the props
// (components/flow/types.ts) and the data-testids.
import { Wordmark } from "../Logo";
import { JobForm } from "../landing/JobForm";
import { ResumeDrop } from "../landing/ResumeDrop";
import { TailorPanel } from "../landing/TailorPanel";
import { coverBtn, coverBtnSm } from "../ui/buttons";
import type { ApplicationSetupProps } from "./types";

export function ApplicationSetup({ draft, onDraftChange, status, sendPreview, canAnalyze, onAnalyze, onBack, onQuickPractice }: ApplicationSetupProps) {
  const busy = status.kind === "analyzing";
  return (
    <div data-surface="cream" className="min-h-screen bg-cream text-ink [color-scheme:light]" data-testid="application-setup">
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <Wordmark size={26} tone="light" />
          <button type="button" onClick={onBack} className={coverBtnSm.neutral} data-testid="setup-back">
            ← Home
          </button>
        </div>
        <div>
          <h1 className="font-brand text-3xl font-bold tracking-tight">What are you applying for?</h1>
          <p className="mt-2 text-[15px] text-ink-muted">
            Paste the job listing or just type the role. Adding your resume is optional. Next you&apos;ll review your interview plan
            before anything starts.
          </p>
        </div>

        <fieldset disabled={busy} className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-[22px] bg-white/70 p-5 shadow-warm">
            <h2 className="mb-3 text-base font-semibold">The role</h2>
            <JobForm job={draft.job} onChange={(job) => onDraftChange({ ...draft, job })} />
          </section>
          <section className="rounded-[22px] bg-white/70 p-5 shadow-warm">
            <h2 className="mb-1 text-base font-semibold">Your resume (optional)</h2>
            <p className="mb-3 text-sm text-ink-muted">Used only to suggest a project for the behavioral round, and only if you choose Prepare below.</p>
            <ResumeDrop images={draft.resume} onChange={(resume) => onDraftChange({ ...draft, resume })} />
          </section>
        </fieldset>

        <TailorPanel
          resume={draft.resume}
          job={draft.job}
          onContextChange={(resumeContext) => onDraftChange({ ...draft, resumeContext })}
          onStartGeneric={() => onQuickPractice("behavioral")}
        />

        <section className="rounded-[22px] bg-cream-2 p-5 shadow-warm" data-testid="send-preview">
          <h2 className="text-base font-semibold">What happens when you build your plan</h2>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {sendPreview.map((item) => (
              <li key={item.destination}>
                <span className="font-semibold">{item.destination}:</span> <span className="text-ink-muted">{item.fields.join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>

        {status.kind === "fell-back" && (
          <p role="status" className="rounded-[18px] bg-[#fbe9c8] p-3 text-sm text-[#7a4600]" data-testid="setup-fallback">
            {status.message}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onAnalyze} disabled={!canAnalyze || busy} className={coverBtn.primary} data-testid="build-plan">
            {busy ? "Building your plan…" : "Build my interview plan"}
          </button>
          {!canAnalyze && <span className="text-sm text-ink-muted">Enter a role or paste a listing first.</span>}
        </div>

        <p className="text-sm text-ink-muted">
          Just want to practice?{" "}
          <button type="button" onClick={() => onQuickPractice("coding")} className="font-semibold text-maroon-deep underline-offset-4 hover:underline" data-testid="setup-quick-coding">
            Quick coding round
          </button>{" "}
          ·{" "}
          <button type="button" onClick={() => onQuickPractice("behavioral")} className="font-semibold text-maroon-deep underline-offset-4 hover:underline" data-testid="setup-quick-behavioral">
            Quick behavioral round
          </button>
        </p>
      </main>
    </div>
  );
}
