import type { RunResult } from "@/lib/contract";

interface Props {
  result: RunResult | null;
  running: boolean;
  usingFixtures: boolean;
}

function Badge({ pass }: { pass: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        pass ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
      }`}
    >
      {pass ? "PASS" : "FAIL"}
    </span>
  );
}

export function ResultsPanel({ result, running, usingFixtures }: Props) {
  return (
    <section className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-2">
        <h2 className="text-sm font-semibold text-zinc-200">Results</h2>
        {usingFixtures && (
          <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold tracking-wider text-amber-300">
            FIXTURE DATA
          </span>
        )}
        {result?.status === "completed" && (
          <span
            className={`ml-auto text-sm font-semibold ${
              result.passed === result.total ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {result.passed}/{result.total} passed
          </span>
        )}
        {result && (
          <span className={`text-xs text-zinc-500 ${result.status === "completed" ? "" : "ml-auto"}`}>
            v{result.codeVersion} · {result.durationMs} ms
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {running && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200" />
            Running tests…
          </div>
        )}

        {!running && !result && (
          <p className="text-sm text-zinc-500">Press Run to test your solution.</p>
        )}

        {!running && result?.status === "error" && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
            <div className="font-semibold text-red-300">
              {result.error.code === "syntax_error" ? "Syntax error" : "Run failed"}
              {result.error.line !== undefined && ` on line ${result.error.line}`}
            </div>
            <div className="mt-1 font-mono text-red-200">{result.error.message}</div>
            {result.error.retryable && (
              <div className="mt-2 text-zinc-400">This may be temporary. Your code is unchanged; try Run again.</div>
            )}
          </div>
        )}

        {!running && result?.status === "completed" && (
          <ul className="flex flex-col gap-3">
            {result.cases.map((c) => (
              <li
                key={c.caseId}
                className={`rounded-lg border p-3 font-mono text-sm ${
                  c.pass ? "border-zinc-800 bg-zinc-900" : "border-red-500/40 bg-red-500/5"
                }`}
              >
                <div className="mb-2 flex items-center gap-2 font-sans">
                  <Badge pass={c.pass} />
                  <span className="text-xs text-zinc-500">{c.caseId}</span>
                </div>
                <dl className="grid grid-cols-[5.5rem_1fr] gap-y-1">
                  <dt className="text-zinc-500">Input</dt>
                  <dd className="text-zinc-100">{c.input}</dd>
                  <dt className="text-zinc-500">Expected</dt>
                  <dd className="text-zinc-100">{c.expected}</dd>
                  <dt className="text-zinc-500">Actual</dt>
                  <dd className={c.pass ? "text-emerald-400" : "text-red-400"}>{c.actual ?? "—"}</dd>
                  {c.error && (
                    <>
                      <dt className="text-zinc-500">Error</dt>
                      <dd className="whitespace-pre-wrap text-red-300">{c.error}</dd>
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
