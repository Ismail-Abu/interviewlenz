"use client";

import { useState, useSyncExternalStore } from "react";
import { BAND_LABEL, type Band } from "@/lib/score";
import { clearHistory, getHistory, getServerHistory, subscribeHistory } from "./historyStore";

const BAND_TONE: Record<Band, string> = {
  strong: "border-emerald-600/25 bg-emerald-50 text-emerald-800",
  solid: "border-sky-600/25 bg-sky-50 text-sky-800",
  developing: "border-amber-600/30 bg-amber-50 text-amber-900",
  insufficient: "border-border bg-muted text-muted-foreground",
};

const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Recent attempts from this browser. Renders nothing until there is one.
export function SessionHistory() {
  const entries = useSyncExternalStore(subscribeHistory, getHistory, getServerHistory);
  const [confirming, setConfirming] = useState(false);
  if (entries.length === 0) return null;
  const shown = entries.slice(0, 6);

  return (
    <section aria-labelledby="history-heading" className="mx-auto max-w-6xl px-5 py-10 sm:px-8" data-testid="session-history">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="history-heading" className="text-xl font-semibold tracking-tight text-foreground">
            Your recent attempts
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Saved in this browser only. Bands, not percentages.</p>
        </div>
        {confirming ? (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Clear all {entries.length}?</span>
            <button
              type="button"
              onClick={() => {
                clearHistory();
                setConfirming(false);
              }}
              className="rounded-md border border-border bg-card px-3 py-1 font-medium text-foreground hover:bg-muted"
              data-testid="history-clear-confirm"
            >
              Clear
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-md px-3 py-1 text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            data-testid="history-clear"
          >
            Clear history
          </button>
        )}
      </div>

      <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((e) => (
          <li key={e.attemptId} className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-card" data-testid="history-entry">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">{e.round === "coding" ? "Technical Coding" : "Behavioral Deep-Dive"}</span>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${BAND_TONE[e.band]}`}>{BAND_LABEL[e.band]}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <time dateTime={new Date(e.at).toISOString()}>{when(e.at)}</time>
              {e.total !== undefined && (
                <span>
                  Tests {e.passed}/{e.total}
                </span>
              )}
              {e.sample && <span className="font-medium text-amber-800">Sample feedback</span>}
            </div>
            {e.role && <p className="truncate text-xs text-muted-foreground">{e.role}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
