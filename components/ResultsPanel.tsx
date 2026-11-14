import type { RunResult } from "@/lib/contract";
import { CaseSkeleton } from "./Skeletons";

interface Props {
  result: RunResult | null;
  running: boolean;
  usingFixtures: boolean;
}

const ERROR_TITLE: Partial<Record<string, string>> = {
  syntax_error: "Syntax error",
  timeout: "Timed out",
  runner_unavailable: "Python runner unavailable",
};

// Icon + word + color, so pass/fail never relies on color alone.
function Badge({ pass }: { pass: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold ${
        pass ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
      }`}
    >
      <span aria-hidden>{pass ? "✓" : "✗"}</span>
      {pass ? "Pass" : "Fail"}
    </span>
  );
}

export function ResultsPanel({ result, running, usingFixtures }: Props) {
  const allPass = result?.status === "completed" && result.passed === result.total;
  return (
    <section className="flex h-full flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-800 px-4">
        <h2 className="text-base font-semibold text-zinc-100">Results</h2>
        {usingFixtures && !running && (
          <span className="rounded bg-amber-400/15 px-2 py-0.5 text-xs font-bold tracking-wider text-amber-300">
            FIXTURE DATA
          </span>
        )}
        {!running && result?.status === "completed" && (
          <span
            className={`ml-auto flex items-center gap-1.5 text-base font-semibold ${
              allPass ? "text-emerald-300" : "text-red-300"
            }`}
            data-testid="passed-total"
          >
            <span aria-hidden>{allPass ? "✓" : "✗"}</span>
            {result.passed}/{result.total} passed
          </span>
        )}
        {!running && result && (
          <span className={`text-sm text-zinc-500 ${result.status === "completed" ? "" : "ml-auto"}`}>
            v{result.codeVersion} · {result.durationMs} ms
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {running && <CaseSkeleton />}

        {!running && !result && (
          <p className="text-base text-zinc-500">Press Run to test your solution against 4 cases.</p>
        )}

        {!running && result?.status === "error" && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-base" role="alert">
            <div className="flex items-center gap-2 font-semibold text-red-200">
              <span aria-hidden>⚠</span>
              {ERROR_TITLE[result.error.code] ?? "Run failed"}
              {result.error.line !== undefined && ` on line ${result.error.line}`}
            </div>
            <div className="mt-1 font-mono text-red-100">{result.error.message}</div>
            {result.error.retryable && (
              <div className="mt-2 text-sm text-zinc-400">This may be temporary. Your code is unchanged; try Run again.</div>
            )}
          </div>
        )}

        {!running && result?.status === "completed" && (
          <ul className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
            {result.cases.map((c) => (
              <li
                key={c.caseId}
                className={`rounded-lg border p-3.5 font-mono text-[15px] ${
                  c.pass ? "border-zinc-800 bg-zinc-900" : "border-red-500/50 bg-red-500/5"
                }`}
              >
                <div className="mb-2 flex items-center gap-2 font-sans">
                  <Badge pass={c.pass} />
                  <span className="text-sm text-zinc-500">{c.caseId}</span>
                </div>
                <dl className="grid grid-cols-[6rem_1fr] gap-y-1">
                  <dt className="text-zinc-500">Input</dt>
                  <dd className="break-all text-zinc-100">{c.input}</dd>
                  <dt className="text-zinc-500">Expected</dt>
                  <dd className="text-zinc-100">{c.expected}</dd>
                  <dt className="text-zinc-500">Actual</dt>
                  <dd className={c.pass ? "text-emerald-300" : "text-red-300"}>{c.actual ?? "—"}</dd>
                  {c.error && (
                    <>
                      <dt className="text-zinc-500">Error</dt>
                      <dd className="whitespace-pre-wrap text-red-200">{c.error}</dd>
                    </>
                  )}
                  {c.stdout && (
                    <>
                      <dt className="text-zinc-500">Stdout</dt>
                      <dd className="whitespace-pre-wrap text-zinc-300">{c.stdout}</dd>
                    </>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
