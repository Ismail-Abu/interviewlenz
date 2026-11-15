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

export interface Problem {
  id: "contains-duplicate";
  title: string;
  prompt: string;
  examples: { input: unknown; output: unknown; explanation?: string }[];
  constraints: string[];
  functionName: "contains_duplicate";
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
  reportId: string;
  sessionId: string;
  attemptId: string;
  findings: Finding[];
  nextStep: string;
  createdAt: string;
}
