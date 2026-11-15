import Markdown from "react-markdown";
import type { Problem } from "@/lib/contract";

function py(value: unknown): string {
  return JSON.stringify(value)
    .replace(/,/g, ", ")
    .replace(/\btrue\b/g, "True")
    .replace(/\bfalse\b/g, "False")
    .replace(/\bnull\b/g, "None");
}

export function ProblemPanel({ problem }: { problem: Problem }) {
  return (
    <section className="flex flex-col gap-6 overflow-y-auto p-6 text-zinc-100">
      {/* Problem Header */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full border border-rose-500/30 bg-rose-950/50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-rose-200">
            Technical Problem
          </span>
          <span className="rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[11px] font-mono font-medium text-zinc-400">
            Python 3
          </span>
        </div>
        <h1 className="font-brand text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50">
          {problem.title}
        </h1>
      </div>

      {/* Problem Prompt */}
      <div className="text-[15px] leading-relaxed text-zinc-300 [&_code]:rounded [&_code]:bg-white/[0.08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-zinc-100 [&_p]:mb-3 [&_strong]:text-zinc-50">
        <Markdown>{problem.prompt}</Markdown>
      </div>

      {/* Examples */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Examples
        </h2>
        {problem.examples.map((ex, i) => (
          <div
            key={i}
            className="rounded-[14px] border border-white/[0.08] bg-[#15161A] p-4 font-mono text-[13.5px] shadow-sm flex flex-col gap-1.5"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-zinc-400 font-sans text-xs font-semibold uppercase tracking-wider">Input:</span>
              <span className="text-zinc-100 font-mono">nums = {py(ex.input)}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-zinc-400 font-sans text-xs font-semibold uppercase tracking-wider">Output:</span>
              <span className="text-emerald-400 font-mono">{py(ex.output)}</span>
            </div>
            {ex.explanation && (
              <div className="mt-1 font-sans text-xs text-zinc-400 leading-relaxed border-t border-white/[0.06] pt-1.5">
                <span className="font-semibold text-zinc-300">Explanation: </span>
                {ex.explanation}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Constraints */}
      <div className="flex flex-col gap-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Constraints
        </h2>
        <ul className="flex flex-col gap-1.5 pl-1 text-[13.5px] text-zinc-300 font-mono">
          {problem.constraints.map((c) => (
            <li key={c} className="flex items-baseline gap-2">
              <span className="text-rose-400" aria-hidden="true">•</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
