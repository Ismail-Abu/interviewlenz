"use client";

// "What are you applying for?"
// PRESENTATION OWNER: Gemini #2. Controlled component: renders props and calls callbacks.
import { Wordmark } from "../Logo";
import { JobForm } from "../landing/JobForm";
import { RolePresets } from "../landing/RolePresets";
import { ResumeDrop } from "../landing/ResumeDrop";
import { TailorPanel } from "../landing/TailorPanel";
import { coverBtn, coverBtnSm } from "../ui/buttons";
import type { ApplicationSetupProps } from "./types";

export function ApplicationSetup({
  draft,
  onDraftChange,
  status,
  sendPreview,
  canAnalyze,
  onAnalyze,
  onBack,
  onQuickPractice,
}: ApplicationSetupProps) {
  const busy = status.kind === "analyzing";

  return (
    <div
      data-surface="cream"
      className="min-h-screen bg-cream text-ink [color-scheme:light]"
      data-testid="application-setup"
    >
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between gap-3">
          <Wordmark size={26} tone="light" />
          <button
            type="button"
            onClick={onBack}
            className={coverBtnSm.neutral}
            data-testid="setup-back"
          >
            ← Home
          </button>
        </div>

        {/* Page Heading */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-cream-3 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-maroon-deep">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-maroon" />
            Application Setup
          </span>
          <h1 className="mt-3 font-brand text-3xl font-bold tracking-tight sm:text-4xl text-ink">
            What are you applying for?
          </h1>
          <p className="mt-2 max-w-2xl text-[16px] leading-relaxed text-ink-muted">
            Paste the job listing or just type the role. Adding your resume is optional. Next you&apos;ll review your
            tailored plan — Technical Coding Interview, then Behavioral Deep-Dive — before anything starts.
          </p>
        </div>

        {/* Role & Resume Input Sections */}
        <fieldset disabled={busy} className="grid gap-6 lg:grid-cols-2">
          <section className="flex flex-col justify-between rounded-[26px] bg-white/80 p-6 shadow-warm border border-cream-line/60">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-lg font-bold text-ink">The role</h2>
                <span className="text-xs font-semibold text-maroon-deep uppercase tracking-wider">Required</span>
              </div>
              <p className="mb-4 text-xs text-ink-muted">
                Company name, role title, level, or full listing text.
              </p>
              <RolePresets
                job={draft.job}
                onPick={(job) => onDraftChange({ ...draft, job })}
                className="mb-5"
              />
              <JobForm job={draft.job} onChange={(job) => onDraftChange({ ...draft, job })} />
            </div>
          </section>

          <section className="flex flex-col justify-between rounded-[26px] bg-white/80 p-6 shadow-warm border border-cream-line/60">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-lg font-bold text-ink">Your resume</h2>
                <span className="rounded-full bg-cream-3 px-2.5 py-0.5 text-xs font-semibold text-ink-muted">Optional</span>
              </div>
              <p className="mb-4 text-xs text-ink-muted">
                Used only to suggest a project for the behavioral round, and only if you choose Prepare below.
              </p>
              <ResumeDrop images={draft.resume} onChange={(resume) => onDraftChange({ ...draft, resume })} />
            </div>
          </section>
        </fieldset>

        {/* Behavioral Tailor Panel */}
        <TailorPanel
          resume={draft.resume}
          job={draft.job}
          onContextChange={(resumeContext) => onDraftChange({ ...draft, resumeContext })}
          onStartGeneric={() => onQuickPractice("behavioral")}
        />

        {/* Disclosure & What Will Be Sent */}
        <section
          className="rounded-[26px] bg-cream-2/90 p-6 shadow-warm border border-cream-line/50"
          data-testid="send-preview"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-base text-maroon">ℹ</span>
            <h2 className="text-base font-bold text-ink">What happens when you build your plan</h2>
          </div>
          <ul className="mt-3 flex flex-col gap-2.5 text-sm">
            {sendPreview.map((item) => (
              <li key={item.destination} className="flex flex-col gap-1 sm:flex-row sm:items-baseline">
                <span className="font-semibold text-ink sm:min-w-44">{item.destination}:</span>
                <span className="text-ink-muted">{item.fields.join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Fallback Notice */}
        {status.kind === "fell-back" && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-[20px] bg-[#FDF6E2] border border-[#E8D196] p-4 text-sm text-[#7A4600]"
            data-testid="setup-fallback"
          >
            <span aria-hidden className="text-base font-bold">⚠️</span>
            <div className="flex-1 font-medium">{status.message}</div>
          </div>
        )}

        {/* Primary CTA and helper text */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onAnalyze}
              disabled={!canAnalyze || busy}
              className={`${coverBtn.primary} min-w-56`}
              data-testid="build-plan"
            >
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                  <span>Building your plan…</span>
                </>
              ) : (
                "Build my interview plan"
              )}
            </button>
            {!canAnalyze && (
              <span className="text-sm text-ink-muted font-medium">
                Enter a role or paste a listing to generate your customized plan.
              </span>
            )}
          </div>
        </div>

        {/* Skip the plan and start an interview immediately. */}
        <div className="border-t border-cream-line/60 pt-6">
          <p className="text-sm font-semibold text-ink">Skip the plan and start now</p>
          <p className="mt-1 text-sm text-ink-muted">
            No plan is generated. You can always come back and build one.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onQuickPractice("coding")}
              className={coverBtnSm.secondary}
              data-testid="setup-quick-coding"
            >
              <span aria-hidden>⚡</span> Quick Start: Technical Coding
            </button>
            <button
              type="button"
              onClick={() => onQuickPractice("behavioral")}
              className={coverBtnSm.secondary}
              data-testid="setup-quick-behavioral"
            >
              <span aria-hidden>⚡</span> Quick Start: Behavioral Deep-Dive
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}
