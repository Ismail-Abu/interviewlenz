"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ApiError, CodeSnapshot, LiveClient, LiveState, Problem, RunResult, Session } from "@/lib/contract";
import { ProblemPanel } from "./ProblemPanel";
import { ResultsPanel } from "./ResultsPanel";
import { VoicePanel } from "./VoicePanel";
import { ReportView, type AttemptRecord } from "./ReportView";
import { runCodeAdapter, type RunMode } from "./runCodeAdapter";
import { createLiveClient, fetchLiveToken, isApiError, USING_MOCK_LIVE } from "./liveAdapter";
import { DEFAULT_REPORT_MODE, requestReport, type ReportMode } from "./reportAdapter";
import { preloadRunner } from "@/lib/runner";

const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => <div className="p-4 text-sm text-zinc-500">Loading editor…</div>,
});

const DEV = process.env.NODE_ENV !== "production";

type AttemptIds = Pick<Session, "sessionId" | "attemptId" | "priorAttemptId">;
type AttemptData = Pick<Session, "turns" | "snapshots" | "runs">;
const EMPTY_ATTEMPT: AttemptData = { turns: [], snapshots: [], runs: [] };

export function ProblemRoom({ problem }: { problem: Problem }) {
  // One Session per attempt, kept in browser memory (CONTRACT.md). IDs are
  // minted on first use in an event handler: Cache Components forbids random
  // values during prerender, and the room never renders them.
  const idsRef = useRef<AttemptIds | null>(null);
  const ids = () => (idsRef.current ??= { sessionId: crypto.randomUUID(), attemptId: crypto.randomUUID() });
  const [attempt, setAttempt] = useState<AttemptData>(EMPTY_ATTEMPT);
  const fullSession = (): Session => ({ ...ids(), problemId: problem.id, ...attempt });
  const [view, setView] = useState<"room" | "report">("room");
  const [records, setRecords] = useState<AttemptRecord[]>([]);

  const [source, setSource] = useState(problem.starterCode);
  const [codeVersion, setCodeVersion] = useState(1);
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<RunMode>("real");
  const [reportMode, setReportMode] = useState<ReportMode>(DEFAULT_REPORT_MODE);
  const [fromFixture, setFromFixture] = useState(false);

  // Start loading Pyodide as soon as the page opens (CONTRACT.md).
  useEffect(() => {
    void preloadRunner();
  }, []);

  // Voice session.
  const live = useRef<LiveClient | null>(null);
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [liveError, setLiveError] = useState<ApiError | null>(null);

  useEffect(() => () => live.current?.end(), []);

  async function handleConnect() {
    setLiveError(null);
    setConnecting(true);
    try {
      const token = await fetchLiveToken(ids().sessionId);
      if (isApiError(token)) {
        setLiveError(token);
        setLiveState("error");
        return;
      }
      const client = createLiveClient();
      client.onState(setLiveState);
      client.onTurn((t) => setAttempt((s) => ({ ...s, turns: [...s.turns, t] })));
      client.onError((e) => {
        setLiveError(e);
        setMicOn(false);
      });
      await client.connect(token, problem);
      live.current = client;
      setConnected(true);
      await client.startMic();
      setMicOn(true);
    } catch {
      setLiveError({ code: "provider_unavailable", message: "Could not start the voice session", retryable: true });
      setLiveState("error");
    } finally {
      setConnecting(false);
    }
  }

  async function handleToggleMic() {
    const client = live.current;
    if (!client) return;
    if (micOn) {
      client.stopMic();
      setMicOn(false);
    } else {
      try {
        await client.startMic();
        setMicOn(true);
      } catch {
        setLiveError({ code: "provider_unavailable", message: "Microphone unavailable", retryable: true });
      }
    }
  }

  function endLive() {
    live.current?.end();
    live.current = null;
    setConnected(false);
    setMicOn(false);
    setLiveState(null);
  }

  function handleEdit(next: string) {
    setSource(next);
    setCodeVersion((v) => v + 1);
  }

  async function handleRun() {
    const snapshot: CodeSnapshot = { codeVersion, source, at: new Date().toISOString() };
    setAttempt((s) => ({ ...s, snapshots: [...s.snapshots, snapshot] }));
    setRunning(true);
    try {
      const res = await runCodeAdapter(
        {
          sessionId: ids().sessionId,
          problemId: problem.id,
          codeVersion,
          language: "python",
          source,
        },
        mode,
      );
      setAttempt((s) => ({ ...s, runs: [...s.runs, res.result] }));
      setResult(res.result);
      setFromFixture(res.fromFixture);
      live.current?.sendRunContext(snapshot, res.result);
    } finally {
      setRunning(false);
    }
  }

  async function loadReport(target: Session) {
    setRecords((rs) =>
      rs.map((r) => (r.session.attemptId === target.attemptId ? { session: target, status: "loading" } : r)),
    );
    const outcome = await requestReport(target, reportMode);
    setRecords((rs) =>
      rs.map((r) =>
        r.session.attemptId !== target.attemptId
          ? r
          : outcome.ok
            ? { session: target, status: "done", report: outcome.report, fromFixture: outcome.fromFixture }
            : { session: target, status: "error", error: outcome.error },
      ),
    );
  }

  function handleFinish() {
    endLive();
    const finished = fullSession();
    setRecords((rs) => [...rs, { session: finished, status: "loading" }]);
    setView("report");
    void loadReport(finished);
  }

  function handleRetryReport(attemptId: string) {
    const rec = records.find((r) => r.session.attemptId === attemptId);
    if (rec) void loadReport(rec.session);
  }

  function handleRetryAttempt() {
    const prior = ids();
    idsRef.current = { sessionId: prior.sessionId, attemptId: crypto.randomUUID(), priorAttemptId: prior.attemptId };
    setAttempt(EMPTY_ATTEMPT);
    setSource(problem.starterCode);
    setCodeVersion(1);
    setResult(null);
    setFromFixture(false);
    setLiveError(null);
    setView("room");
  }

  if (view === "report") {
    return <ReportView records={records} onRetryReport={handleRetryReport} onRetryAttempt={handleRetryAttempt} />;
  }

  const error = result?.status === "error" ? result.error : undefined;
  const attemptNumber = records.length + 1;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center gap-4 border-b border-zinc-800 px-6 py-3">
        <span className="text-lg font-semibold tracking-tight">Interviewlenz</span>
        <span className="text-sm text-zinc-500">
          Python · Quick practice{attemptNumber > 1 && ` · Attempt ${attemptNumber}`}
        </span>
        <span className="text-xs text-zinc-500" data-testid="session-stats">
          {attempt.snapshots.length} snapshots · {attempt.runs.length} runs · {attempt.turns.length} turns
        </span>
        <div className="ml-auto flex items-center gap-4">
          {DEV && (
            <>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                Run with
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as RunMode)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
                >
                  <option value="real">Python runner</option>
                  <option value="cycle">Fixtures: cycle all four</option>
                  <option value="pass">Fixture: pass (4/4)</option>
                  <option value="fail">Fixture: fail (3/4)</option>
                  <option value="syntax">Fixture: syntax error</option>
                  <option value="unavailable">Fixture: runner unavailable</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                Report
                <select
                  value={reportMode}
                  onChange={(e) => setReportMode(e.target.value as ReportMode)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
                >
                  <option value="fixture">Fixture</option>
                  <option value="fixture-error">Fixture: 503 once, then OK</option>
                  <option value="api">/api/report</option>
                </select>
              </label>
            </>
          )}
          <button
            onClick={handleFinish}
            disabled={running}
            className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
          >
            Finish
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-h-0 flex-col border-zinc-800 lg:border-r">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ProblemPanel problem={problem} />
          </div>
          <VoicePanel
            connected={connected}
            connecting={connecting}
            micOn={micOn}
            state={liveState}
            turns={attempt.turns}
            error={liveError}
            mocked={USING_MOCK_LIVE}
            onConnect={handleConnect}
            onToggleMic={handleToggleMic}
            onEnd={endLive}
          />
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
            <span className="font-mono text-xs text-zinc-500">solution.py · v{codeVersion}</span>
            <button
              onClick={handleRun}
              disabled={running}
              className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? "Running…" : "Run"}
            </button>
          </div>
          <div className="min-h-[300px] flex-[3] bg-[#1e1e1e]">
            <CodeEditor
              value={source}
              onChange={handleEdit}
              errorLine={error?.line}
              errorMessage={error?.message}
            />
          </div>
          <div className="min-h-[200px] flex-[2] border-t border-zinc-800">
            <ResultsPanel result={result} running={running} usingFixtures={fromFixture} />
          </div>
        </div>
      </main>
    </div>
  );
}
