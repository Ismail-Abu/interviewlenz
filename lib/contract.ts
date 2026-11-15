export interface ApiError {
  code:
    | "syntax_error"
    | "timeout"
    | "runner_unavailable"
    | "provider_unavailable"
    | "invalid_request"
    | "unknown_problem";
  message: string;
  retryable: boolean;
  line?: number;
}

export interface TestCase {
  id: "c1" | "c2" | "c3" | "c4";
  args: unknown[];
  expected: unknown;
}

// Problem ids and their Python entry points. Both are unions so the bank can
// grow; every existing "contains-duplicate" usage still type-checks.
export type ProblemId =
  | "contains-duplicate"
  | "two-sum"
  | "valid-anagram"
  | "max-profit";

export type ProblemFunction =
  | "contains_duplicate"
  | "two_sum"
  | "is_anagram"
  | "max_profit";

export interface Problem {
  id: ProblemId;
  title: string;
  prompt: string;
  examples: { input: unknown; output: unknown; explanation?: string }[];
  constraints: string[];
  functionName: ProblemFunction;
  starterCode: string;
  cases: TestCase[];
}

export interface RunRequest {
  sessionId: string;
  problemId: Problem["id"];
  codeVersion: number;
  language: "python";
  source: string;
}

export interface CaseResult {
  caseId: TestCase["id"];
  input: string;
  expected: string;
  actual: string | null;
  pass: boolean;
  error?: string;
  stdout?: string;
}

interface RunMetadata {
  sessionId: string;
  problemId: Problem["id"];
  codeVersion: number;
  ranAt: string;
  durationMs: number;
}

export type RunResult = RunMetadata & (
  | { status: "completed"; cases: CaseResult[]; passed: number; total: number }
  | { status: "error"; error: ApiError }
);

export declare function preloadRunner(): Promise<void>;
export declare function runCode(req: RunRequest): Promise<RunResult>;

export interface TranscriptTurn {
  id: `t${number}`;
  speaker: "student" | "interviewer";
  text: string;
  at: string;
}

export interface CodeSnapshot {
  codeVersion: number;
  source: string;
  at: string;
}

// Interview round (PROPOSED with B10, pending Hamza's approval). Omitted means
// "coding", so existing callers, fixtures, and saved coding attempts keep their
// behavior. The coding problem ID and runner contract stay coding-only.
export type RoundType = "coding" | "behavioral";

interface SessionBase {
  sessionId: string;
  attemptId: string;
  priorAttemptId?: string;
  turns: TranscriptTurn[];
  // Optional target role from the landing setup (PROPOSED, pending Hamza's
  // approval). Absent when setup was skipped or left empty.
  roleContext?: RoleContext;
  // Application-first flow (PROPOSED): the plan this attempt ran with. Absent
  // for quick standalone practice. CodingSession.problemId must equal the
  // plan's technical.problemId for a technical round.
  plan?: PlanRef;
}

export interface CodingSession extends SessionBase {
  roundType?: "coding";
  problemId: Problem["id"];
  snapshots: CodeSnapshot[];
  runs: RunResult[];
}

// A behavioral round has no coding problem, code, snapshots, or runs: its only
// evidence is what the student said.
export interface BehavioralSession extends SessionBase {
  roundType: "behavioral";
  // The project and practice focus the student confirmed (B10 step 2). It
  // guides the question; it is never evidence of performance.
  behavioralContext?: BehavioralContext;
}

// Confirmed personalization for a behavioral round (PROPOSED with B10). Only
// what the student confirmed or typed: never original files, raw listings,
// contact details, or source excerpts. Servers validate and bound it
// (name/skill <= 80 chars, summary/detail <= 240).
export interface BehavioralContext {
  project?: { name: string; summary?: string };
  focus?: { skill: string; detail?: string };
}

// POST /api/analyze-tailoring (PROPOSED with B10). Sent only when the student
// selects "Prepare my interview". The complete serialized request must be at
// most 3,500,000 bytes (checked in the browser and on the server).
export type TailoringImageType = "image/png" | "image/jpeg" | "image/webp";
export interface TailoringRequest {
  images?: { mimeType: TailoringImageType; data: string }[]; // base64, at most 4 pages
  jobListing?: string; // at most 8,000 chars
  roleContext?: Pick<RoleContext, "company" | "role" | "level">;
}
// At most one suggestion of each kind; a field is omitted when unsupported.
// excerpt is a short verbatim source quote shown to the student only.
export interface TailoringSuggestion {
  project?: { name: string; summary?: string; excerpt: string };
  focus?: { skill: string; detail?: string; excerpt: string };
}
export interface TailoringResponse { suggestion: TailoringSuggestion }

export type Session = CodingSession | BehavioralSession;

// Optional target-role context the student typed on the landing page. It is
// user-provided data: it may shape the interviewer's framing and one relevant
// follow-up, never the problem, tests, rules, or Run evidence. Servers validate
// and bound it (company <= 80, role <= 100, jobDescription <= 4000 chars).
// Resume screenshots are never part of it.
export interface RoleContext {
  company?: string;
  role?: string;
  level?: "intern" | "new-grad" | "mid" | "senior";
  jobDescription?: string;
}

// roleContext (optional) is re-sent on every token request of an attempt,
// including Reconnect, so the locked interviewer instruction stays the same.
// roundType defaults to "coding"; "behavioral" selects the behavioral
// interviewer instruction locked into the token.
export interface LiveTokenRequest {
  sessionId: string;
  roleContext?: RoleContext;
  roundType?: RoundType;
  // Behavioral only: the confirmed personalization (re-sent on Reconnect).
  behavioralContext?: BehavioralContext;
}
export interface LiveTokenResponse { token: string; model: string; expiresAt: string }

export type LiveState = "connecting" | "listening" | "speaking" | "idle" | "error";

export interface LiveClient {
  // problem is required for a coding round and omitted for a behavioral round.
  connect(token: LiveTokenResponse, problem?: Problem): Promise<void>;
  startMic(): Promise<void>;
  stopMic(): void;
  sendRunContext(snapshot: CodeSnapshot, result: RunResult): void;
  // Make a code snapshot available to the model as silent context (initial sync
  // and paused-edit snapshots) WITHOUT requesting a spoken turn. Coalesced by
  // version; a newer snapshot supersedes an unsent older one. Optional so
  // existing clients (e.g. the scripted mock) stay valid without implementing it.
  syncCode?(snapshot: CodeSnapshot): void;
  end(): void;
  onState(cb: (state: LiveState) => void): void;
  onTurn(cb: (turn: TranscriptTurn) => void): void;
  onError(cb: (error: ApiError) => void): void;
}

export type EvidenceRef =
  | { kind: "turn"; turnId: TranscriptTurn["id"] }
  | { kind: "code"; codeVersion: number; lines?: [start: number, end: number] }
  | { kind: "run"; codeVersion: number; caseId?: TestCase["id"] };

export interface Finding {
  id: string;
  category:
    | "correctness"
    | "clarification"
    | "approach"
    | "complexity"
    | "testing"
    | "code_clarity"
    | "spoken_reasoning"
    // Behavioral rounds (evidence: student transcript turns only).
    | "specificity"
    | "personal_contribution"
    | "reasoning"
    | "outcome";
  rating: "strong" | "ok" | "needs_work" | "insufficient_evidence";
  summary: string;
  evidence: EvidenceRef[];
}

export interface ReportRequest { session: Session }
export interface Report {
  skillProof?: { signature: string; digest: string; explorerUrl: string };
  skillProofUnavailable?: boolean;
  reportId: string;
  sessionId: string;
  attemptId: string;
  findings: Finding[];
  nextStep: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Application-first flow (PROPOSED, feature/application-first-flow).
// Home -> What are you applying for? -> Review your interview plan ->
// Technical -> Behavioral -> Score and evidence.
//
// Two kinds of material, kept apart on purpose:
// - PRIVATE candidate material: the pasted listing (RoleContext.jobDescription)
//   and the resume context the student confirmed (BehavioralContext). Sent only
//   to our own routes, bounded by normalizeRoleContext / normalizeBehavioralContext.
// - PUBLIC research: citations to public pages about how a company interviews.
//   Only PlanCitation carries URLs; nothing private is ever stored in it.
// ---------------------------------------------------------------------------

// What the student is applying for, as confirmed in setup. Reuses the existing
// types: RoleContext (normalizeRoleContext) and BehavioralContext
// (normalizeBehavioralContext, from POST /api/analyze-tailoring + edits).
// Resume images never appear here; they go only to /api/analyze-tailoring.
export interface ApplicationTarget {
  roleContext: RoleContext; // company, role, level, jobDescription (pasted listing)
  resumeContext?: BehavioralContext; // candidate-confirmed project / focus
}

// Where a likely question theme came from. Private kinds name the source only;
// they never carry excerpts of the listing or resume.
export type ThemeProvenance =
  | { kind: "public-research"; citationIds: string[] } // ids in plan.citations
  | { kind: "job-listing" } // derived from the pasted listing (private)
  | { kind: "candidate-resume" } // derived from confirmed resume context (private)
  | { kind: "role-default" }; // generic for the role and level (fallback)

export interface PlanTheme {
  id: `th${number}`; // stable within a plan: th1, th2, ...
  round: "technical" | "behavioral";
  label: string; // <= 80 chars, e.g. "Hash-based lookups and duplicates"
  detail?: string; // <= 240 chars, why it is likely
  provenance: ThemeProvenance;
}

// A public source. Never private material: no listing text, no resume text.
export interface PlanCitation {
  id: `c${number}`; // c1, c2, ...
  title: string; // <= 160 chars
  url: string; // https only
  publisher?: string; // <= 80 chars
  retrievedAt: string; // ISO
}

export interface InterviewPlan {
  planId: string; // "plan_" + uuid; minted once, never changes for this plan
  revision: number; // 1 when created; +1 for each student edit before start
  createdAt: string; // ISO
  source: "researched" | "role-fallback";
  // Target WITHOUT the listing text: company, role, level only.
  target: Pick<RoleContext, "company" | "role" | "level">;
  technical: {
    problemId: Problem["id"]; // selected problem; one problem exists today
    themeIds: PlanTheme["id"][];
  };
  behavioral: {
    // Candidate-confirmed focus (private, from the resume context or typed).
    // Passed to the behavioral round as LiveTokenRequest.behavioralContext.
    focus?: BehavioralContext;
    themeIds: PlanTheme["id"][];
  };
  themes: PlanTheme[]; // at most 8
  citations: PlanCitation[]; // public research only; empty for role-fallback
  // Set when the plan is a fallback: why research was not used (shown to the student).
  fallbackReason?: "research_unavailable" | "not_configured" | "timeout" | "no_public_sources" | "manual";
}

// POST /api/interview-plan (Gemini #1). Server-side research; returns a
// researched plan, or a role-fallback plan when research is unavailable.
// Clients MUST also build a fallback themselves (lib/plan.ts buildFallbackPlan)
// on any error, timeout (20 s), 404, or zero-key 503, keeping the inputs.
// Request body <= 16 KB. Uploaded resume images are never sent here.
// PRIVACY: public web-search queries may use ONLY target company, role, and
// level. The listing text and resume context may inform themes server-side but
// never leave in a search query, and never appear in citations or logs.
export interface InterviewPlanRequest {
  application: ApplicationTarget;
}
export interface InterviewPlanResponse {
  plan: InterviewPlan;
}

// Which plan an attempt used. Frozen when the round starts: Reconnect, report
// retry, and reviewing an earlier attempt read THIS, not the latest plan.
// A student edit after a round started creates a new revision for later
// rounds only; the finished attempt keeps the revision it ran with.
export interface PlanRef {
  planId: InterviewPlan["planId"];
  revision: number;
  round: "technical" | "behavioral";
}
