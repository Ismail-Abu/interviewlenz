"use client";

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
        {/* Left: Code Editor Preview */}
        <div className="border-b border-border bg-card lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="font-mono text-xs text-muted-foreground">solution.py · v4</span>
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                Python 3
              </span>
              {/* User requested: Green Run Code button */}
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-white shadow-sm">
                ▶ Run
              </span>
            </div>
          </div>

          <div className="px-5 py-5">
            <pre className="overflow-x-auto font-mono text-[12.5px] leading-[1.75] sm:text-[13px]">
              <code>
                <span className="block whitespace-pre">
                  <span className="mr-4 inline-block w-5 select-none text-right text-syntax-gutter">1</span>
                  <span className="text-syntax-keyword font-semibold">def</span>{" "}
                  <span className="text-syntax-function font-semibold">contains_duplicate</span>
                  <span className="text-syntax-plain">(nums):</span>
                </span>
                <span className="block whitespace-pre">
                  <span className="mr-4 inline-block w-5 select-none text-right text-syntax-gutter">2</span>
                  <span className="text-syntax-plain">    seen = </span>
                  <span className="text-syntax-builtin">set</span>
                  <span className="text-syntax-plain">()</span>
                </span>
                <span className="block whitespace-pre">
                  <span className="mr-4 inline-block w-5 select-none text-right text-syntax-gutter">3</span>
                  <span className="text-syntax-keyword font-semibold">    for</span>{" "}
                  <span className="text-syntax-plain">n </span>
                  <span className="text-syntax-keyword font-semibold">in</span>{" "}
                  <span className="text-syntax-plain">nums:</span>
                </span>
                <span className="block whitespace-pre">
                  <span className="mr-4 inline-block w-5 select-none text-right text-syntax-gutter">4</span>
                  <span className="text-syntax-keyword font-semibold">        if</span>{" "}
                  <span className="text-syntax-plain">n </span>
                  <span className="text-syntax-keyword font-semibold">in</span>{" "}
                  <span className="text-syntax-plain">seen:</span>
                </span>
                <span className="block whitespace-pre">
                  <span className="mr-4 inline-block w-5 select-none text-right text-syntax-gutter">5</span>
                  <span className="text-syntax-keyword font-semibold">            return</span>{" "}
                  <span className="text-syntax-constant font-semibold">True</span>
                </span>
                <span className="block whitespace-pre">
                  <span className="mr-4 inline-block w-5 select-none text-right text-syntax-gutter">6</span>
                  <span className="text-syntax-plain">        seen.add(n)</span>
                </span>
                <span className="block whitespace-pre">
                  <span className="mr-4 inline-block w-5 select-none text-right text-syntax-gutter">7</span>
                  <span className="text-syntax-keyword font-semibold">    return</span>{" "}
                  <span className="text-syntax-constant font-semibold">False</span>
                </span>
              </code>
            </pre>

            <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success border border-emerald-500/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              4/4 test cases passed in 14ms
            </span>
          </div>
        </div>

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
