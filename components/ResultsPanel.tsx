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
  runner_unavailable: "Code runner unavailable",
};

// Icon + word + color, so pass/fail never relies on color alone.
function Badge({ pass }: { pass: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        pass ? "bg-success-soft text-success border border-emerald-500/20" : "bg-red-50 text-red-700 border border-red-200"
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
    <section className="flex h-full flex-col overflow-hidden bg-background">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-4 bg-muted/40">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Test Results</h2>
        {usingFixtures && !running && (
          <span className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-700">
            FIXTURE DATA
          </span>
        )}
        {!running && result?.status === "completed" && (
          <span
            className={`ml-auto flex items-center gap-1.5 text-xs font-semibold font-mono ${
              allPass ? "text-emerald-600" : "text-red-600"
            }`}
            data-testid="passed-total"
          >
            <span aria-hidden>{allPass ? "✓" : "✗"}</span>
            {result.passed}/{result.total} passed
          </span>
        )}
        {!running && result && (
          <span className={`text-xs text-muted-foreground font-mono ${result.status === "completed" ? "" : "ml-auto"}`}>
            v{result.codeVersion} · {result.durationMs} ms
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {running && <CaseSkeleton />}

        {!running && !result && (
          <p className="text-xs text-muted-foreground">Press Run Code to execute your solution against 4 test cases.</p>
        )}

        {!running && result?.status === "error" && (
          <div className="rounded-lg border border-red-200 bg-red-50/80 p-3.5 text-xs" role="alert">
            <div className="flex items-center gap-2 font-semibold text-red-800">
              <span aria-hidden>⚠</span>
              {ERROR_TITLE[result.error.code] ?? "Run failed"}
              {result.error.line !== undefined && ` on line ${result.error.line}`}
            </div>
            <div className="mt-1 font-mono text-red-700 whitespace-pre-wrap">{result.error.message}</div>
            {result.error.retryable && (
              <div className="mt-2 text-xs text-muted-foreground">This may be temporary. Your code is unchanged; try Run again.</div>
            )}
          </div>
        )}

        {!running && result?.status === "completed" && (
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {result.cases.map((c) => (
              <li
                key={c.caseId}
                className={`rounded-lg border p-3 font-mono text-xs ${
                  c.pass ? "border-border bg-card shadow-card" : "border-red-200 bg-red-50/50"
                }`}
              >
                <div className="mb-2 flex items-center justify-between font-sans">
                  <Badge pass={c.pass} />
                  <span className="text-[11px] font-medium text-muted-foreground">{c.caseId}</span>
                </div>
                <dl className="grid grid-cols-[4.5rem_1fr] gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Input</dt>
                  <dd className="break-all text-foreground font-mono">{c.input}</dd>
                  <dt className="text-muted-foreground">Expected</dt>
                  <dd className="text-foreground font-mono">{c.expected}</dd>
                  <dt className="text-muted-foreground">Actual</dt>
                  <dd className={`font-mono font-semibold ${c.pass ? "text-emerald-600" : "text-red-600"}`}>
                    {c.actual ?? "—"}
                  </dd>
                  {c.error && (
                    <>
                      <dt className="text-red-500">Error</dt>
                      <dd className="break-all text-red-600 font-mono">{c.error}</dd>
                    </>
                  )}
                  {c.stdout && (
                    <>
                      <dt className="text-muted-foreground">Stdout</dt>
                      <dd className="break-all text-muted-foreground font-mono">{c.stdout}</dd>
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
