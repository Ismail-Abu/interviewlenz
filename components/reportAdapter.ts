import type { ApiError, BehavioralSession, CodingSession, EvidenceRef, Finding, Report, Session } from "@/lib/contract";
import { BEHAVIORAL_CATEGORIES, isBehavioralSession } from "@/lib/behavioral";
import reportFixture from "@/fixtures/report.json";
import { detectApproach } from "./liveAdapter";

// The only place the UI requests a report. Never throws.
//
// "auto" (default) POSTs {session} to /api/report and only falls back to
// fixtures/report.json (labeled FIXTURE DATA) when there is no real report
// service: the route says it is not configured (503, retryable:false) or the
// route is missing (404 / not an API response). That keeps the zero-key demo.
// A real failure (provider error or timeout, retryable:true; network error)
// is returned as an error so the UI shows Retry report for the same attempt,
// and an invalid request (400) is an error too: never fixture feedback.
// Dev-only modes: "fixture" skips the route; "fixture-error" simulates a 503
// on the first request for each attempt so Retry report can be exercised;
// "api" calls the route and surfaces its error without falling back.
export type ReportMode = "auto" | "fixture" | "fixture-error" | "api";
export const DEFAULT_REPORT_MODE: ReportMode = "auto";

export type ReportOutcome =
  | { ok: true; report: Report; fromFixture: boolean; fallbackReason?: string }
  | { ok: false; error: ApiError };

const failedOnce = new Set<string>();

const UNAVAILABLE: ApiError = {
  code: "provider_unavailable",
  message: "Report provider unavailable",
  retryable: true,
};

export async function requestReport(session: Session, mode: ReportMode = DEFAULT_REPORT_MODE): Promise<ReportOutcome> {
  if (mode === "api") return toOutcome(await postReport(session));
  if (mode === "auto") {
    const real = await postReport(session);
    if (real.kind === "not-configured" || real.kind === "route-missing") {
      await delay(400);
      return {
        ok: true,
        report: fixtureForSession(session),
        fromFixture: true,
        fallbackReason: real.kind === "not-configured" ? "no API key" : "report service unavailable",
      };
    }
    return toOutcome(real);
  }
  await delay(900);
  if (mode === "fixture-error" && !failedOnce.has(session.attemptId)) {
    failedOnce.add(session.attemptId);
    return { ok: false, error: UNAVAILABLE };
  }
  return { ok: true, report: fixtureForSession(session), fromFixture: true };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// What the report route said, classified for the fallback decision.
type RouteResult =
  | { kind: "report"; report: Report }
  | { kind: "not-configured" } // 503, retryable:false: no real service here
  | { kind: "route-missing" } // 404 or not an API response: no real service here
  | { kind: "error"; error: ApiError }; // real failure or invalid request

const NETWORK: ApiError = {
  code: "provider_unavailable",
  message: "Couldn't reach the report service. Check your connection and try again.",
  retryable: true,
};

function isApiError(v: unknown): v is ApiError {
  const e = v as ApiError | null;
  return !!e && typeof e === "object" && typeof e.code === "string" && typeof e.message === "string" && typeof e.retryable === "boolean";
}

async function postReport(session: Session): Promise<RouteResult> {
  let res: Response;
  try {
    res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session }),
    });
  } catch {
    return { kind: "error", error: NETWORK }; // offline or dropped: retry the same attempt
  }
  const body = await res.json().catch(() => null);
  if (res.ok && body && Array.isArray(body.findings)) return { kind: "report", report: body as Report };
  if (isApiError(body)) {
    if (res.status === 503 && body.code === "provider_unavailable" && body.retryable === false) return { kind: "not-configured" };
    return { kind: "error", error: body };
  }
  if (res.status === 404) return { kind: "route-missing" };
  // Any other non-API response (e.g. a platform error page) is a transient failure.
  return { kind: "error", error: UNAVAILABLE };
}

function toOutcome(r: RouteResult): ReportOutcome {
  if (r.kind === "report") return { ok: true, report: r.report, fromFixture: false };
  if (r.kind === "error") return { ok: false, error: r.error };
  // Only reachable in "api" mode, which never falls back.
  return {
    ok: false,
    error:
      r.kind === "not-configured"
        ? { code: "provider_unavailable", message: "Report provider not configured", retryable: false }
        : { code: "provider_unavailable", message: "Report service not found", retryable: false },
  };
}

// Build the fixture report for this attempt. The real sessionId and attemptId
// are echoed. The fixture's evidence (t1, code v3, run v4 c1) is pointed at
// the matching items in this attempt so the links resolve:
// - turn: the first student turn that talks about a set, else the first student turn
// - code: the latest fully passing run's snapshot
// - run:  the first failing run and case
// When the attempt has no failing run but passed with a nested loop (the demo
// story), the testing finding becomes a complexity finding citing that run,
// its code, and the turn claiming it was linear. A finding with nothing to
// cite becomes insufficient_evidence with no refs, the only rating the
// contract allows to be empty.
function fixtureForSession(session: Session): Report {
  return isBehavioralSession(session) ? behavioralFixture(session) : fixtureFor(session);
}

// Labeled sample report for a behavioral attempt (zero-key demo). It cites only
// this attempt's real student turns; without any, every category says so.
function behavioralFixture(session: BehavioralSession): Report {
  const student = session.turns.filter((t) => t.speaker === "student");
  const cite = (i: number) => (student[i] ? [{ kind: "turn" as const, turnId: student[i].id }] : []);
  const plan: [string, Finding["rating"], string, EvidenceRef[]][] = [
    ["specificity", "ok", "Sample finding: you named a concrete system in your answer.", cite(0)],
    ["personal_contribution", "needs_work", "Sample finding: say what you personally did, not only what the team did.", cite(0)],
    ["reasoning", "insufficient_evidence", "Sample finding: explain why you chose that action over an alternative.", []],
    ["outcome", "ok", "Sample finding: you described the change you made.", cite(student.length - 1)],
  ];
  const findings: Finding[] = BEHAVIORAL_CATEGORIES.map((category, i) => {
    const [, rating, summary, evidence] = plan[i];
    const ok = evidence.length > 0 || rating === "insufficient_evidence";
    return {
      id: `f${i + 1}`,
      category,
      rating: ok ? rating : "insufficient_evidence",
      summary: ok ? summary : "No answer was captured, so this can't be assessed.",
      evidence: ok ? evidence : [],
    };
  });
  return {
    reportId: `fixture-${session.attemptId.slice(0, 8)}`,
    sessionId: session.sessionId,
    attemptId: session.attemptId,
    findings,
    nextStep: "Sample next step: tell one story with what you personally did, why, and how you measured the result.",
    createdAt: new Date().toISOString(),
  };
}

function fixtureFor(session: CodingSession): Report {
  const report = structuredClone(reportFixture) as unknown as Report;
  const completed = session.runs.filter((r) => r.status === "completed");
  const passingRun = [...completed].reverse().find((r) => r.passed === r.total);
  const failingRun = completed.find((r) => r.passed < r.total);
  const firstFailedCase = failingRun?.cases.find((c) => !c.pass)?.caseId;
  const students = session.turns.filter((t) => t.speaker === "student");
  const setTurn = students.find((t) => /\bset\b/i.test(t.text)) ?? students[0];
  const linearTurn = students.find((t) => /\blinear\b/i.test(t.text));
  const sourceOf = (v: number) => session.snapshots.findLast((s) => s.codeVersion === v)?.source ?? "";
  const nestedRun = completed.find((r) => r.passed === r.total && detectApproach(sourceOf(r.codeVersion)) === "nested");

  const remap = (ref: EvidenceRef): EvidenceRef | null => {
    if (ref.kind === "turn") return setTurn ? { ...ref, turnId: setTurn.id } : null;
    if (ref.kind === "code") return passingRun ? { ...ref, codeVersion: passingRun.codeVersion } : null;
    return failingRun ? { ...ref, codeVersion: failingRun.codeVersion, caseId: firstFailedCase } : null;
  };

  const findings: Finding[] = report.findings.map((f) => {
    if (f.category === "testing" && !failingRun && nestedRun) {
      const v = nestedRun.codeVersion;
      const src = sourceOf(v).split("\n");
      const forLines = src.flatMap((l, i) => (/^\s*for\s/.test(l) ? [i + 1] : []));
      const lines: [number, number] = [forLines[0], Math.min(forLines[forLines.length - 1] + 1, src.length)];
      return {
        id: f.id,
        category: "complexity",
        rating: "needs_work",
        summary: `Version ${v} compares every pair with two loops: about n²/2 comparisons when every element differs, so it is quadratic, not linear.`,
        evidence: [
          ...(linearTurn ? [{ kind: "turn" as const, turnId: linearTurn.id }] : []),
          { kind: "code", codeVersion: v, lines },
          { kind: "run", codeVersion: v },
        ],
      };
    }
    if (f.category === "approach") {
      // Cite only a passing set-based run, and describe the code it shows.
      const setRun = [...completed]
        .reverse()
        .find((r) => r.passed === r.total && detectApproach(sourceOf(r.codeVersion)) === "set");
      if (setRun) {
        const v = setRun.codeVersion;
        const src = sourceOf(v);
        const rows = src.split("\n");
        const first = rows.findIndex((l) => l.includes("set(")) + 1;
        const seenLine = rows.findIndex((l) => l.includes("in seen")) + 1;
        const sizeCompare = src.includes("len(set(");
        return {
          ...f,
          summary: sizeCompare
            ? `Version ${v} compares the set size with the input length.`
            : `Version ${v} keeps a set of numbers already seen, so each membership check is constant time on average.`,
          evidence: [{ kind: "code", codeVersion: v, lines: [first || 1, Math.max(seenLine, first || 1)] }],
        };
      }
    }
    const evidence = f.evidence.map(remap);
    if (evidence.some((e) => e === null)) {
      return {
        ...f,
        rating: "insufficient_evidence",
        summary: "This attempt has nothing to cite for this point yet.",
        evidence: [],
      };
    }
    return {
      ...f,
      // One pass, so a rewritten version number is never rewritten again.
      summary: f.summary.replace(/Version 3|Version 4|in c1/g, (m) =>
        m === "Version 3"
          ? `Version ${passingRun?.codeVersion}`
          : m === "Version 4"
            ? `Version ${failingRun?.codeVersion}`
            : `in ${firstFailedCase}`,
      ),
      evidence: evidence as EvidenceRef[],
    };
  });

  return {
    ...report,
    reportId: `fixture-${session.attemptId.slice(0, 8)}`,
    sessionId: session.sessionId,
    attemptId: session.attemptId,
    findings,
    nextStep:
      nestedRun && !failingRun
        ? "Explain out loud why comparing every pair is quadratic, then contrast it with the set's O(n) time and O(n) memory."
        : report.nextStep,
    createdAt: new Date().toISOString(),
  };
}
