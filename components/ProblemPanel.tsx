import Markdown from "react-markdown";
import type { CodeLanguage, Problem } from "@/lib/contract";
import { problems } from "@/lib/problems";

function py(value: unknown): string {
  return JSON.stringify(value)
    .replace(/,/g, ", ")
    .replace(/\btrue\b/g, "True")
    .replace(/\bfalse\b/g, "False")
    .replace(/\bnull\b/g, "None");
}

// Java shows plain literals: true/false, [1, 2].
function java(value: unknown): string {
  return JSON.stringify(value).replace(/,/g, ", ");
}

export function ProblemPanel({
  problem,
  onSelectProblem,
  language = "python",
}: {
  problem: Problem;
  onSelectProblem?: (p: Problem) => void;
  language?: CodeLanguage;
}) {
  const show = language === "java" ? java : py;
  return (
    <article className="flex flex-col text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {language === "java" ? "Java 21" : "Python 3"}
          </span>
          <span className="text-xs text-muted-foreground">
            {problem.id === "max-profit" ? "FinTech · Quantitative / Greedy" : "Easy · Arrays & Hashing"}
          </span>
        </div>

        {onSelectProblem && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <label htmlFor="problem-picker" className="sr-only">Switch problem</label>
            <select
              id="problem-picker"
              value={problem.id}
              onChange={(e) => {
                const found = problems.find((p) => p.id === e.target.value);
                if (found) onSelectProblem(found);
              }}
              className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground cursor-pointer transition-colors hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {problems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} {p.id === "max-profit" ? "(FinTech)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {problem.title}
      </h1>

      {/* Prompt */}
      <div className="mt-3 text-[15px] leading-relaxed text-secondary-foreground/90 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_p]:mb-3">
        <Markdown>{language === "java" ? problem.prompt.replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false") : problem.prompt}</Markdown>
      </div>

      {/* Examples */}
      <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Examples
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {problem.examples.map((ex, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4 font-mono text-[13px] leading-relaxed text-secondary-foreground shadow-card"
          >
            <div>
              <span className="text-muted-foreground">Input: </span>
              {/* The example names its own parameters, so the panel adds none. */}
              <span className="text-foreground">{show(ex.input)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Output: </span>
              <span className="font-semibold text-emerald-600">{show(ex.output)}</span>
            </div>
            {ex.explanation && (
              <div className="mt-1.5 font-sans text-xs text-muted-foreground border-t border-border/60 pt-1.5">
                {ex.explanation}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Constraints */}
      <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Constraints
      </h2>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-secondary-foreground/80 font-mono">
        {problem.constraints.map((c) => (
          <li key={c} className="flex gap-2">
            <span className="text-muted-foreground" aria-hidden="true">•</span>
            <span>{c}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
