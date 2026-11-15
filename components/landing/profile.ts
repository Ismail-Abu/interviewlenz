// What the student tells us on the landing page. Frontend-only: it stays in
// this browser tab and is never sent to /api/live-token, /api/report, or the
// Live session. The contract (lib/contract.ts, docs/CONTRACT.md) has no resume
// or job fields, and job/resume tailoring is a labeled preview (CURRENT.md,
// "Mocked for demo").

export interface ResumeImage {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string; // object URL for the preview; revoked when removed
}

export type Level = "" | "intern" | "new-grad" | "mid" | "senior";

export interface JobInfo {
  company: string;
  role: string;
  level: Level;
  listing: string;
}

export interface CandidateProfile {
  resume: ResumeImage[];
  job: JobInfo;
}

export const EMPTY_JOB: JobInfo = { company: "", role: "", level: "", listing: "" };

export const LEVELS: { value: Level; label: string }[] = [
  { value: "", label: "Select level" },
  { value: "intern", label: "Internship" },
  { value: "new-grad", label: "New grad / entry" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
];

export const RESUME_LIMITS = {
  maxFiles: 6,
  maxBytes: 10 * 1024 * 1024,
  types: ["image/png", "image/jpeg", "image/webp"],
} as const;

export function hasJob(job: JobInfo) {
  return Boolean(job.company.trim() || job.role.trim() || job.listing.trim());
}

export type RoundKind = "coding" | "behavioral" | "fundamentals" | "system-design";

export interface PlannedRound {
  kind: RoundKind;
  title: string;
  live: boolean; // only the coding round runs today
  why: string;
  goodLooksLike: string[];
}

// Criteria from the project brief ("What is a good interview").
const ROUNDS: Record<RoundKind, Omit<PlannedRound, "why">> = {
  coding: {
    kind: "coding",
    title: "Coding",
    live: true,
    goodLooksLike: [
      "Clarify inputs and edge cases first",
      "State an approach before writing code",
      "Talk while you code; justify time and space",
    ],
  },
  behavioral: {
    kind: "behavioral",
    title: "Behavioral",
    live: false,
    goodLooksLike: ["STAR: situation, task, action, result", "About 1–2 minutes per answer", "Specific numbers and outcomes"],
  },
  fundamentals: {
    kind: "fundamentals",
    title: "CS fundamentals",
    live: false,
    goodLooksLike: ["Precise explanations, no hand-waving", "One level deeper on follow-ups", "Design choices in your projects"],
  },
  "system-design": {
    kind: "system-design",
    title: "System design",
    live: false,
    goodLooksLike: ["Requirements and scale first", "Components, data model, APIs", "Name tradeoffs and alternatives"],
  },
};

const SYSTEM_DESIGN_HINTS = /\b(system design|distributed|scalab|architect|microservice|high[- ]availability|throughput)\w*/i;

// A simple, transparent preview of the loop a role might run. Not a model call;
// labeled as a preview in the UI.
export function previewLoop(job: JobInfo): PlannedRound[] {
  const text = `${job.role} ${job.listing}`;
  const rounds: PlannedRound[] = [
    { ...ROUNDS.coding, why: "Every software role screens with a coding problem." },
    { ...ROUNDS.behavioral, why: "Nearly every loop includes a teamwork and ownership conversation." },
  ];
  if (job.level !== "senior") {
    rounds.push({ ...ROUNDS.fundamentals, why: "Common for internship and early-career roles." });
  }
  if (job.level === "senior" || job.level === "mid" || SYSTEM_DESIGN_HINTS.test(text)) {
    rounds.push({
      ...ROUNDS["system-design"],
      why: SYSTEM_DESIGN_HINTS.test(text) ? "The listing mentions architecture or scale." : "Expected at this level.",
    });
  }
  return rounds;
}
