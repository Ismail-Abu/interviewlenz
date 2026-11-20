// Transcript landmarks shared by the room (client) and the report route
// (server). Pure and dependency-free.
import type { TranscriptTurn } from "./contract";

// The interviewer closes with this line (lib/behavioral.ts, lib/prompts.ts),
// which lets the app end an overtime round as soon as the goodbye is said.
export const CLOSING_LINE = "That's all for today.";

const INVITES_QUESTIONS = /\bquestions?\s+for\s+me\b/i;
const GOODBYE = /that'?s all (we have )?for today|thanks? (you )?(again )?for (your time|coming in|joining)|good-?bye|take care/i;

export function isGoodbye(text: string): boolean {
  return GOODBYE.test(text);
}

/**
 * Index of the interviewer turn that invites the candidate's own questions
 * ("Do you have any questions for me?"), or -1. Turns after it are the
 * candidate's question time: part of a real interview, but not evidence of
 * performance.
 */
export function questionTimeStart(turns: readonly Pick<TranscriptTurn, "speaker" | "text">[]): number {
  return turns.findIndex((t) => t.speaker === "interviewer" && INVITES_QUESTIONS.test(t.text));
}
