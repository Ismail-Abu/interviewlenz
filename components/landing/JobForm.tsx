"use client";

import { LEVELS, type JobInfo, type Level } from "./profile";

interface Props {
  job: JobInfo;
  onChange: (next: JobInfo) => void;
}

const field =
  "w-full rounded-[14px] bg-[#0C0D12] px-3 py-2.5 text-base text-zinc-100 ring-1 ring-inset ring-white/15 placeholder:text-zinc-500 focus:ring-2 focus:ring-rose-500/40";

export function JobForm({ job, onChange }: Props) {
  const set = <K extends keyof JobInfo>(k: K, v: JobInfo[K]) => onChange({ ...job, [k]: v });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-100">
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
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-100">
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
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-100">
        Level
        <select className={field} value={job.level} onChange={(e) => set("level", e.target.value as Level)} name="level">
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-100">
        Job listing
        <textarea
          className={`${field} min-h-36 resize-y leading-relaxed`}
          value={job.listing}
          onChange={(e) => set("listing", e.target.value)}
          placeholder="Paste the responsibilities and requirements from the posting."
          name="listing"
        />
        <span className="text-xs font-normal text-zinc-400">{job.listing.trim().split(/\s+/).filter(Boolean).length} words</span>
      </label>
    </div>
  );
}
