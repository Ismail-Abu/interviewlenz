"use client";

// "Review your interview plan".
// PRESENTATION OWNER: Gemini #2. Controlled component: renders props and calls callbacks.
import { useState } from "react";
import type { PlanTheme } from "@/lib/contract";
import { getProblem } from "@/lib/problems";
import { Wordmark } from "../Logo";
import { fallbackNotice } from "../planAdapter";
import { coverBtn, coverBtnSm } from "../ui/buttons";
import type { PlanReviewProps } from "./types";

const inputField =
  "w-full rounded-[14px] bg-background px-3.5 py-2.5 text-sm text-ink ring-1 ring-inset ring-[#D9C8B0] transition-colors focus:outline-none focus:ring-2 focus:ring-maroon-soft";

export function PlanReview({ plan, application, onEdit, onStart, onBack, onHome, starting }: PlanReviewProps) {
  const problem = getProblem(plan.technical.problemId);
  const t = plan.target;
  const title = [t.role, t.company && `at ${t.company}`].filter(Boolean).join(" ") || application.roleContext.role || "Your interview";
  const notice = plan.source === "role-fallback" ? fallbackNotice(plan) : undefined;
  const cite = (id: string) => plan.citations.find((c) => c.id === id);
  const [project, setProject] = useState(plan.behavioral.focus?.project?.name ?? "");
  const [skill, setSkill] = useState(plan.behavioral.focus?.focus?.skill ?? "");

  const provenanceBadge = (th: PlanTheme) => {
    const p = th.provenance;
    if (p.kind === "public-research") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
          <span className="rounded-full bg-[#E8F0FE] px-2 py-0.5 text-[11px] font-semibold text-[#1967D2]">
            Public source
          </span>
          {p.citationIds.map((id, i) => {
            const c = cite(id);
            return c ? (
              <a
                key={id}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-maroon-deep underline underline-offset-2 hover:text-maroon"
              >
                {c.publisher ?? c.title}
                {i < p.citationIds.length - 1 ? ", " : ""}
              </a>
            ) : null;
          })}
        </span>
      );
    }
    if (p.kind === "job-listing") {
      return (
        <span className="inline-flex items-center rounded-full bg-[#E6F4EA] px-2 py-0.5 text-[11px] font-semibold text-[#137333]">
          From your listing
        </span>
      );
    }
    if (p.kind === "candidate-resume") {
      return (
        <span className="inline-flex items-center rounded-full bg-[#FEF7E0] px-2 py-0.5 text-[11px] font-semibold text-[#B06000]">
          From your resume
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-cream-3 px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
        Inferred for role
      </span>
    );
  };

  const renderRoundThemes = (r: PlanTheme["round"]) => {
    const themes = plan.themes.filter((th) => th.round === r);
    if (themes.length === 0) {
      return (
        <p className="rounded-[18px] bg-background/60 p-4 text-sm text-ink-muted italic">
          No specific themes configured for this round.
        </p>
      );
    }
    return (
      <ul className="flex flex-col gap-2.5">
        {themes.map((th) => (
          <li
            key={th.id}
            className="flex items-start justify-between gap-4 rounded-[20px] bg-background/90 p-4 shadow-sm border border-cream-line/50 transition-colors"
            data-testid={`theme-${th.id}`}
          >
            <div className="flex-1">
              <div className="text-[15px] font-bold text-ink">{th.label}</div>
              {th.detail && <div className="mt-1 text-sm leading-relaxed text-ink-muted">{th.detail}</div>}
              <div className="mt-2.5">{provenanceBadge(th)}</div>
            </div>
            <button
              type="button"
              onClick={() => onEdit({ removeThemeIds: [th.id] })}
              className={coverBtnSm.neutral}
              aria-label={`Remove ${th.label}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    );
  };

  // Only a real change creates a new revision (blur alone does not).
  const saveFocus = () => {
    const cur = plan.behavioral.focus;
    if (project.trim() === (cur?.project?.name ?? "") && skill.trim() === (cur?.focus?.skill ?? "")) return;
    onEdit({
      behavioralFocus:
        project.trim() || skill.trim()
          ? {
              ...(project.trim() ? { project: { name: project.trim() } } : {}),
              ...(skill.trim() ? { focus: { skill: skill.trim() } } : {}),
            }
          : null,
    });
  };

  return (
    <div
      data-surface="cream"
      className="min-h-screen bg-cream text-ink [color-scheme:light]"
      data-testid="plan-review"
      data-plan-id={plan.planId}
      data-plan-revision={plan.revision}
    >
      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between gap-3">
          <Wordmark size={26} tone="light" onHome={onHome} />
          <button
            type="button"
            onClick={onBack}
            className={coverBtnSm.neutral}
            data-testid="plan-back"
          >
            ← Edit details
          </button>
        </div>

        {/* Plan Header */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-cream-3 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-maroon-deep">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-maroon" />
            Interview Plan Preview
          </span>
          <h1 className="mt-3 font-brand text-3xl font-bold tracking-tight sm:text-4xl text-ink">
            Review your interview plan
          </h1>
          <p className="mt-2 text-lg font-semibold text-ink">
            {title}
            {t.level ? <span className="ml-2 font-normal text-ink-muted">· {t.level}</span> : null}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted" data-testid="plan-source">
            <span className="rounded-full bg-cream-2 px-2.5 py-0.5 font-medium border border-cream-line">
              {plan.source === "researched"
                ? "Sourced from public research & your inputs"
                : "Inferred from role title & your inputs"}
            </span>
            <span>·</span>
            <span>Revision {plan.revision}</span>
          </div>
        </div>

        {/* Fallback Notice */}
        {notice && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-[20px] bg-[#FDF6E2] border border-[#E8D196] p-4 text-sm text-[#7A4600]"
            data-testid="plan-fallback-notice"
          >
            <span aria-hidden className="text-base font-bold">⚠️</span>
            <div className="flex-1 font-medium">{notice}</div>
          </div>
        )}

        {/* Technical Coding Interview */}
        <section className="rounded-[26px] bg-cream-2 p-6 shadow-warm border border-cream-line/50">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-maroon">Technical Coding Interview</span>
              <h2 className="font-brand text-2xl font-bold text-ink">Technical Coding</h2>
            </div>
            <span className="rounded-full bg-cream-3 px-3 py-1 text-xs font-semibold text-ink-muted">
              ~20 mins
            </span>
          </div>
          <p className="mb-4 text-sm text-ink-muted" data-testid="plan-problem">
            Problem:{" "}
            <span className="font-bold text-ink">{problem?.title ?? plan.technical.problemId}</span> (Python), with live interviewer follow-ups on your approach, edge cases, and runtime.
          </p>
          {renderRoundThemes("technical")}
        </section>

        {/* Behavioral Deep-Dive */}
        <section className="rounded-[26px] bg-cream-2 p-6 shadow-warm border border-cream-line/50">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-maroon">Behavioral Deep-Dive</span>
              <h2 className="font-brand text-2xl font-bold text-ink">Behavioral Deep-Dive</h2>
            </div>
            <span className="rounded-full bg-cream-3 px-3 py-1 text-xs font-semibold text-ink-muted">
              ~15 mins
            </span>
          </div>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-muted">
              Project to ask about
              <input
                className={inputField}
                placeholder="e.g. Campus Orders Service"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                onBlur={saveFocus}
                name="plan-project"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-muted">
              Skill to focus on
              <input
                className={inputField}
                placeholder="e.g. Debugging production incidents"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                onBlur={saveFocus}
                name="plan-skill"
              />
            </label>
          </div>
          {renderRoundThemes("behavioral")}
        </section>

        {/* Public Citations */}
        {plan.source === "researched" && plan.citations.length > 0 && (
          <section className="rounded-[22px] bg-background/70 p-5 text-sm text-ink-muted border border-cream-line/50" data-testid="plan-citations">
            <h2 className="mb-2 font-bold text-ink">Public Sources & Research References</h2>
            <ul className="flex flex-col gap-1.5 pl-1">
              {plan.citations.map((c) => (
                <li key={c.id} className="flex items-baseline gap-2">
                  <span className="text-maroon">•</span>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-maroon-deep underline underline-offset-2 hover:text-maroon"
                  >
                    {c.title}
                  </a>
                  {c.publisher && <span className="text-xs text-ink-muted">({c.publisher})</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            type="button"
            onClick={onStart}
            disabled={starting}
            className={`${coverBtn.primary} min-w-56`}
            data-testid="start-plan"
          >
            {starting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                <span>Starting…</span>
              </>
            ) : (
              "Start technical round"
            )}
          </button>
          <span className="text-sm text-ink-muted">
            The Technical Coding Interview, followed immediately by the Behavioral Deep-Dive.
          </span>
        </div>
      </main>
    </div>
  );
}
