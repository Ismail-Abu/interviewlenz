import type { ApiError, EvidenceRef, Finding, Report, Session } from "@/lib/contract";
import reportFixture from "@/fixtures/report.json";
import { detectApproach } from "./liveAdapter";

// The only place the UI requests a report. Never throws.
//
// "auto" (default) POSTs {session} to /api/report. If the route is missing or
// fails (503 when GEMINI_API_KEY is not set), it falls back to
// fixtures/report.json, labeled FIXTURE DATA, so the demo runs with zero keys.
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
  if (mode === "api") return postReport(session);
  if (mode === "auto") {
    const real = await postReport(session);
    if (real.ok) return real;
    await delay(400);
    return { ok: true, report: fixtureFor(session), fromFixture: true, fallbackReason: "no API key" };
  }
  await delay(900);
  if (mode === "fixture-error" && !failedOnce.has(session.attemptId)) {
    failedOnce.add(session.attemptId);
    return { ok: false, error: UNAVAILABLE };
  }
  return { ok: true, report: fixtureFor(session), fromFixture: true };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postReport(session: Session): Promise<ReportOutcome> {
  try {
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body && Array.isArray(body.findings)) return { ok: true, report: body as Report, fromFixture: false };
    if (body && typeof body === "object" && "code" in body) return { ok: false, error: body as ApiError };
    return { ok: false, error: UNAVAILABLE };
  } catch {
    return { ok: false, error: UNAVAILABLE };
  }
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
function fixtureFor(session: Session): Report {
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
