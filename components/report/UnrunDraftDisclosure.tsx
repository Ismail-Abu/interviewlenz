"use client";

import type { CodeSnapshot, RunResult } from "@/lib/contract";

interface Props {
  unrunDraft: CodeSnapshot;
  lastRun?: RunResult;
}

export function UnrunDraftDisclosure({ unrunDraft, lastRun }: Props) {
  return (
    <details className="group rounded-xl bg-card p-4 text-sm text-foreground border border-border shadow-sm">
      <summary className="cursor-pointer font-medium text-foreground select-none flex items-center justify-between">
        <span className="font-mono text-xs sm:text-sm">
          Unrun draft · v{unrunDraft.codeVersion}
          {lastRun ? ` · Last tested: v${lastRun.codeVersion}` : " · No runs this attempt"}
          {lastRun?.status === "completed" && ` (${lastRun.passed}/${lastRun.total} passed)`}
        </span>
        <span className="text-xs font-mono text-muted-foreground group-open:rotate-180 transition-transform">
          ▼
        </span>
      </summary>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-background border border-border p-3.5 font-mono text-xs text-foreground">
        {unrunDraft.source}
      </pre>
    </details>
  );
}
