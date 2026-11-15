"use client";

import { EMPTY_JOB, type JobInfo, type Level } from "./profile";

export interface RolePreset {
  id: string;
  company: string;
  role: string;
  displayRole?: string;
  level: Level;
}

export const ROLE_PRESETS: RolePreset[] = [
  { id: "stripe-backend", company: "Stripe", role: "Backend Engineer", displayRole: "Backend Engineer", level: "mid" },
  { id: "google-swe-intern", company: "Google", role: "Software Engineer Intern", displayRole: "SWE Intern", level: "intern" },
  { id: "amazon-distsys", company: "Amazon", role: "Distributed Systems Engineer", displayRole: "Distributed Systems", level: "mid" },
  { id: "meta-systems", company: "Meta", role: "Systems & Infrastructure Engineer", displayRole: "Systems", level: "senior" },
];

export function applyPreset(job: JobInfo, preset: RolePreset): JobInfo {
  return { ...job, company: preset.company, role: preset.role, level: preset.level };
}

interface Props {
  job: JobInfo;
  onPick: (job: JobInfo) => void;
  tone?: "hero" | "setup";
  className?: string;
}

export function RolePresets({ job, onPick, className = "" }: Props) {
  const selected = ROLE_PRESETS.find((p) => p.company === job.company && p.role === job.role);

  return (
    <fieldset className={className} data-testid="role-presets">
      <legend className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Practicing for
      </legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {ROLE_PRESETS.map((p) => {
          const active = selected?.id === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(applyPreset(job, p))}
              aria-pressed={active}
              data-testid={`role-preset-${p.id}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? "border-foreground bg-foreground text-background shadow-sm"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              <span className={active ? "text-background/70 font-medium" : "text-muted-foreground"}>
                {p.company}
              </span>
              <span aria-hidden="true" className={active ? "text-background/40" : "text-border"}>
                ·
              </span>
              <span className="font-semibold">{p.displayRole || p.role}</span>
            </button>
          );
        })}
        {selected && (
          <button
            type="button"
            onClick={() => onPick({ ...job, ...EMPTY_JOB, listing: job.listing })}
            data-testid="role-preset-clear"
            className="inline-flex items-center rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
          >
            Clear
          </button>
        )}
      </div>
    </fieldset>
  );
}
