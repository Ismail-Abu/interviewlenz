"use client";

// One-click quick-fill for the target role. Replaces the generic company logo
// rail: instead of showing a student logos they have no relationship with, this
// fills in a concrete target they can edit.
//
// Each preset writes company, role and level into the same JobInfo the form
// edits, so picking one and then typing behaves exactly like typing from
// scratch. The listing is deliberately left alone — a preset is a starting
// point, not a claim about a real posting.

import { EMPTY_JOB, type JobInfo, type Level } from "./profile";

export interface RolePreset {
  id: string;
  company: string;
  role: string;
  level: Level;
}

export const ROLE_PRESETS: RolePreset[] = [
  { id: "stripe-backend", company: "Stripe", role: "Backend Engineer", level: "mid" },
  { id: "google-swe-intern", company: "Google", role: "Software Engineer Intern", level: "intern" },
  { id: "amazon-distsys", company: "Amazon", role: "Distributed Systems Engineer", level: "mid" },
  { id: "meta-systems", company: "Meta", role: "Systems & Infrastructure Engineer", level: "senior" },
];

export function applyPreset(job: JobInfo, preset: RolePreset): JobInfo {
  return { ...job, company: preset.company, role: preset.role, level: preset.level };
}

interface Props {
  job: JobInfo;
  onPick: (job: JobInfo) => void;
  /** "hero" is compact; "setup" sits above the form fields. */
  tone?: "hero" | "setup";
  className?: string;
}

export function RolePresets({ job, onPick, tone = "setup", className = "" }: Props) {
  const selected = ROLE_PRESETS.find((p) => p.company === job.company && p.role === job.role);

  return (
    <div className={className} data-testid="role-presets">
      <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-ink-muted">
        {tone === "hero" ? "Practising for" : "Quick-fill a target"}
      </p>
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {ROLE_PRESETS.map((p) => {
          const active = selected?.id === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(applyPreset(job, p))}
                aria-pressed={active}
                data-testid={`role-preset-${p.id}`}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  active
                    ? "bg-maroon text-white"
                    : "bg-cream-3 text-ink hover:bg-[#EFE0CA] hover:text-maroon-deep"
                }`}
              >
                <span className={active ? "text-white/70" : "text-maroon"}>{p.company}</span>
                <span aria-hidden className={active ? "text-white/40" : "text-ink-muted"}>·</span>
                <span>{p.role}</span>
              </button>
            </li>
          );
        })}
        {selected && (
          <li>
            <button
              type="button"
              onClick={() => onPick({ ...job, ...EMPTY_JOB, listing: job.listing })}
              data-testid="role-preset-clear"
              className="inline-flex items-center rounded-full px-3 py-2 text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink hover:bg-cream-2"
            >
              Clear
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
