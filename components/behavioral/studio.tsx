"use client";

// Shared "mission control" pieces for the live rooms: the status-pill palette,
// the elapsed-session clock, and the console surface classes.
import { useEffect, useState } from "react";

export const CONSOLE = {
  page: "bg-[#0B0C0E] text-zinc-100 [color-scheme:dark]",
  header: "border-b border-white/[0.08] bg-[#0B0C0E]/95 backdrop-blur",
  panel: "rounded-[18px] border border-white/[0.08] bg-[#111215] shadow-2xl shadow-black/60",
  bar: "border-b border-white/[0.08] bg-[#15161A]",
  // Tactile glowing Finish (outline) and the radiant crimson Run/primary CTA.
  finish:
    "inline-flex items-center justify-center gap-2 rounded-[14px] border border-rose-400/40 bg-rose-950/40 px-5 py-2 text-sm font-semibold text-rose-100 shadow-[0_0_18px_-6px_rgba(244,63,94,0.7)] transition hover:border-rose-300/70 hover:bg-rose-900/50 hover:shadow-[0_0_24px_-4px_rgba(244,63,94,0.8)] disabled:cursor-not-allowed disabled:opacity-60",
  primary:
    "inline-flex items-center justify-center gap-2 rounded-[14px] bg-gradient-to-b from-[#D4183A] to-[#9B1B30] font-semibold text-white ring-1 ring-rose-300/30 shadow-[0_0_22px_-6px_rgba(212,24,58,0.85)] transition hover:from-[#E0284A] hover:to-[#A8213A] hover:shadow-[0_0_28px_-4px_rgba(212,24,58,0.95)] disabled:cursor-not-allowed disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-[12px] border border-white/[0.1] bg-white/[0.04] font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-60",
} as const;

export type LiveTone = "listening" | "speaking" | "muted" | "connecting" | "lost" | "idle";

// Listening = emerald glow, speaking = crimson, muted = amber warning.
export const PILL: Record<LiveTone, string> = {
  listening: "bg-emerald-950/60 border-emerald-500/30 text-emerald-400 shadow-[0_0_16px_-6px_rgba(16,185,129,0.7)]",
  speaking: "bg-rose-950/60 border-rose-500/30 text-rose-300 shadow-[0_0_16px_-6px_rgba(244,63,94,0.7)]",
  muted: "bg-amber-950/60 border-amber-500/30 text-amber-300",
  connecting: "bg-sky-950/50 border-sky-500/30 text-sky-300",
  lost: "bg-red-950/60 border-red-500/40 text-red-300",
  idle: "bg-white/[0.04] border-white/[0.1] text-zinc-300",
};
export const PILL_BASE = "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold";

// mm:ss since this room mounted. Remount (key) to restart for a new attempt.
// The start time is taken in an effect, never during render.
export function SessionClock({ className = "" }: { className?: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <span className={`tabular-nums ${className}`} data-testid="session-clock" aria-label={`Elapsed ${Math.floor(elapsed / 60)} minutes ${elapsed % 60} seconds`}>
      {mm}:{ss}
    </span>
  );
}
