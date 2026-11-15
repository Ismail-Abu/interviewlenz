"use client";

interface AudioVisualizerProps {
  state: "speaking" | "listening" | "idle" | "connecting" | "error" | null;
  className?: string;
}

export function AudioVisualizer({ state, className = "" }: AudioVisualizerProps) {
  if (state === "speaking") {
    return (
      <span className={`inline-flex items-center gap-[3px] h-4 px-1 ${className}`} aria-hidden="true" title="Interviewer speaking">
        <span className="w-1 rounded-full bg-current h-2.5 animate-[pulse_0.6s_ease-in-out_infinite]" />
        <span className="w-1 rounded-full bg-current h-4 animate-[pulse_0.75s_ease-in-out_infinite_0.15s]" />
        <span className="w-1 rounded-full bg-current h-3 animate-[pulse_0.65s_ease-in-out_infinite_0.3s]" />
      </span>
    );
  }

  if (state === "listening") {
    return (
      <span className={`inline-flex items-center gap-[3px] h-4 px-1 ${className}`} aria-hidden="true" title="Listening to candidate">
        <span className="w-1 rounded-full bg-current h-2 animate-[pulse_1.2s_ease-in-out_infinite]" />
        <span className="w-1 rounded-full bg-current h-3 animate-[pulse_1.2s_ease-in-out_infinite_0.2s]" />
        <span className="w-1 rounded-full bg-current h-2 animate-[pulse_1.2s_ease-in-out_infinite_0.4s]" />
      </span>
    );
  }

  if (state === "connecting") {
    return (
      <span className={`inline-flex items-center gap-1 h-4 px-1 ${className}`} aria-hidden="true" title="Connecting...">
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-ping" />
      </span>
    );
  }

  // Idle / default: static resting dots
  return (
    <span className={`inline-flex items-center gap-[3px] h-4 px-1 opacity-50 ${className}`} aria-hidden="true">
      <span className="w-1 h-1.5 rounded-full bg-current" />
      <span className="w-1 h-2 rounded-full bg-current" />
      <span className="w-1 h-1.5 rounded-full bg-current" />
    </span>
  );
}
