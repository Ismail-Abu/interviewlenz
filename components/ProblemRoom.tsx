"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ApiError, LiveClient, LiveState, Problem, RunResult, TranscriptTurn } from "@/lib/contract";
import { ProblemPanel } from "./ProblemPanel";
import { ResultsPanel } from "./ResultsPanel";
import { VoicePanel } from "./VoicePanel";
import { runCodeAdapter, setFixtureMode, USING_FIXTURES, type FixtureMode } from "./runCodeAdapter";
import { createLiveClient, fetchLiveToken, isApiError, USING_MOCK_LIVE } from "./liveAdapter";

const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => <div className="p-4 text-sm text-zinc-500">Loading editor…</div>,
});

export function ProblemRoom({ problem }: { problem: Problem }) {
  const [source, setSource] = useState(problem.starterCode);
  const [codeVersion, setCodeVersion] = useState(1);
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<FixtureMode>("cycle");
  const sessionId = useRef<string | null>(null);
  const getSessionId = () => (sessionId.current ??= crypto.randomUUID());

  // Voice session (kept in browser memory per CONTRACT.md).
  const live = useRef<LiveClient | null>(null);
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [liveError, setLiveError] = useState<ApiError | null>(null);

  useEffect(() => () => live.current?.end(), []);

  async function handleConnect() {
    setLiveError(null);
    setConnecting(true);
    try {
      const token = await fetchLiveToken(getSessionId());
      if (isApiError(token)) {
        setLiveError(token);
        setLiveState("error");
        return;
      }
      const client = createLiveClient();
      client.onState(setLiveState);
      client.onTurn((t) => setTurns((prev) => [...prev, t]));
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

  function handleEnd() {
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
    setRunning(true);
    try {
      const res = await runCodeAdapter({
        sessionId: getSessionId(),
        problemId: problem.id,
        codeVersion,
        language: "python",
        source,
      });
      setResult(res);
    } finally {
      setRunning(false);
    }
  }

  const error = result?.status === "error" ? result.error : undefined;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-4 border-b border-zinc-800 px-6 py-3">
        <span className="text-lg font-semibold tracking-tight">Interviewlenz</span>
        <span className="text-sm text-zinc-500">Python · Quick practice</span>
        {USING_FIXTURES && (
          <label className="ml-auto flex items-center gap-2 text-xs text-zinc-400">
            Dev fixture
            <select
              value={mode}
              onChange={(e) => {
                const m = e.target.value as FixtureMode;
                setMode(m);
                setFixtureMode(m);
              }}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
            >
              <option value="cycle">Cycle all four</option>
              <option value="pass">Pass (4/4)</option>
              <option value="fail">Fail (3/4)</option>
              <option value="syntax">Syntax error</option>
              <option value="unavailable">Runner unavailable</option>
            </select>
          </label>
        )}
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
            turns={turns}
            error={liveError}
            mocked={USING_MOCK_LIVE}
            onConnect={handleConnect}
            onToggleMic={handleToggleMic}
            onEnd={handleEnd}
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
            <ResultsPanel result={result} running={running} usingFixtures={USING_FIXTURES} />
          </div>
        </div>
      </main>
    </div>
  );
}
