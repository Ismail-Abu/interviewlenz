import { GoogleGenAI, Type } from "@google/genai";
import type {
  ApiError,
  CaseResult,
  CodeSnapshot,
  EvidenceRef,
  Finding,
  Report,
  RunResult,
  Session,
  TestCase,
  TranscriptTurn,
} from "../../../lib/contract";
import { getProblem } from "../../../lib/problems";

// Runs on the default Node.js runtime so GEMINI_API_KEY stays server-side.

const CATEGORIES = [
  "correctness",
  "clarification",
  "approach",
  "complexity",
  "testing",
  "code_clarity",
  "spoken_reasoning",
] as const;
const RATINGS = ["strong", "ok", "needs_work", "insufficient_evidence"] as const;

type Category = (typeof CATEGORIES)[number];
type Rating = (typeof RATINGS)[number];

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Browser-facing errors are generic: provider details and credentials never
// leave the server, and nothing is logged.
const PROVIDER_UNAVAILABLE: ApiError = {
  code: "provider_unavailable",
  message: "Report provider unavailable",
  retryable: true,
};
// Missing key/model is a deployment setting, not a transient failure.
const NOT_CONFIGURED: ApiError = {
  code: "provider_unavailable",
  message: "Report provider not configured",
  retryable: false,
};
const INCOMPLETE: ApiError = {
  code: "provider_unavailable",
  message: "Report generation returned an incomplete result. Try again.",
  retryable: true,
};
const TIMED_OUT: ApiError = { code: "timeout", message: "Report generation timed out. Try again.", retryable: true };

// Bounds on the public request (cost and prompt size). Generous for a real
// 10-minute attempt; anything larger is rejected before any provider call.
const LIMITS = {
  bodyBytes: 256_000,
  idChars: 128,
  turns: 400,
  turnChars: 4_000,
  snapshots: 200,
  runs: 200,
  sourceChars: 20_000,
  casesPerRun: 20,
  fieldChars: 2_000,
};
const PROVIDER_TIMEOUT_MS = Number(process.env.REPORT_TIMEOUT_MS) || 25_000;
const MAX_FINDINGS = 7;
const MAX_SUMMARY_CHARS = 400;

function invalid(message: string, code: ApiError["code"] = "invalid_request"): Response {
  const error: ApiError = { code, message, retryable: false };
  return json(error, 400);
}

const isStr = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

// Full structural check of the Session (lib/contract.ts) so a malformed element
// is a 400 here, never an exception later or a paid provider call.
function checkSession(s: unknown): string | null {
  if (!s || typeof s !== "object") return "session is required";
  const o = s as Record<string, unknown>;
  for (const k of ["sessionId", "attemptId", "problemId"]) {
    if (!isStr(o[k], LIMITS.idChars) || (o[k] as string).length === 0) return `session.${k} must be a non-empty string`;
  }
  if (!Array.isArray(o.turns) || !Array.isArray(o.snapshots) || !Array.isArray(o.runs)) {
    return "session.turns, session.snapshots, and session.runs must be arrays";
  }
  if (o.turns.length > LIMITS.turns) return `session.turns exceeds ${LIMITS.turns}`;
  if (o.snapshots.length > LIMITS.snapshots) return `session.snapshots exceeds ${LIMITS.snapshots}`;
  if (o.runs.length > LIMITS.runs) return `session.runs exceeds ${LIMITS.runs}`;
  const ids = new Set<string>();
  for (const [i, t] of (o.turns as unknown[]).entries()) {
    const x = t as Record<string, unknown> | null;
    if (!x || typeof x !== "object") return `session.turns[${i}] must be an object`;
    if (typeof x.id !== "string" || !/^t\d{1,6}$/.test(x.id)) return `session.turns[${i}].id must look like t1`;
    if (ids.has(x.id)) return `session.turns[${i}].id is duplicated`;
    ids.add(x.id);
    if (x.speaker !== "student" && x.speaker !== "interviewer") return `session.turns[${i}].speaker is invalid`;
    if (!isStr(x.text, LIMITS.turnChars)) return `session.turns[${i}].text is missing or too long`;
    if (!isStr(x.at, 64)) return `session.turns[${i}].at must be a timestamp`;
  }
  for (const [i, sn] of (o.snapshots as unknown[]).entries()) {
    const x = sn as Record<string, unknown> | null;
    if (!x || typeof x !== "object") return `session.snapshots[${i}] must be an object`;
    if (!isInt(x.codeVersion)) return `session.snapshots[${i}].codeVersion must be an integer`;
    if (!isStr(x.source, LIMITS.sourceChars)) return `session.snapshots[${i}].source is missing or too long`;
    if (!isStr(x.at, 64)) return `session.snapshots[${i}].at must be a timestamp`;
  }
  for (const [i, r] of (o.runs as unknown[]).entries()) {
    const x = r as Record<string, unknown> | null;
    if (!x || typeof x !== "object") return `session.runs[${i}] must be an object`;
    if (!isInt(x.codeVersion)) return `session.runs[${i}].codeVersion must be an integer`;
    if (x.ranAt !== undefined && !isStr(x.ranAt, 64)) return `session.runs[${i}].ranAt must be a timestamp`;
    if (x.status === "completed") {
      if (!isInt(x.passed) || !isInt(x.total)) return `session.runs[${i}] needs passed and total`;
      if (!Array.isArray(x.cases) || x.cases.length > LIMITS.casesPerRun) return `session.runs[${i}].cases must be an array`;
      for (const [j, c] of (x.cases as unknown[]).entries()) {
        const y = c as Record<string, unknown> | null;
        if (!y || typeof y !== "object") return `session.runs[${i}].cases[${j}] must be an object`;
        if (!isStr(y.caseId, 16) || !isStr(y.input, LIMITS.fieldChars) || !isStr(y.expected, LIMITS.fieldChars)) {
          return `session.runs[${i}].cases[${j}] needs caseId, input, expected`;
        }
        if (!(y.actual === null || isStr(y.actual, LIMITS.fieldChars)) || typeof y.pass !== "boolean") {
          return `session.runs[${i}].cases[${j}] needs actual and pass`;
        }
        if (y.error !== undefined && !isStr(y.error, LIMITS.fieldChars)) return `session.runs[${i}].cases[${j}].error is too long`;
      }
    } else if (x.status === "error") {
      const e = x.error as Record<string, unknown> | null;
      if (!e || typeof e !== "object" || !isStr(e.code, 64) || !isStr(e.message, LIMITS.fieldChars)) {
        return `session.runs[${i}].error needs code and message`;
      }
    } else {
      return `session.runs[${i}].status must be completed or error`;
    }
  }
  return null;
}

function numberLines(source: string): string {
  const rows = source.split("\n");
  const width = String(rows.length).length;
  return rows.map((line, i) => `${String(i + 1).padStart(width)}  ${line}`).join("\n");
}

function lineCount(source: string): number {
  return source.split("\n").length;
}

// The model returns findings + nextStep; the server fills ids/timestamps and
// validates evidence, so the evidence items are kept loose here and normalized
// afterwards.
interface RawEvidence {
  kind?: string;
  turnId?: string;
  codeVersion?: number;
  caseId?: string;
  lineStart?: number;
  lineEnd?: number;
}
interface RawFinding {
  category?: string;
  rating?: string;
  summary?: string;
  evidence?: RawEvidence[];
}
interface RawReport {
  findings?: RawFinding[];
  nextStep?: string;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, enum: [...CATEGORIES] },
          rating: { type: Type.STRING, enum: [...RATINGS] },
          summary: { type: Type.STRING },
          evidence: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                kind: { type: Type.STRING, enum: ["turn", "code", "run"] },
                turnId: { type: Type.STRING },
                codeVersion: { type: Type.INTEGER },
                caseId: { type: Type.STRING },
                lineStart: { type: Type.INTEGER },
                lineEnd: { type: Type.INTEGER },
              },
              required: ["kind"],
              propertyOrdering: ["kind", "turnId", "codeVersion", "caseId", "lineStart", "lineEnd"],
            },
          },
        },
        required: ["category", "rating", "summary", "evidence"],
        propertyOrdering: ["category", "rating", "summary", "evidence"],
      },
    },
    nextStep: { type: Type.STRING },
  },
  required: ["findings", "nextStep"],
  propertyOrdering: ["findings", "nextStep"],
};

const SYSTEM_INSTRUCTION = [
  "You are an expert technical-interview evaluator. You are given a completed coding-interview attempt and must return a structured report as JSON only.",
  "",
  "Rubric categories (use only these): correctness (does the final code solve the problem), clarification (did they clarify requirements and edge cases), approach (soundness of the chosen strategy), complexity (accuracy of their time/space reasoning vs the code), testing (did the tests and failures inform them), code_clarity (readability of the code), spoken_reasoning (does what they SAID match what the code actually DOES).",
  "Ratings: strong, ok, needs_work, insufficient_evidence.",
  "",
  "Rules:",
  "- Produce findings across the categories the evidence supports; you do not need all seven. Prefer the ones with real signal.",
  "- Every finding must cite at least one real piece of evidence, OR be rated insufficient_evidence with an empty evidence array. Never invent evidence.",
  "- Evidence kinds and the ONLY valid identifiers:",
  "  - turn: turnId must be one of the transcript turn IDs listed below.",
  "  - code: codeVersion must be one of the snapshot versions listed; optionally lineStart/lineEnd within that snapshot.",
  "  - run: codeVersion must be one of the run versions listed; optional caseId must be one of that run's case IDs.",
  "- spoken_reasoning must explicitly judge whether the student's spoken claims match what the code does (e.g. a 'linear time' claim on a nested loop is needs_work). Cite the STUDENT turn where the claim was made; never cite an interviewer turn as the student's words.",
  "- Everything below is listed in time order with timestamps. Distinguish an earlier claim or implementation from a later improvement: describe the earlier state and the later one separately (separate findings, or one finding that names both), each citing the evidence from that point in time (the student turn for a claim, the code version for an implementation, the run for its results). Never credit an earlier version with a later fix, or blame a later version for an earlier mistake.",
  "- Only describe what the student said if it appears in the transcript. If no transcript was captured, rate spoken_reasoning and clarification insufficient_evidence and do not describe anything the student said.",
  "- Each summary is one or two sentences.",
  "- nextStep is one concrete thing the student should practice next.",
  "Return JSON matching the provided schema. No prose outside the JSON.",
].join("\n");

function buildPrompt(session: Session): string {
  const problem = getProblem(session.problemId);
  const parts: string[] = [];
  parts.push(`Problem: ${problem ? `${problem.title} — ${problem.prompt}` : session.problemId}`);
  if (problem) parts.push(`Function: ${problem.functionName}`);

  parts.push("\n=== Transcript turns (cite with kind:turn, turnId) ===");
  if (session.turns.length === 0) parts.push("(none) No transcript was captured for this attempt. Do not describe anything the student said.");
  for (const t of session.turns as TranscriptTurn[]) {
    parts.push(`${t.id} (${t.speaker}) @ ${t.at}: ${t.text}`);
  }

  parts.push("\n=== Code snapshots (cite with kind:code, codeVersion) ===");
  if (session.snapshots.length === 0) parts.push("(none)");
  for (const s of session.snapshots as CodeSnapshot[]) {
    parts.push(`codeVersion ${s.codeVersion} @ ${s.at}:\n${numberLines(s.source)}`);
  }

  parts.push("\n=== Runs (cite with kind:run, codeVersion, optional caseId) ===");
  if (session.runs.length === 0) parts.push("(none)");
  for (const r of session.runs as RunResult[]) {
    if (r.status === "completed") {
      parts.push(`codeVersion ${r.codeVersion} ran @ ${r.ranAt}: completed ${r.passed}/${r.total} passed`);
      for (const c of r.cases) {
        parts.push(
          `  ${c.caseId}: ${c.pass ? "PASS" : "FAIL"} | input ${c.input} | expected ${c.expected} | actual ${c.actual ?? "null"}${c.error ? ` | error ${c.error}` : ""}`,
        );
      }
    } else {
      parts.push(
        `codeVersion ${r.codeVersion} ran @ ${r.ranAt}: error ${r.error.code}${r.error.line ? ` (line ${r.error.line})` : ""}: ${r.error.message}`,
      );
    }
  }

  return parts.join("\n");
}

// --- evidence validation -------------------------------------------------
function buildValidators(session: Session) {
  const turnIds = new Set<string>((session.turns as TranscriptTurn[]).map((t) => t.id));
  const studentTurnIds = new Set<string>(
    (session.turns as TranscriptTurn[]).filter((t) => t.speaker === "student").map((t) => t.id),
  );
  const snapshotVersions = new Map<number, number>(); // version -> line count
  for (const s of session.snapshots as CodeSnapshot[]) snapshotVersions.set(s.codeVersion, lineCount(s.source));
  const runCaseIds = new Map<number, Set<string>>(); // version -> caseIds
  const runVersions = new Set<number>();
  for (const r of session.runs as RunResult[]) {
    runVersions.add(r.codeVersion);
    const ids = runCaseIds.get(r.codeVersion) ?? new Set<string>();
    if (r.status === "completed") for (const c of r.cases as CaseResult[]) ids.add(c.caseId);
    runCaseIds.set(r.codeVersion, ids);
  }
  // A code citation must point at a captured snapshot: that is what the report
  // view opens (a run-only version has no source to show).
  const codeVersions = new Set<number>(snapshotVersions.keys());
  return { turnIds, studentTurnIds, snapshotVersions, codeVersions, runVersions, runCaseIds };
}

function validateEvidence(
  raw: unknown,
  v: ReturnType<typeof buildValidators>,
  category: Category,
): EvidenceRef[] {
  const out: EvidenceRef[] = [];
  const seen = new Set<string>();
  const push = (ref: EvidenceRef) => {
    const key = JSON.stringify(ref);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(ref);
    }
  };
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const e = item as RawEvidence;
    if (e.kind === "turn") {
      // spoken_reasoning is about what the STUDENT said.
      const allowed = category === "spoken_reasoning" ? v.studentTurnIds : v.turnIds;
      if (typeof e.turnId === "string" && allowed.has(e.turnId)) {
        push({ kind: "turn", turnId: e.turnId as TranscriptTurn["id"] });
      }
    } else if (e.kind === "code") {
      if (typeof e.codeVersion === "number" && v.codeVersions.has(e.codeVersion)) {
        const ref: EvidenceRef = { kind: "code", codeVersion: e.codeVersion };
        const max = v.snapshotVersions.get(e.codeVersion) ?? 0;
        // Keep a line range only if it lies inside that snapshot.
        if (isInt(e.lineStart) && isInt(e.lineEnd) && e.lineStart >= 1 && e.lineStart <= e.lineEnd && e.lineEnd <= max) {
          ref.lines = [e.lineStart, e.lineEnd];
        }
        push(ref);
      }
    } else if (e.kind === "run") {
      if (typeof e.codeVersion === "number" && v.runVersions.has(e.codeVersion)) {
        const ref: EvidenceRef = { kind: "run", codeVersion: e.codeVersion };
        if (typeof e.caseId === "string" && v.runCaseIds.get(e.codeVersion)?.has(e.caseId)) {
          ref.caseId = e.caseId as TestCase["id"];
        }
        push(ref);
      }
    }
  }
  return out;
}

// Categories that can only be judged from what the student said.
const SPEECH_CATEGORIES: ReadonlySet<Category> = new Set<Category>(["spoken_reasoning", "clarification"]);
const NO_TRANSCRIPT_SUMMARY = "No transcript was captured, so this can't be assessed from what was said.";

function normalizeFindings(raw: unknown, v: ReturnType<typeof buildValidators>): Finding[] {
  const findings: Finding[] = [];
  if (!Array.isArray(raw)) return findings;
  const hasStudentSpeech = v.studentTurnIds.size > 0;
  let n = 0;
  for (const item of raw) {
    if (findings.length >= MAX_FINDINGS) break;
    if (!item || typeof item !== "object") continue;
    const f = item as RawFinding;
    if (!CATEGORIES.includes(f.category as Category) || !RATINGS.includes(f.rating as Rating)) continue;
    if (typeof f.summary !== "string" || f.summary.trim() === "") continue;
    const category = f.category as Category;
    let summary = f.summary.trim().slice(0, MAX_SUMMARY_CHARS);
    let rating = f.rating as Rating;
    let evidence = rating === "insufficient_evidence" ? [] : validateEvidence(f.evidence, v, category);

    // Without a transcript, never present speech-based feedback.
    if (!hasStudentSpeech && SPEECH_CATEGORIES.has(category)) {
      rating = "insufficient_evidence";
      evidence = [];
      summary = NO_TRANSCRIPT_SUMMARY;
    }
    // A non-insufficient finding with no surviving evidence is downgraded.
    if (rating !== "insufficient_evidence" && evidence.length === 0) {
      rating = "insufficient_evidence";
      evidence = [];
    }
    n += 1;
    findings.push({ id: `f${n}`, category, rating, summary, evidence });
  }
  return findings;
}

export async function POST(request: Request): Promise<Response> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > LIMITS.bodyBytes) return invalid("Request body is too large");
  let session: Session;
  try {
    const raw = await request.text();
    if (raw.length > LIMITS.bodyBytes) return invalid("Request body is too large");
    const body = JSON.parse(raw) as { session?: unknown } | null;
    const problem = checkSession(body?.session);
    if (problem) return invalid(problem);
    session = body!.session as Session;
  } catch {
    return invalid("Request body must be JSON containing a session");
  }
  if (!getProblem(session.problemId)) return invalid(`Unknown problem: ${session.problemId.slice(0, 64)}`, "unknown_problem");

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.REPORT_MODEL;
  if (!apiKey || !model) return json(NOT_CONFIGURED, 503);

  // One generation call per request, bounded in time. The SDK timeout and the
  // abort signal stop the HTTP call; the race guarantees a timely response.
  let text: string | undefined;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, PROVIDER_TIMEOUT_MS);
  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: PROVIDER_TIMEOUT_MS } });
    const call = ai.models.generateContent({
      model,
      contents: buildPrompt(session),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.3,
        abortSignal: controller.signal,
      },
    });
    const timeout = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("timeout"))));
    text = (await Promise.race([call, timeout])).text;
  } catch {
    return json(timedOut ? TIMED_OUT : PROVIDER_UNAVAILABLE, 503);
  } finally {
    clearTimeout(timer);
  }

  // Malformed or incomplete model output is never turned into feedback.
  let parsed: RawReport | null;
  try {
    parsed = text ? (JSON.parse(text) as RawReport | null) : null;
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== "object") return json(INCOMPLETE, 503);
  const validators = buildValidators(session);
  const findings = normalizeFindings(parsed.findings, validators);
  const nextStep = typeof parsed.nextStep === "string" ? parsed.nextStep.trim().slice(0, MAX_SUMMARY_CHARS) : "";
  if (findings.length === 0 || nextStep === "") return json(INCOMPLETE, 503);

  const report: Report = {
    reportId: `report-${session.attemptId.slice(0, 8)}-${Date.now().toString(36)}`,
    sessionId: session.sessionId,
    attemptId: session.attemptId,
    findings,
    nextStep,
    createdAt: new Date().toISOString(),
  };

  return json(report, 200);
}
