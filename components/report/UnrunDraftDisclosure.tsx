"use client";

import type { CodeSnapshot, RunResult } from "@/lib/contract";

interface Props {
  unrunDraft: CodeSnapshot;
  lastRun?: RunResult;
}

export function UnrunDraftDisclosure({ unrunDraft, lastRun }: Props) {
  return (
    <details className="group rounded-[20px] bg-cream-3/70 p-4 text-sm text-ink border border-cream-line/80 shadow-[0_10px_18px_-6px_rgb(90_68_50/0.05)]">
      <summary className="cursor-pointer font-medium text-ink select-none flex items-center justify-between">
        <span>
          Unrun draft · v{unrunDraft.codeVersion}
          {lastRun ? ` · Last run: v${lastRun.codeVersion}` : " · No runs this attempt"}
          {lastRun?.status === "completed" && ` (${lastRun.passed}/${lastRun.total} passed)`}
        </span>
        <span className="text-xs font-mono text-ink-muted group-open:rotate-180 transition-transform">
          ▼
        </span>
      </summary>
      <pre className="mt-3 overflow-x-auto rounded-[14px] bg-panel p-3.5 font-mono text-xs text-zinc-100 shadow-inner">
        {unrunDraft.source}
      </pre>
    </details>
  );
}
