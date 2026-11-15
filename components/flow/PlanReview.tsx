"use client";

// "Review your interview plan".
// PRESENTATION OWNER: Gemini #2. Controlled component: renders props and calls callbacks.
import { useState } from "react";
import type { PlanTheme } from "@/lib/contract";
import { getProblem } from "@/lib/problems";
import { Wordmark } from "../Logo";
import { fallbackNotice } from "../planAdapter";
import { studioBtn, studioBtnSm } from "../landing/studioUi";
import type { PlanReviewProps } from "./types";

const inputField =
  "w-full rounded-[14px] bg-[#0C0D12] px-3.5 py-2.5 text-sm text-zinc-100 ring-1 ring-inset ring-white/15 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/40";

export function PlanReview({ plan, application, onEdit, onStart, onBack, starting }: PlanReviewProps) {
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
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="rounded-full border border-sky-500/30 bg-sky-950/60 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
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
                className="text-rose-300 underline underline-offset-2 hover:text-rose-400"
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
        <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-950/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
          From your listing
        </span>
      );
    }
    if (p.kind === "candidate-resume") {
      return (
        <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-950/60 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
          From your resume
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-zinc-400">
        Inferred for role
      </span>
    );
  };

  const renderRoundThemes = (r: PlanTheme["round"]) => {
    const themes = plan.themes.filter((th) => th.round === r);
    if (themes.length === 0) {
      return (
        <p className="rounded-[18px] bg-white/60 p-4 text-sm text-zinc-400 italic">
          No specific themes configured for this round.
        </p>
      );
    }
    return (
      <ul className="flex flex-col gap-2.5">
        {themes.map((th) => (
          <li
            key={th.id}
            className="flex items-start justify-between gap-4 rounded-[20px] bg-[#0C0D12]/80 p-4 shadow-sm border border-white/[0.08] transition-colors"
            data-testid={`theme-${th.id}`}
          >
            <div className="flex-1">
              <div className="text-[15px] font-bold text-zinc-100">{th.label}</div>
              {th.detail && <div className="mt-1 text-sm leading-relaxed text-zinc-400">{th.detail}</div>}
              <div className="mt-2.5">{provenanceBadge(th)}</div>
            </div>
            <button
              type="button"
              onClick={() => onEdit({ removeThemeIds: [th.id] })}
              className={studioBtnSm.neutral}
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
     
      className="min-h-screen studio-surface bg-[#09090B] text-zinc-100 [color-scheme:dark]"
      data-testid="plan-review"
      data-plan-id={plan.planId}
      data-plan-revision={plan.revision}
    >
      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between gap-3">
          <Wordmark size={26} tone="dark" />
          <button
            type="button"
            onClick={onBack}
            className={studioBtnSm.neutral}
            data-testid="plan-back"
          >
            ← Edit details
          </button>
        </div>

        {/* Plan Header */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-rose-300">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#E11D48]" />
            Interview Plan Preview
          </span>
          <h1 className="mt-3 font-brand text-3xl font-bold tracking-tight sm:text-4xl text-zinc-100">
            Review your interview plan
          </h1>
          <p className="mt-2 text-lg font-semibold text-zinc-100">
            {title}
            {t.level ? <span className="ml-2 font-normal text-zinc-400">· {t.level}</span> : null}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400" data-testid="plan-source">
            <span className="rounded-full bg-zinc-900/60 px-2.5 py-0.5 font-medium border border-white/[0.08]">
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
            className="flex items-start gap-3 rounded-[20px] bg-amber-950/50 border border-amber-500/30 p-4 text-sm text-amber-200"
            data-testid="plan-fallback-notice"
          >
            <span aria-hidden className="text-base font-bold">⚠️</span>
            <div className="flex-1 font-medium">{notice}</div>
          </div>
        )}

        {/* Technical Coding Interview */}
        <section className="rounded-[26px] bg-zinc-900/60 p-6 shadow-2xl shadow-black/40 border border-white/[0.08]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Technical Coding Interview</span>
              <h2 className="font-brand text-2xl font-bold text-zinc-100">Technical Coding</h2>
            </div>
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-zinc-400">
              ~20 mins
            </span>
          </div>
          <p className="mb-4 text-sm text-zinc-400" data-testid="plan-problem">
            Problem:{" "}
            <span className="font-bold text-zinc-100">{problem?.title ?? plan.technical.problemId}</span> (Python), with live interviewer follow-ups on your approach, edge cases, and runtime.
          </p>
          {renderRoundThemes("technical")}
        </section>

        {/* Behavioral Deep-Dive */}
        <section className="rounded-[26px] bg-zinc-900/60 p-6 shadow-2xl shadow-black/40 border border-white/[0.08]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Behavioral Deep-Dive</span>
              <h2 className="font-brand text-2xl font-bold text-zinc-100">Behavioral Deep-Dive</h2>
            </div>
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-zinc-400">
              ~15 mins
            </span>
          </div>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
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
            <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
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
          <section className="rounded-[22px] bg-[#0C0D12]/80 p-5 text-sm text-zinc-400 border border-white/[0.08]" data-testid="plan-citations">
            <h2 className="mb-2 font-bold text-zinc-100">Public Sources & Research References</h2>
            <ul className="flex flex-col gap-1.5 pl-1">
              {plan.citations.map((c) => (
                <li key={c.id} className="flex items-baseline gap-2">
                  <span className="text-rose-400">•</span>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-rose-300 underline underline-offset-2 hover:text-rose-400"
                  >
                    {c.title}
                  </a>
                  {c.publisher && <span className="text-xs text-zinc-400">({c.publisher})</span>}
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
            className={`${studioBtn.primary} min-w-56`}
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
          <span className="text-sm text-zinc-400">
            The Technical Coding Interview, followed immediately by the Behavioral Deep-Dive.
          </span>
        </div>
      </main>
    </div>
  );
}
