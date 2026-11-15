"use client";

import { LEVELS, type JobInfo, type Level } from "./profile";

interface Props {
  job: JobInfo;
  onChange: (next: JobInfo) => void;
}

const field =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-base text-zinc-100 placeholder:text-zinc-600";

export function JobForm({ job, onChange }: Props) {
  const set = <K extends keyof JobInfo>(k: K, v: JobInfo[K]) => onChange({ ...job, [k]: v });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
          Company
          <input
            className={field}
            value={job.company}
            onChange={(e) => set("company", e.target.value)}
            placeholder="e.g. Stripe"
            autoComplete="organization"
            name="company"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
          Role
          <input
            className={field}
            value={job.role}
            onChange={(e) => set("role", e.target.value)}
            placeholder="e.g. Software Engineer Intern"
            autoComplete="organization-title"
            name="role"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
        Level
        <select className={field} value={job.level} onChange={(e) => set("level", e.target.value as Level)} name="level">
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
        Job listing
        <textarea
          className={`${field} min-h-36 resize-y leading-relaxed`}
          value={job.listing}
          onChange={(e) => set("listing", e.target.value)}
          placeholder="Paste the responsibilities and requirements from the posting."
          name="listing"
        />
        <span className="text-xs font-normal text-zinc-500">{job.listing.trim().split(/\s+/).filter(Boolean).length} words</span>
      </label>
    </div>
  );
}
