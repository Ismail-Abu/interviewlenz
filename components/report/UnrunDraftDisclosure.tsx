"use client";

import type { CodeSnapshot, RunResult } from "@/lib/contract";

interface Props {
  unrunDraft: CodeSnapshot;
  lastRun?: RunResult;
}

export function UnrunDraftDisclosure({ unrunDraft, lastRun }: Props) {
  return (
    <details className="group rounded-[18px] bg-[#161720]/80 p-4 text-sm text-zinc-200 border border-white/[0.08] shadow-lg">
      <summary className="cursor-pointer font-medium text-zinc-200 select-none flex items-center justify-between">
        <span className="font-mono text-xs sm:text-sm">
          Unrun draft · v{unrunDraft.codeVersion}
          {lastRun ? ` · Last tested: v${lastRun.codeVersion}` : " · No runs this attempt"}
          {lastRun?.status === "completed" && ` (${lastRun.passed}/${lastRun.total} passed)`}
        </span>
        <span className="text-xs font-mono text-zinc-400 group-open:rotate-180 transition-transform">
          ▼
        </span>
      </summary>
      <pre className="mt-3 overflow-x-auto rounded-[14px] bg-[#0E0F14] border border-white/[0.06] p-3.5 font-mono text-xs text-zinc-100 shadow-inner">
        {unrunDraft.source}
      </pre>
    </details>
  );
}
