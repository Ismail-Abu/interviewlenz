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

export interface Session {
  sessionId: string;
  attemptId: string;
  priorAttemptId?: string;
  problemId: Problem["id"];
  turns: TranscriptTurn[];
  snapshots: CodeSnapshot[];
  runs: RunResult[];
}

export interface LiveTokenRequest { sessionId: string }
export interface LiveTokenResponse { token: string; model: string; expiresAt: string }

export type LiveState = "connecting" | "listening" | "speaking" | "idle" | "error";

export interface LiveClient {
  connect(token: LiveTokenResponse, problem: Problem): Promise<void>;
  startMic(): Promise<void>;
  stopMic(): void;
  sendCodeContext?(snapshot: CodeSnapshot): void;
  sendRunContext(snapshot: CodeSnapshot, result: RunResult): void;
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
  category: "correctness" | "clarification" | "approach" | "complexity" | "testing" | "code_clarity" | "spoken_reasoning";
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
