// Recent completed rounds, kept in this browser only (localStorage). Stores
// the band and test totals, never transcripts, code, resume or listing text.
import type { Report, Session } from "@/lib/contract";
import { isBehavioralSession } from "@/lib/behavioral";
import { scoreRound, type Band } from "@/lib/score";

export interface HistoryEntry {
  attemptId: string;
  round: "coding" | "behavioral";
  band: Band;
  at: number; // ms since epoch, when the report arrived
  passed?: number;
  total?: number;
  role?: string; // "Backend Engineer at Stripe", at most 80 chars
  sample?: boolean; // the report came from fixtures, not a real evaluation
}

const KEY = "interviewlenz:history:v1";
const MAX = 20;
const BANDS: Band[] = ["strong", "solid", "developing", "insufficient"];
const listeners = new Set<() => void>();

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function valid(e: unknown): e is HistoryEntry {
  if (!e || typeof e !== "object") return false;
  const x = e as Record<string, unknown>;
  return (
    typeof x.attemptId === "string" &&
    (x.round === "coding" || x.round === "behavioral") &&
    BANDS.includes(x.band as Band) &&
    typeof x.at === "number" &&
    Number.isFinite(x.at)
  );
}

let cacheRaw: string | null = null;
let cacheList: HistoryEntry[] = [];
const EMPTY: HistoryEntry[] = [];

// Newest first. The same array is returned until storage changes, so it can
// back useSyncExternalStore.
export function getHistory(): HistoryEntry[] {
  const raw = read();
  if (raw === cacheRaw) return cacheList;
  cacheRaw = raw;
  try {
    const parsed: unknown = JSON.parse(raw);
    cacheList = Array.isArray(parsed) ? parsed.filter(valid).sort((a, b) => b.at - a.at).slice(0, MAX) : [];
  } catch {
    cacheList = [];
  }
  return cacheList;
}
export const getServerHistory = () => EMPTY;

export function subscribeHistory(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => e.key === KEY && fn();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

function write(list: HistoryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // Storage full or blocked: history is a convenience, never required.
  }
  listeners.forEach((fn) => fn());
}

// Record one finished report. Idempotent per attempt.
export function recordAttempt(session: Session, report: Report, sample: boolean, role?: string) {
  const list = getHistory();
  if (list.some((e) => e.attemptId === session.attemptId)) return;
  const round = isBehavioralSession(session) ? "behavioral" : "coding";
  const entry: HistoryEntry = { attemptId: session.attemptId, round, band: scoreRound(round, report.findings).band, at: Date.now() };
  if (!isBehavioralSession(session)) {
    const last = session.runs.at(-1);
    if (last?.status === "completed") {
      entry.passed = last.passed;
      entry.total = last.total;
    }
  }
  const r = role?.replace(/\s+/g, " ").trim().slice(0, 80);
  if (r) entry.role = r;
  if (sample) entry.sample = true;
  write([entry, ...list]);
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  listeners.forEach((fn) => fn());
}
