// Presentation helpers shared by the summary and the report: track names,
// rubric labels, evidence descriptions resolved against THIS attempt's session,
// and the downloadable debrief. Pure: no React, no network.
import type { EvidenceRef, Finding, Report, RoundType, Session, TranscriptTurn } from "@/lib/contract";
import { isBehavioralSession } from "@/lib/behavioral";
import { BAND_LABEL, scoreRound, type Band } from "@/lib/score";

export const TRACK_LABEL: Record<RoundType, string> = {
  coding: "Technical Coding Evaluation",
  behavioral: "Behavioral Deep-Dive Evaluation",
};
export const TRACK_SHORT: Record<RoundType, string> = { coding: "Technical", behavioral: "Behavioral" };

const CATEGORY_LABEL: Record<Finding["category"], string> = {
  correctness: "Correctness",
  clarification: "Clarifying questions",
  approach: "Approach",
  complexity: "Algorithmic complexity",
  testing: "Testing",
  code_clarity: "Code clarity",
  spoken_reasoning: "Communication",
  specificity: "Specificity",
  personal_contribution: "Personal contribution",
  reasoning: "Reasoning",
  outcome: "Outcome",
};
export const categoryLabel = (c: string) => CATEGORY_LABEL[c as Finding["category"]] ?? c.replace(/_/g, " ");

export const RATING_WORD: Record<Finding["rating"], string> = {
  strong: "Strong",
  ok: "Solid",
  needs_work: "Developing",
  insufficient_evidence: "Insufficient evidence",
};

// mm:ss since the attempt's first turn, so a quote can be found in the transcript.
export function turnClock(session: Session, turn: TranscriptTurn): string | null {
  const first = session.turns[0];
  const t0 = first ? Date.parse(first.at) : NaN;
  const t = Date.parse(turn.at);
  if (Number.isNaN(t0) || Number.isNaN(t)) return null;
  const s = Math.max(0, Math.round((t - t0) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export interface EvidenceView {
  kind: EvidenceRef["kind"];
  label: string; // the chip text
  quote?: { text: string; who: string; id: string; clock: string | null }; // turn refs only
  missing?: boolean; // the ref names something not in this attempt
}

// Describe a citation using what actually happened in this attempt.
export function describeEvidence(ref: EvidenceRef, session?: Session): EvidenceView {
  if (ref.kind === "turn") {
    const turn = session?.turns.find((t) => t.id === ref.turnId);
    if (!turn) return { kind: "turn", label: `Transcript ${ref.turnId}`, missing: !!session };
    const who = turn.speaker === "student" ? "You" : "Interviewer";
    const clock = session ? turnClock(session, turn) : null;
    return { kind: "turn", label: `${who} · ${turn.id}${clock ? ` · ${clock}` : ""}`, quote: { text: turn.text, who, id: turn.id, clock } };
  }
  const coding = session && !isBehavioralSession(session) ? session : undefined;
  if (ref.kind === "code") {
    const lines = ref.lines ? (ref.lines[0] === ref.lines[1] ? ` · line ${ref.lines[0]}` : ` · lines ${ref.lines[0]}–${ref.lines[1]}`) : "";
    const missing = coding ? !coding.snapshots.some((s) => s.codeVersion === ref.codeVersion) : false;
    return { kind: "code", label: `solution.py v${ref.codeVersion}${lines}`, missing };
  }
  const run = coding?.runs.findLast((r) => r.codeVersion === ref.codeVersion);
  const caseBit = ref.caseId ? ` · case ${ref.caseId}` : "";
  if (!run) return { kind: "run", label: `Run v${ref.codeVersion}${caseBit}`, missing: !!coding };
  if (run.status === "error") return { kind: "run", label: `Run v${ref.codeVersion} · ${run.error.code.replace(/_/g, " ")}${caseBit}` };
  return { kind: "run", label: `Run v${ref.codeVersion} · ${run.passed}/${run.total} passed in ${run.durationMs} ms${caseBit}` };
}

// Plain-text debrief the student can download and keep. Built only from the
// attempt and its report: no listing, no resume, no other private material.
export function buildDebrief(opts: {
  roleLabel?: string;
  tracks: { round: RoundType; session?: Session; report?: Report | null }[];
  overall: Band;
  keyTakeaway?: string;
}): string {
  const out: string[] = ["# Interviewlenz debrief", ""];
  if (opts.roleLabel) out.push(opts.roleLabel, "");
  out.push(`Overall: ${BAND_LABEL[opts.overall]}`, "");
  if (opts.keyTakeaway) out.push(`Key takeaway: ${opts.keyTakeaway}`, "");
  for (const t of opts.tracks) {
    out.push(`## ${TRACK_LABEL[t.round]}`);
    if (!t.session) {
      out.push("Not completed in this interview.", "");
      continue;
    }
    if (!t.report) {
      out.push("Evaluation not available yet.", "");
      continue;
    }
    const score = scoreRound(t.round, t.report.findings);
    out.push(`Band: ${BAND_LABEL[score.band]} (${score.ratedCount} of ${score.totalCount} dimensions assessed)`);
    if (score.caveat) out.push(`Note: ${score.caveat}`);
    out.push("", `Next step to practice: ${t.report.nextStep}`, "");
    for (const f of t.report.findings) {
      out.push(`- ${categoryLabel(f.category)} — ${RATING_WORD[f.rating]}: ${f.summary}`);
      for (const ref of f.evidence) {
        const v = describeEvidence(ref, t.session);
        out.push(v.quote ? `    - "${v.quote.text}" (${v.label})` : `    - ${v.label}${v.missing ? " (not in this attempt)" : ""}`);
      }
    }
    out.push("");
  }
  out.push("Scores are bands from the rubric ratings, not percentages. Dimensions without enough evidence are left out, not scored as zero.");
  return out.join("\n");
}
