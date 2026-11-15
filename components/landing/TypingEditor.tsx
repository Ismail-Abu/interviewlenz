"use client";

import { useEffect, useRef, useState } from "react";

// The landing page's code preview: the solution types itself out, the Run
// button fires, the tests pass, and after a pause it starts over.
// - Every character is laid out from the start (untyped text is invisible),
//   so the panel never changes size while it animates.
// - The first render is the finished state, so without JavaScript, or with
//   reduced motion, visitors see the complete code and result.
// - The loop only runs while the panel is on screen.
// - Timing is deterministic: no random values or clock reads during render.

const K = "text-syntax-keyword font-semibold";
const F = "text-syntax-function font-semibold";
const P = "text-syntax-plain";
const B = "text-syntax-builtin";
const C = "text-syntax-constant font-semibold";

type Token = readonly [text: string, className: string];
const LINES: readonly (readonly Token[])[] = [
  [["def", K], [" ", P], ["contains_duplicate", F], ["(nums):", P]],
  [["    seen = ", P], ["set", B], ["()", P]],
  [["    ", P], ["for", K], [" n ", P], ["in", K], [" nums:", P]],
  [["        ", P], ["if", K], [" n ", P], ["in", K], [" seen:", P]],
  [["            ", P], ["return", K], [" ", P], ["True", C]],
  [["        seen.add(n)", P]],
  [["    ", P], ["return", K], [" ", P], ["False", C]],
];

const lineText = LINES.map((l) => l.map(([t]) => t).join(""));
const lineStart = lineText.map((_, i) => lineText.slice(0, i).reduce((n, t) => n + t.length, 0));
const TOTAL = lineText.reduce((n, t) => n + t.length, 0);
const indentOf = (t: string) => t.length - t.trimStart().length;

// Lines are stored back to back, so the end of line i and the start of line
// i + 1 are the same position. At such a boundary the caret stays at the end
// of line i (the line pause); the next step moves to line i + 1.
const isBoundary = (pos: number) => pos > 0 && pos < TOTAL && lineStart.includes(pos);
const lineAt = (pos: number) => {
  let i = 0;
  while (i + 1 < lineStart.length && lineStart[i + 1] <= pos) i++;
  return isBoundary(pos) ? i - 1 : i;
};

// The next typing position: a new line's indentation appears at once, like an
// editor's auto-indent, then one character at a time.
function nextPos(pos: number): number {
  const i = lineStart.indexOf(pos);
  if (i >= 0) return pos + Math.max(1, indentOf(lineText[i]));
  return pos + 1;
}

// Per-keystroke delay with some rhythm, but no randomness.
const keyDelay = (pos: number) => 22 + ((pos * 37) % 29);
const LINE_PAUSE_MS = 220;
const RUN_MS = 1100;
const HOLD_MS = 4200;
const START_DELAY_MS = 500;

type Phase = "typing" | "running" | "passed";

export function TypingEditor() {
  const [pos, setPos] = useState(TOTAL);
  const [phase, setPhase] = useState<Phase>("passed");
  const [visible, setVisible] = useState(false);
  const animate = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  // Start (or restart) when the panel scrolls into view; pause when it leaves.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !animate.current) {
        animate.current = true;
        setPos(0);
        setPhase("typing");
      }
      setVisible(entry.isIntersecting);
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Drive the loop one step at a time.
  useEffect(() => {
    if (!visible || !animate.current) return;
    let id: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      const delay = pos >= TOTAL ? LINE_PAUSE_MS * 2 : pos === 0 ? START_DELAY_MS : isBoundary(pos) ? LINE_PAUSE_MS : keyDelay(pos);
      id = setTimeout(() => (pos >= TOTAL ? setPhase("running") : setPos(nextPos(pos))), delay);
    } else if (phase === "running") {
      id = setTimeout(() => setPhase("passed"), RUN_MS);
    } else {
      id = setTimeout(() => {
        setPos(0);
        setPhase("typing");
      }, HOLD_MS);
    }
    return () => clearTimeout(id);
  }, [visible, phase, pos]);

  const caretLine = phase === "typing" ? lineAt(pos) : -1;

  return (
    <div ref={root} className="border-b border-border bg-card lg:border-b-0 lg:border-r" data-testid="demo-editor" data-phase={phase}>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="font-mono text-xs text-muted-foreground">solution.py · v4</span>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            Python 3
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-white shadow-sm transition-shadow ${
              phase === "running" ? "ring-4 ring-emerald-500/30" : ""
            }`}
          >
            ▶ Run
          </span>
        </div>
      </div>

      <div className="px-5 py-5">
        <pre className="overflow-x-auto font-mono text-[12.5px] leading-[1.75] sm:text-[13px]">
          <code data-testid="demo-code">
            {LINES.map((tokens, i) => {
              const typed = Math.max(0, Math.min(pos - lineStart[i], lineText[i].length));
              let offset = 0;
              return (
                <span key={i} className="block whitespace-pre">
                  <span className={`mr-4 inline-block w-5 select-none text-right text-syntax-gutter ${i === 0 || pos > lineStart[i] ? "" : "invisible"}`}>
                    {i + 1}
                  </span>
                  {tokens.map(([text, cls], j) => {
                    const shown = Math.max(0, Math.min(typed - offset, text.length));
                    offset += text.length;
                    return (
                      <span key={j} className={cls}>
                        {text.slice(0, shown)}
                        {shown < text.length && <span className="invisible">{text.slice(shown)}</span>}
                      </span>
                    );
                  })}
                  {caretLine === i && <Caret afterChars={typed} lineLength={lineText[i].length} />}
                </span>
              );
            })}
          </code>
        </pre>

        <div className="mt-5 min-h-7" aria-hidden="true">
          {phase === "running" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
              Running 4 test cases…
            </span>
          )}
          {phase === "passed" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success border border-emerald-500/20">
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
              >
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              4/4 test cases passed in 14ms
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// A blinking bar. It is positioned over the invisible remainder of the line,
// so it never shifts the text.
function Caret({ afterChars, lineLength }: { afterChars: number; lineLength: number }) {
  return (
    <span
      aria-hidden="true"
      className="demo-caret pointer-events-none relative inline-block h-[1.15em] w-0 align-text-bottom"
      style={{ left: `calc(${afterChars - lineLength}ch - 0px)` }}
    >
      <span className="absolute left-0 top-0 h-full w-[2px] rounded-full bg-primary" />
    </span>
  );
}
