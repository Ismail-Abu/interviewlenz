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
    <section className="flex flex-col gap-6 overflow-y-auto p-6">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">{problem.title}</h1>

      <div className="text-[17px] leading-8 text-zinc-200 [&_code]:rounded [&_code]:bg-zinc-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_p]:mb-3 [&_strong]:text-zinc-50">
        <Markdown>{problem.prompt}</Markdown>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Examples</h2>
        {problem.examples.map((ex, i) => (
          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 font-mono text-[15px]">
            <div>
              <span className="text-zinc-500">Input: </span>
              <span className="text-zinc-100">nums = {py(ex.input)}</span>
            </div>
            <div>
              <span className="text-zinc-500">Output: </span>
              <span className="text-zinc-100">{py(ex.output)}</span>
            </div>
            {ex.explanation && (
              <div className="mt-1 font-sans text-base text-zinc-400">{ex.explanation}</div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Constraints</h2>
        <ul className="list-disc pl-5 text-base text-zinc-300">
          {problem.constraints.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
