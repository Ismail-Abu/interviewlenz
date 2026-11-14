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
