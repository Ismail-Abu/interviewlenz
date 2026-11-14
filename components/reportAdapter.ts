import type { ApiError, EvidenceRef, Finding, Report, Session } from "@/lib/contract";
import reportFixture from "@/fixtures/report.json";

// "fixture" returns fixtures/report.json (labeled FIXTURE DATA) until Ismail's
// POST /api/report (B4) exists. "fixture-error" simulates its 503 on the first
// request for each attempt, then succeeds, so Retry report can be exercised.
// "api" calls the real route. When B4 merges, change DEFAULT_REPORT_MODE to "api".
export type ReportMode = "fixture" | "fixture-error" | "api";
export const DEFAULT_REPORT_MODE: ReportMode = "fixture";

export type ReportOutcome =
  | { ok: true; report: Report; fromFixture: boolean }
  | { ok: false; error: ApiError };

const failedOnce = new Set<string>();

const UNAVAILABLE: ApiError = {
  code: "provider_unavailable",
  message: "Report provider unavailable",
  retryable: true,
};

// The only place the UI requests a report. Never throws.
export async function requestReport(session: Session, mode: ReportMode = DEFAULT_REPORT_MODE): Promise<ReportOutcome> {
  if (mode === "api") return postReport(session);
  await new Promise((resolve) => setTimeout(resolve, 900));
  if (mode === "fixture-error" && !failedOnce.has(session.attemptId)) {
    failedOnce.add(session.attemptId);
    return { ok: false, error: UNAVAILABLE };
  }
  return { ok: true, report: fixtureFor(session), fromFixture: true };
}

async function postReport(session: Session): Promise<ReportOutcome> {
  try {
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body) return { ok: true, report: body as Report, fromFixture: false };
    if (body && typeof body === "object" && "code" in body) return { ok: false, error: body as ApiError };
    return { ok: false, error: UNAVAILABLE };
  } catch {
    return { ok: false, error: UNAVAILABLE };
  }
}

// Echo the real sessionId and attemptId. The fixture's evidence names t1,
// code v3 (a correct set solution), and run v4 c1 (a failing adjacent-only
// solution). Point those at the matching items in this attempt so the links
// resolve. A finding with no counterpart in this attempt becomes
// insufficient_evidence with no refs, the only rating the contract allows to
// be empty, rather than linking to something that never happened.
function fixtureFor(session: Session): Report {
  const report = structuredClone(reportFixture) as unknown as Report;
  const passingRun = [...session.runs].reverse().find((r) => r.status === "completed" && r.passed === r.total);
  const failingRun = session.runs.find((r) => r.status === "completed" && r.cases.some((c) => !c.pass));
  const firstFailedCase =
    failingRun?.status === "completed" ? failingRun.cases.find((c) => !c.pass)?.caseId : undefined;
  const studentTurn = session.turns.find((t) => t.speaker === "student");

  const remap = (ref: EvidenceRef): EvidenceRef | null => {
    if (ref.kind === "turn") return studentTurn ? { ...ref, turnId: studentTurn.id } : null;
    if (ref.kind === "code") return passingRun ? { ...ref, codeVersion: passingRun.codeVersion } : null;
    return failingRun ? { ...ref, codeVersion: failingRun.codeVersion, caseId: firstFailedCase } : null;
  };

  const findings: Finding[] = report.findings.map((f) => {
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
    createdAt: new Date().toISOString(),
  };
}
