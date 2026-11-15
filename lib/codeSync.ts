// Scheduling for silent editor-context sync.
//
// The student's newest code has to reach the Live session quickly, without one
// provider message per keystroke. The original design was a plain trailing
// debounce that was reset on every edit, so while someone typed continuously
// NOTHING was sent — the model only saw the buffer once they stopped for a full
// two seconds. That is why the interviewer appeared not to see current code.
//
// This is a leading send with a bounded trailing flush:
//
//   - the first edit after a quiet period is sent immediately;
//   - edits inside the window book a single flush at the window boundary, which
//     carries only the newest version (superseded edits coalesce);
//   - the wait is therefore bounded by intervalMs and can never grow, however
//     long the student types.
//
// Cost while typing is at most one message per intervalMs, not per keystroke,
// and there is no queue to grow unbounded: the "queue" is a single slot holding
// the latest version.

// Monaco reports all changes in one transaction for paste, undo and multi-cursor edits.
export function changesLineBoundary(changes: readonly {
  text: string;
  range: { startLineNumber: number; endLineNumber: number };
}[]): boolean {
  return changes.some(({ text, range }) =>
    range.startLineNumber !== range.endLineNumber || /[\r\n]/.test(text)
  );
}

export interface SyncClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const realClock: SyncClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export const DEFAULT_SYNC_INTERVAL_MS = 250;

export class CodeSyncScheduler {
  private timer: unknown = null;
  // -Infinity, not 0: at clock time 0 a zero sentinel would read as
  // "just sent" and the very first edit would be delayed instead of leading.
  private lastSentAt = -Infinity;
  // Plain fields, not constructor parameter properties: dev/ checks import this
  // module with Node's --experimental-strip-types, which rejects those.
  private readonly send: () => void;
  private readonly intervalMs: number;
  private readonly clock: SyncClock;

  constructor(send: () => void, intervalMs: number = DEFAULT_SYNC_INTERVAL_MS, clock: SyncClock = realClock) {
    this.send = send;
    this.intervalMs = intervalMs;
    this.clock = clock;
  }

  // Call on every editor change. Sends now when the window is open, otherwise
  // coalesces into the one pending flush.
  schedule(lineBoundary = false): void {
    if (lineBoundary) {
      this.flushNow();
      return;
    }
    const since = this.clock.now() - this.lastSentAt;
    if (since >= this.intervalMs) {
      this.cancel();
      this.fire();
      return;
    }
    if (this.timer !== null) return; // already booked; this edit rides along
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      this.fire();
    }, this.intervalMs - since);
  }

  // Send immediately regardless of the window (connect, and Run, where the
  // model must have the exact tested source without waiting).
  flushNow(): void {
    this.cancel();
    this.fire();
  }

  cancel(): void {
    if (this.timer !== null) {
      this.clock.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  // After a connect or reconnect: drop any pending flush and reopen the window,
  // so the first edit on the restored session is sent immediately.
  reset(): void {
    this.cancel();
    this.lastSentAt = -Infinity;
  }

  // True while a trailing flush is booked. For checks and diagnostics.
  get pending(): boolean {
    return this.timer !== null;
  }

  private fire(): void {
    this.lastSentAt = this.clock.now();
    this.send();
  }
}
