"use client";

import { TypingEditor } from "./TypingEditor";

export function LiveDemoPanel() {
  const bars = [
    { delay: "0s", duration: "0.8s" },
    { delay: "0.17s", duration: "1s" },
    { delay: "0.34s", duration: "1.2s" },
    { delay: "0.51s", duration: "0.9s" },
    { delay: "0.68s", duration: "1.1s" },
    { delay: "0.85s", duration: "0.8s" },
    { delay: "0.02s", duration: "1s" },
    { delay: "0.19s", duration: "1.2s" },
    { delay: "0.36s", duration: "0.9s" },
    { delay: "0.53s", duration: "1.1s" },
    { delay: "0.70s", duration: "0.8s" },
    { delay: "0.87s", duration: "1s" },
    { delay: "0.04s", duration: "1.2s" },
    { delay: "0.21s", duration: "0.9s" },
  ];

  return (
    <div
      role="img"
      aria-label="Example: the interviewer asks a follow-up about the code you just ran"
      className="overflow-hidden rounded-2xl border border-border bg-background shadow-lift"
    >
      <div className="grid lg:grid-cols-[1.1fr_1fr]">
        {/* Left: Code Editor Preview (types itself out, then runs) */}
        <TypingEditor />

        {/* Right: Transcript Preview */}
        <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Transcript
          </span>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Interviewer
            </span>
            <p className="text-[14px] leading-relaxed text-foreground">
              You chose a hash set to pass all tests. What&apos;s the space complexity of this approach?
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
              You
            </span>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              It&apos;s O(n) space in the worst case because we store each unique element.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Interviewer
            </span>
            <p className="text-[14px] leading-relaxed text-foreground">
              Could we achieve O(1) space if the input array can be sorted in place?
            </p>
          </div>
        </div>
      </div>

      {/* Bottom: Live Waveform */}
      <div className="flex items-center gap-3 border-t border-border px-5 py-3.5 bg-background">
        <span className="inline-flex items-center gap-[3px] h-4" aria-hidden="true">
          {bars.map((bar, i) => (
            <span
              key={i}
              className="eq-bar h-full w-[3px] rounded-full bg-primary"
              style={{ animationDelay: bar.delay, animationDuration: bar.duration }}
            />
          ))}
        </span>
        <span className="text-sm text-muted-foreground font-normal">
          Interviewer listening to your reasoning…
        </span>
      </div>
    </div>
  );
}
