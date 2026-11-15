// Props for the application-first screens (presentation: Gemini #2; state and
// transitions: components/ProblemRoom.tsx). Presentation components are
// controlled: they render these props and call these callbacks, nothing else.
// They never call /api/interview-plan themselves.
import type { ApplicationTarget, BehavioralContext, InterviewPlan } from "@/lib/contract";
import type { PlanEdits } from "@/lib/plan";
import type { JobInfo, ResumeImage } from "../landing/profile";
import type { PracticeMode } from "../StartScreen";

// Everything the student entered in setup. Kept by ProblemRoom across failed
// analysis, Back, and fallback, so nothing has to be re-entered.
export interface ApplicationDraft {
  job: JobInfo; // company, role, level, listing (manual entry or pasted listing)
  resume: ResumeImage[]; // local previews; sent only via TailorPanel's own Prepare step
  resumeContext?: BehavioralContext; // confirmed in TailorPanel; undefined if none
}

export type SetupStatus =
  | { kind: "editing" }
  | { kind: "analyzing" } // disable inputs and the Analyze button; show progress
  | { kind: "fell-back"; message: string }; // research failed: inputs kept, plan built from the role

// One line of the "what will be sent" disclosure, computed from the actual
// request (sendPreview below), so copy can't drift from behavior.
export interface SendItem {
  destination: string;
  fields: string[];
}

export interface ApplicationSetupProps {
  draft: ApplicationDraft;
  onDraftChange: (draft: ApplicationDraft) => void;
  status: SetupStatus;
  sendPreview: SendItem[]; // render before the Analyze button
  canAnalyze: boolean; // role or listing present
  onAnalyze: () => void; // "Build my interview plan" (research + fallback)
  onBack: () => void; // to Home
  onQuickPractice: (mode: PracticeMode) => void; // secondary: standalone rounds
}

export interface PlanReviewProps {
  plan: InterviewPlan; // render themes with provenance; citations only for source "researched"
  application: ApplicationTarget; // for the header (company / role / level)
  onEdit: (edits: PlanEdits) => void; // remove a theme, edit or remove the behavioral focus
  onStart: () => void; // "Start technical round": freezes this revision
  onBack: () => void; // back to setup, inputs kept
  starting: boolean;
}

// What "Build my interview plan" sends, derived from the real request.
export function sendPreview(target: ApplicationTarget): SendItem[] {
  const r = target.roleContext;
  const fields = [
    r.company && "company",
    r.role && "role title",
    r.level && "level",
    r.jobDescription && `the job listing you pasted (${r.jobDescription.length.toLocaleString()} characters)`,
    target.resumeContext?.project && "the project you confirmed",
    target.resumeContext?.focus && "the practice focus you confirmed",
  ].filter((x): x is string => Boolean(x));
  return [
    { destination: "Interviewlenz plan research (Google Gemini, public web sources)", fields: fields.length ? fields : ["nothing yet"] },
    { destination: "Not sent", fields: ["resume images (only TailorPanel's Prepare step sends them, after its own notice)", "contact details"] },
  ];
}
