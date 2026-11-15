"use client";

import { useEffect, useRef, useState } from "react";

// Round timing. The technical round is timed with no limit; the behavioral
// round has a limit and finishes itself when it runs out.
export const BEHAVIORAL_LIMIT_MS = 10 * 60_000;
export const WARN_AT_MS = 2 * 60_000;
export const FINAL_WARN_AT_MS = 60_000;

export interface RoundTiming {
  durationMs: number;
  limitMs?: number;
  timedOut?: boolean;
}

// "4:07", or "1:02:03" past an hour.
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// Words for summaries and screen readers: "4 min 7 s".
export function describeClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m} min ${s % 60} s` : `${s} s`;
}

// "Time: 12:34", or for a limited round "Time: 7:05 of 10:00" / "Time's up (10:00)".
export function timingLabel(t: RoundTiming): string {
  if (t.timedOut && t.limitMs) return `Time's up (${formatClock(t.limitMs)})`;
  return t.limitMs ? `Time: ${formatClock(t.durationMs)} of ${formatClock(t.limitMs)}` : `Time: ${formatClock(t.durationMs)}`;
}

/**
 * A clock that runs while `key` is non-null. A new key restarts it from zero;
 * the same key after a pause (null) resumes from the original start, so a
 * dropped connection doesn't reset the round. With `limitMs`, `onExpire` fires
 * once when the elapsed time reaches the limit.
 */
export function useRoundClock(key: string | null, opts: { limitMs?: number; onExpire?: () => void } = {}) {
  const start = useRef<{ key: string; at: number; expired: boolean } | null>(null);
  const [tick, setTick] = useState<{ key: string; ms: number } | null>(null);
  const onExpire = useRef(opts.onExpire);
  const limitMs = opts.limitMs;

  useEffect(() => {
    onExpire.current = opts.onExpire;
  });

  useEffect(() => {
    if (!key) return;
    if (start.current?.key !== key) start.current = { key, at: Date.now(), expired: false };
    const s = start.current;
    const update = () => {
      const ms = Date.now() - s.at;
      setTick({ key: s.key, ms });
      if (limitMs !== undefined && ms >= limitMs && !s.expired) {
        s.expired = true;
        onExpire.current?.();
      }
    };
    const first = setTimeout(update, 0);
    const id = setInterval(update, 500);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [key, limitMs]);

  return {
    // Rendered value, refreshed twice a second; 0 until this key has started.
    elapsedMs: key !== null && tick?.key === key ? tick.ms : 0,
    // Exact elapsed time for event handlers, or null if `forKey` never started.
    read: (forKey: string): number | null => (start.current?.key === forKey ? Date.now() - start.current.at : null),
  };
}
