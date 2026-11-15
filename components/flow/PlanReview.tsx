"use client";

// "Review your interview plan". Functional version so the flow runs end to end.
// PRESENTATION OWNER: Gemini #2. Replace the markup freely; keep the props
// (components/flow/types.ts) and the data-testids.
import { useState } from "react";
import type { PlanTheme } from "@/lib/contract";
import { getProblem } from "@/lib/problems";
import { Wordmark } from "../Logo";
import { fallbackNotice } from "../planAdapter";
import { coverBtn, coverBtnSm } from "../ui/buttons";
import type { PlanReviewProps } from "./types";

const field = "w-full rounded-[14px] bg-white px-3 py-2 text-base text-ink ring-1 ring-inset ring-[#d9c8b0] focus:ring-2 focus:ring-maroon-soft";

export function PlanReview({ plan, application, onEdit, onStart, onBack, starting }: PlanReviewProps) {
  const problem = getProblem(plan.technical.problemId);
  const t = plan.target;
  const title = [t.role, t.company && `at ${t.company}`].filter(Boolean).join(" ") || application.roleContext.role || "Your interview";
  const notice = plan.source === "role-fallback" ? fallbackNotice(plan) : undefined;
  const cite = (id: string) => plan.citations.find((c) => c.id === id);
  const [project, setProject] = useState(plan.behavioral.focus?.project?.name ?? "");
  const [skill, setSkill] = useState(plan.behavioral.focus?.focus?.skill ?? "");

  const provenance = (th: PlanTheme) => {
    const p = th.provenance;
    if (p.kind === "public-research")
      return (
        <span>
          Public source{p.citationIds.length > 1 ? "s" : ""}:{" "}
          {p.citationIds.map((id, i) => {
            const c = cite(id);
            return c ? (
              <a key={id} href={c.url} target="_blank" rel="noopener noreferrer" className="text-maroon-deep underline underline-offset-2">
                {c.publisher ?? c.title}
                {i < p.citationIds.length - 1 ? ", " : ""}
              </a>
            ) : null;
          })}
        </span>
      );
    return p.kind === "job-listing" ? "From your listing" : p.kind === "candidate-resume" ? "From your resume" : "Typical for this role";
  };

  const round = (r: PlanTheme["round"]) => (
    <ul className="flex flex-col gap-2">
      {plan.themes
        .filter((th) => th.round === r)
        .map((th) => (
          <li key={th.id} className="flex items-start justify-between gap-3 rounded-[18px] bg-white/80 p-3" data-testid={`theme-${th.id}`}>
            <div>
              <div className="font-semibold">{th.label}</div>
              {th.detail && <div className="text-sm text-ink-muted">{th.detail}</div>}
              <div className="mt-1 text-xs text-ink-muted">{provenance(th)}</div>
            </div>
            <button type="button" onClick={() => onEdit({ removeThemeIds: [th.id] })} className={coverBtnSm.neutral} aria-label={`Remove ${th.label}`}>
              Remove
            </button>
          </li>
        ))}
    </ul>
  );

  // Only a real change creates a new revision (blur alone does not).
  const saveFocus = () => {
    const cur = plan.behavioral.focus;
    if (project.trim() === (cur?.project?.name ?? "") && skill.trim() === (cur?.focus?.skill ?? "")) return;
    onEdit({
      behavioralFocus:
        project.trim() || skill.trim()
          ? { ...(project.trim() ? { project: { name: project.trim() } } : {}), ...(skill.trim() ? { focus: { skill: skill.trim() } } : {}) }
          : null,
    });
  };

  return (
    <div data-surface="cream" className="min-h-screen bg-cream text-ink [color-scheme:light]" data-testid="plan-review" data-plan-id={plan.planId} data-plan-revision={plan.revision}>
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <Wordmark size={26} tone="light" />
          <button type="button" onClick={onBack} className={coverBtnSm.neutral} data-testid="plan-back">
            ← Edit details
          </button>
        </div>
        <div>
          <h1 className="font-brand text-3xl font-bold tracking-tight">Review your interview plan</h1>
          <p className="mt-1 text-[15px] text-ink-muted">
            {title}
            {t.level ? ` · ${t.level}` : ""}
          </p>
          <p className="mt-1 text-xs text-ink-muted" data-testid="plan-source">
            {plan.source === "researched" ? "Based on public sources and what you entered" : "Based on the role and what you entered"} · revision {plan.revision}
          </p>
        </div>
        {notice && (
          <p role="status" className="rounded-[18px] bg-[#fbe9c8] p-3 text-sm text-[#7a4600]" data-testid="plan-fallback-notice">
            {notice}
          </p>
        )}

        <section className="rounded-[26px] bg-cream-2 p-5 shadow-warm">
          <h2 className="font-brand text-xl font-bold">Round 1 · Technical</h2>
          <p className="mb-3 mt-1 text-sm text-ink-muted" data-testid="plan-problem">
            Problem: <span className="font-semibold text-ink">{problem?.title ?? plan.technical.problemId}</span>, in Python, while the interviewer asks about your reasoning.
          </p>
          {round("technical")}
        </section>

        <section className="rounded-[26px] bg-cream-2 p-5 shadow-warm">
          <h2 className="font-brand text-xl font-bold">Round 2 · Behavioral</h2>
          <div className="mb-3 mt-2 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Project to ask about (optional)
              <input className={field} value={project} onChange={(e) => setProject(e.target.value)} onBlur={saveFocus} name="plan-project" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Skill to focus on (optional)
              <input className={field} value={skill} onChange={(e) => setSkill(e.target.value)} onBlur={saveFocus} name="plan-skill" />
            </label>
          </div>
          {round("behavioral")}
        </section>

        {plan.source === "researched" && plan.citations.length > 0 && (
          <section className="text-sm text-ink-muted" data-testid="plan-citations">
            <h2 className="mb-1 font-semibold text-ink">Public sources</h2>
            <ul className="list-disc pl-5">
              {plan.citations.map((c) => (
                <li key={c.id}>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-maroon-deep underline underline-offset-2">
                    {c.title}
                  </a>
                  {c.publisher ? ` · ${c.publisher}` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onStart} disabled={starting} className={coverBtn.primary} data-testid="start-plan">
            {starting ? "Starting…" : "Start technical round"}
          </button>
          <span className="text-sm text-ink-muted">Technical, then behavioral, then your score with evidence.</span>
        </div>
      </main>
    </div>
  );
}
