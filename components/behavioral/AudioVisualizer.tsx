"use client";

// Three-bar frequency wave. The bars change HEIGHT (scaleY), like a level meter,
// at a tempo that matches the state: brisk while the interviewer speaks, slow
// while listening. Decorative only (aria-hidden): the status text next to it
// carries the meaning. Reduced-motion users get static bars.
export type VisualizerState = "speaking" | "listening" | "idle" | "connecting" | "error" | null;

const TEMPO: Record<"speaking" | "listening", { dur: string; delays: string[]; peaks: number[] }> = {
  speaking: { dur: "0.7s", delays: ["0s", "0.18s", "0.36s"], peaks: [0.95, 1, 0.8] },
  listening: { dur: "1.4s", delays: ["0s", "0.3s", "0.6s"], peaks: [0.6, 0.8, 0.6] },
};

export function AudioVisualizer({ state, className = "" }: { state: VisualizerState; className?: string }) {
  if (state === "connecting") {
    return (
      <span className={`inline-flex h-4 items-center px-1 ${className}`} aria-hidden="true">
        <span className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-ping" />
      </span>
    );
  }
  const live = state === "speaking" || state === "listening" ? TEMPO[state] : null;
  return (
    <span className={`inline-flex h-4 items-end gap-[3px] px-1 ${live ? "" : "opacity-50"} ${className}`} aria-hidden="true">
      <style>{`
        @keyframes ilz-wave { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(var(--ilz-peak, 1)); } }
        @media (prefers-reduced-motion: reduce) { .ilz-bar { animation: none !important; transform: scaleY(0.6) !important; } }
      `}</style>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="ilz-bar block h-4 w-[3px] origin-bottom rounded-full bg-current"
          style={
            live
              ? ({ animation: `ilz-wave ${live.dur} ease-in-out ${live.delays[i]} infinite`, "--ilz-peak": live.peaks[i] } as React.CSSProperties)
              : { transform: `scaleY(${[0.35, 0.5, 0.35][i]})` }
          }
        />
      ))}
    </span>
  );
}
