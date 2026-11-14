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

const PROVIDER_UNAVAILABLE: ApiError = {
  code: "provider_unavailable",
  message: "Report provider unavailable",
  retryable: true,
};

function invalid(message: string): Response {
  const error: ApiError = { code: "invalid_request", message, retryable: false };
  return json(error, 400);
}

function isSession(value: unknown): value is Session {
  const s = value as Session | null;
  return (
    !!s &&
    typeof s === "object" &&
    typeof s.sessionId === "string" &&
    typeof s.attemptId === "string" &&
    typeof s.problemId === "string" &&
    Array.isArray(s.turns) &&
    Array.isArray(s.snapshots) &&
    Array.isArray(s.runs)
  );
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
  "- spoken_reasoning must explicitly judge whether the student's spoken claims match what the code does (e.g. a 'linear time' claim on a nested loop is needs_work).",
  "- Each summary is one or two sentences.",
  "- nextStep is one concrete thing the student should practice next.",
  "Return JSON matching the provided schema. No prose outside the JSON.",
].join("\n");

function buildPrompt(session: Session): string {
  const problem = getProblem(session.problemId);
  const parts: string[] = [];
  parts.push(`Problem: ${problem ? `${problem.title} — ${problem.prompt}` : session.problemId}`);
  if (problem) parts.push(`Function: ${problem.functionName}`);

  parts.push("\n=== Transcript turns ===");
  if (session.turns.length === 0) parts.push("(none)");
  for (const t of session.turns as TranscriptTurn[]) {
    parts.push(`${t.id} (${t.speaker}) @ ${t.at}: ${t.text}`);
  }

  parts.push("\n=== Code snapshots (cite with kind:code, codeVersion) ===");
  if (session.snapshots.length === 0) parts.push("(none)");
  for (const s of session.snapshots as CodeSnapshot[]) {
    parts.push(`codeVersion ${s.codeVersion}:\n${numberLines(s.source)}`);
  }

  parts.push("\n=== Runs (cite with kind:run, codeVersion, optional caseId) ===");
  if (session.runs.length === 0) parts.push("(none)");
  for (const r of session.runs as RunResult[]) {
    if (r.status === "completed") {
      parts.push(`codeVersion ${r.codeVersion}: completed ${r.passed}/${r.total} passed`);
      for (const c of r.cases) {
        parts.push(
          `  ${c.caseId}: ${c.pass ? "PASS" : "FAIL"} | input ${c.input} | expected ${c.expected} | actual ${c.actual ?? "null"}${c.error ? ` | error ${c.error}` : ""}`,
        );
      }
    } else {
      parts.push(
        `codeVersion ${r.codeVersion}: error ${r.error.code}${r.error.line ? ` (line ${r.error.line})` : ""}: ${r.error.message}`,
      );
    }
  }

  return parts.join("\n");
}

// --- evidence validation -------------------------------------------------
function buildValidators(session: Session) {
  const turnIds = new Set<string>((session.turns as TranscriptTurn[]).map((t) => t.id));
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
  // A code citation may point at any version the attempt produced (snapshot or run).
  const codeVersions = new Set<number>([...snapshotVersions.keys(), ...runVersions]);
  return { turnIds, snapshotVersions, codeVersions, runVersions, runCaseIds };
}

function validateEvidence(raw: RawEvidence[] | undefined, v: ReturnType<typeof buildValidators>): EvidenceRef[] {
  const out: EvidenceRef[] = [];
  for (const e of raw ?? []) {
    if (e.kind === "turn") {
      if (typeof e.turnId === "string" && v.turnIds.has(e.turnId)) {
        out.push({ kind: "turn", turnId: e.turnId as TranscriptTurn["id"] });
      }
    } else if (e.kind === "code") {
      if (typeof e.codeVersion === "number" && v.codeVersions.has(e.codeVersion)) {
        const ref: EvidenceRef = { kind: "code", codeVersion: e.codeVersion };
        const max = v.snapshotVersions.get(e.codeVersion);
        if (typeof e.lineStart === "number" && typeof e.lineEnd === "number" && e.lineStart >= 1 && e.lineStart <= e.lineEnd) {
          const end = max ? Math.min(e.lineEnd, max) : e.lineEnd;
          ref.lines = [e.lineStart, end];
        }
        out.push(ref);
      }
    } else if (e.kind === "run") {
      if (typeof e.codeVersion === "number" && v.runVersions.has(e.codeVersion)) {
        const ref: EvidenceRef = { kind: "run", codeVersion: e.codeVersion };
        if (typeof e.caseId === "string" && v.runCaseIds.get(e.codeVersion)?.has(e.caseId)) {
          ref.caseId = e.caseId as TestCase["id"];
        }
        out.push(ref);
      }
    }
  }
  return out;
}

function normalizeFindings(raw: RawFinding[] | undefined, v: ReturnType<typeof buildValidators>): Finding[] {
  const findings: Finding[] = [];
  let n = 0;
  for (const f of raw ?? []) {
    if (!CATEGORIES.includes(f.category as Category) || !RATINGS.includes(f.rating as Rating)) continue;
    if (typeof f.summary !== "string" || f.summary.trim() === "") continue;

    let rating = f.rating as Rating;
    let evidence = rating === "insufficient_evidence" ? [] : validateEvidence(f.evidence, v);
    // A non-insufficient finding with no surviving evidence is downgraded.
    if (rating !== "insufficient_evidence" && evidence.length === 0) {
      rating = "insufficient_evidence";
      evidence = [];
    }
    n += 1;
    findings.push({ id: `f${n}`, category: f.category as Category, rating, summary: f.summary.trim(), evidence });
  }
  return findings;
}

export async function POST(request: Request): Promise<Response> {
  let session: unknown;
  try {
    const body = (await request.json()) as { session?: unknown };
    session = body?.session;
  } catch {
    return invalid("Request body must be JSON containing a session");
  }
  if (!isSession(session)) {
    return invalid("session is required and must include sessionId, attemptId, problemId, turns, snapshots, runs");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.REPORT_MODEL;
  if (!apiKey || !model) return json(PROVIDER_UNAVAILABLE, 503);

  let parsed: RawReport;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: buildPrompt(session),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.3,
      },
    });
    const text = response.text;
    if (!text) return json(PROVIDER_UNAVAILABLE, 503);
    parsed = JSON.parse(text) as RawReport;
  } catch {
    return json(PROVIDER_UNAVAILABLE, 503);
  }

  const validators = buildValidators(session);
  const findings = normalizeFindings(parsed.findings, validators);
  const nextStep =
    typeof parsed.nextStep === "string" && parsed.nextStep.trim() !== ""
      ? parsed.nextStep.trim()
      : "Re-run the interview and narrate your complexity reasoning as you code.";

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
