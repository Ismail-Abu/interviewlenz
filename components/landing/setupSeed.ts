// Hands a role preset picked on the homepage to the setup screen. The setup
// draft is owned by ProblemRoom, and the homepage only calls onApply(), so the
// pick is kept for this browser tab (sessionStorage) and read once by
// ApplicationSetup, which applies it only if the student hasn't typed a role.
import type { JobInfo } from "./profile";

const KEY = "interviewlenz:setup-seed";

export function writeSetupSeed(job: JobInfo): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ company: job.company, role: job.role, level: job.level }));
  } catch {
    // Storage blocked: the student can pick the preset again in setup.
  }
}

// Read and clear. Returns only the three preset fields, validated.
export function takeSetupSeed(): Pick<JobInfo, "company" | "role" | "level"> | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Record<string, unknown>;
    const levels = ["", "intern", "new-grad", "mid", "senior"];
    if (typeof v.company !== "string" || typeof v.role !== "string" || typeof v.level !== "string" || !levels.includes(v.level)) return null;
    return { company: v.company.slice(0, 80), role: v.role.slice(0, 100), level: v.level as JobInfo["level"] };
  } catch {
    return null;
  }
}
