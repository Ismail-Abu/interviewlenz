"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ApiError, CodeSnapshot, CodingSession, LiveClient, LiveState, Problem, RoundType, RunResult, Session } from "@/lib/contract";
import { ProblemPanel } from "./ProblemPanel";
import { ResultsPanel } from "./ResultsPanel";
import { VoicePanel } from "./VoicePanel";
import { BehavioralRoom } from "./BehavioralRoom";
import { ReportView, type AttemptRecord } from "./ReportView";
import { StartScreen, type MicStatus } from "./StartScreen";
import { hasJob, toRoleContext, type CandidateProfile } from "./landing/profile";
import { Wordmark } from "./Logo";
import { EditorSkeleton } from "./Skeletons";
import { runCodeAdapter, type RunMode } from "./runCodeAdapter";
import { fetchLiveToken, isApiError, openVoice, type BehavioralRound, type VoiceMode } from "./liveAdapter";
import { DEFAULT_REPORT_MODE, requestReport, type ReportMode } from "./reportAdapter";
import { preloadRunner } from "@/lib/runner";
import { btn } from "./ui/buttons";

const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});

const DEV = process.env.NODE_ENV !== "production";

type AttemptIds = Pick<Session, "sessionId" | "attemptId" | "priorAttemptId">;
type AttemptData = Pick<CodingSession, "turns" | "snapshots" | "runs">;
const EMPTY_ATTEMPT: AttemptData = { turns: [], snapshots: [], runs: [] };

export function ProblemRoom({ problem }: { problem: Problem }) {
  // One Session per attempt, kept in browser memory (CONTRACT.md). IDs are
  // minted on first use in an event handler: Cache Components forbids random
  // values during prerender, and the room never renders them.
  const idsRef = useRef<AttemptIds | null>(null);
  const ids = () => (idsRef.current ??= { sessionId: crypto.randomUUID(), attemptId: crypto.randomUUID() });
  const [attempt, setAttempt] = useState<AttemptData>(EMPTY_ATTEMPT);
  const fullSession = (): Session =>
    round === "behavioral"
      ? { ...ids(), roundType: "behavioral", turns: attempt.turns, ...(behavioralRole ? { roleContext: behavioralRole } : {}) }
      : codingSession();
  const codingSession = (): CodingSession => ({
    ...ids(),
    problemId: problem.id,
    ...attempt,
    ...(roleContext ? { roleContext } : {}),
  });
  const [view, setView] = useState<"start" | "room" | "report">("start");
  const [records, setRecords] = useState<AttemptRecord[]>([]);
  const [micStatus, setMicStatus] = useState<MicStatus>("unchecked");
  // From the landing page. Browser-only and display-only: never added to the
  // Session, the token request, or the Live session (no backend fields for it).
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  // Text fields only, sent to the token route (every connect, incl. Reconnect)
  // and in the Session for the report. Resume screenshots stay local.
  const roleContext = profile ? toRoleContext(profile.job) : undefined;
  // Interview round chosen on the landing page. Behavioral uses no code at all.
  const [round, setRound] = useState<RoundType>("coding");
  // Behavioral rounds never send the raw job listing: title, company, level only.
  const behavioralRole = (() => {
    if (!roleContext) return undefined;
    const { jobDescription, ...rest } = roleContext;
    void jobDescription;
    return Object.keys(rest).length ? rest : undefined;
  })();
  const behavioralRound: BehavioralRound | undefined = round === "behavioral" ? { type: "behavioral" } : undefined;

  const [source, setSource] = useState(problem.starterCode);
  const [codeVersion, setCodeVersion] = useState(1);
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<RunMode>("real");
  const [reportMode, setReportMode] = useState<ReportMode>(DEFAULT_REPORT_MODE);
  const [fromFixture, setFromFixture] = useState(false);

  // Start loading Pyodide as soon as the app opens (CONTRACT.md), so it is
  // warm by the time the student leaves the start screen.
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
  const [voiceMode, setVoiceMode] = useState<VoiceMode | null>(null);
  const [mockReason, setMockReason] = useState<string | undefined>();
  // Reconnect (docs/CONTRACT.md): after a retryable disconnect the real client
  // is kept and reconnected in place with a fresh token.
  const [disconnected, setDisconnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectInFlight = useRef(false);
  const voiceModeRef = useRef<VoiceMode | null>(null);
  // Turns accepted in the current attempt; seeds every client built within the
  // attempt so transcript IDs keep increasing. Retry resets it to 0.
  const turnCount = useRef(0);

  // Code-context sync (B5): the real client gets the editor buffer silently via
  // syncCode, once on connect and after a typing pause. Refs, not state, so a
  // timer or a just-resolved connect always sees the latest buffer.
  const latest = useRef({ codeVersion: 1, source: problem.starterCode });
  const lastSyncedVersion = useRef<number | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncEnabled = useRef(false); // true only while a real (non-mock) client is connected
  // Bumped whenever a voice connection ends. Callbacks and a connect that
  // resolves late check it, so nothing from an ended connection reaches the
  // current attempt.
  const connGen = useRef(0);

  function cancelPendingSync() {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = null;
  }

  function syncLatest() {
    syncTimer.current = null;
    const client = live.current;
    if (!syncEnabled.current || !client?.syncCode) return;
    const { codeVersion: v, source: src } = latest.current;
    if (v === lastSyncedVersion.current) return;
    client.syncCode({ codeVersion: v, source: src, at: new Date().toISOString() });
    lastSyncedVersion.current = v;
  }

  useEffect(
    () => () => {
      cancelPendingSync();
      live.current?.end();
    },
    [],
  );

  async function handleConnect() {
    setLiveError(null);
    setConnecting(true);
    const gen = ++connGen.current;
    const current = () => gen === connGen.current;
    try {
      const conn = await openVoice(
        ids().sessionId,
        problem,
        {
          onState: (s) => {
            if (!current()) return;
            setLiveState(s);
            // The real client signals a lost connection with state "error" (a
            // mic failure only raises onError). Keep the client; offer Reconnect.
            if (s === "error" && voiceModeRef.current === "live" && live.current) setDisconnected(true);
          },
          onTurn: (t) => {
            if (!current()) return;
            turnCount.current += 1;
            setAttempt((s) => ({ ...s, turns: [...s.turns, t] }));
          },
          // Show the error only; never touch the mute choice here.
          onError: (e) => current() && setLiveError(e),
        },
        turnCount.current,
        round === "behavioral" ? behavioralRole : roleContext,
        behavioralRound,
      );
      if (!current()) {
        // Ended (End, Finish, or Retry) while connecting: drop this connection.
        conn.client.end();
        return;
      }
      live.current = conn.client;
      voiceModeRef.current = conn.mode;
      // Initial sync: the buffer as it is now, including edits made while connecting.
      syncEnabled.current = conn.mode === "live";
      lastSyncedVersion.current = null;
      syncLatest();
      setVoiceMode(conn.mode);
      setMockReason(conn.mockReason);
      setConnected(true);
      try {
        await conn.client.startMic();
        setMicOn(true);
      } catch {
        setLiveError({ code: "provider_unavailable", message: "Microphone unavailable", retryable: true });
      }
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

  // Reconnect the retained real client in place: fresh token for the same
  // session, then connect() on that same client. No openVoice, no new client,
  // no startMic (mic and playback persist, so the mute choice is kept), no mock.
  // lib/live.ts restores the code buffer and latest Run on the new session.
  async function handleReconnect() {
    const client = live.current;
    if (!client || voiceModeRef.current !== "live" || reconnectInFlight.current) return;
    reconnectInFlight.current = true;
    setReconnecting(true);
    const gen = connGen.current;
    // A late result is ignored if End, Finish, or Retry happened meanwhile.
    const current = () => gen === connGen.current && live.current === client;
    try {
      const token = await fetchLiveToken(
        ids().sessionId,
        round === "behavioral" ? behavioralRole : roleContext,
        behavioralRound?.type,
      );
      if (!current()) return;
      if (isApiError(token)) {
        setLiveError(token);
        return;
      }
      await client.connect(token, problem);
      if (!current()) return;
      setLiveError(null);
      setDisconnected(false);
    } catch {
      // lib/live.ts already reported the failure through onError/onState;
      // Reconnect stays available for another try.
      if (current()) setLiveError((e) => e ?? { code: "provider_unavailable", message: "Could not reconnect", retryable: true });
    } finally {
      if (gen === connGen.current) {
        reconnectInFlight.current = false;
        setReconnecting(false);
      }
    }
  }

  function endLive() {
    connGen.current++;
    cancelPendingSync();
    syncEnabled.current = false;
    reconnectInFlight.current = false;
    voiceModeRef.current = null;
    live.current?.end();
    live.current = null;
    setConnected(false);
    setMicOn(false);
    setLiveState(null);
    setDisconnected(false);
    setReconnecting(false);
    // An error from a session the user has ended no longer applies.
    setLiveError(null);
  }

  function handleEdit(next: string) {
    const v = latest.current.codeVersion + 1;
    latest.current = { codeVersion: v, source: next };
    setSource(next);
    setCodeVersion(v);
    // Debounce: each edit restarts the 2 s timer, so a burst of edits syncs
    // once, with the latest version.
    if (syncEnabled.current) {
      cancelPendingSync();
      syncTimer.current = setTimeout(syncLatest, 2000);
    }
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
      // The Run carried this exact source, so a pending sync of the same
      // version is redundant. A newer edit still syncs after its pause.
      if (live.current) {
        lastSyncedVersion.current = Math.max(lastSyncedVersion.current ?? 0, snapshot.codeVersion);
      }
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
            ? {
                session: target,
                status: "done",
                report: outcome.report,
                fromFixture: outcome.fromFixture,
                fallbackReason: outcome.fallbackReason,
              }
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
    // Finish already ended voice; ending again also drops anything still
    // pending or still connecting from the previous attempt.
    endLive();
    lastSyncedVersion.current = null;
    latest.current = { codeVersion: 1, source: problem.starterCode };
    turnCount.current = 0; // new attempt: transcript IDs may restart at t1
    setAttempt(EMPTY_ATTEMPT);
    setSource(problem.starterCode);
    setCodeVersion(1);
    setResult(null);
    setFromFixture(false);
    setLiveError(null);
    setView("room");
  }

  if (view === "start") {
    return (
      <StartScreen
        micStatus={micStatus}
        onMicStatus={setMicStatus}
        onStart={(p, r) => {
          setProfile(p);
          setRound(r ?? "coding");
          setView("room");
        }}
      />
    );
  }

  if (view === "report") {
    return <ReportView records={records} onRetryReport={handleRetryReport} onRetryAttempt={handleRetryAttempt} />;
  }

  const error = result?.status === "error" ? result.error : undefined;
  const attemptNumber = records.length + 1;
  const voiceProps = {
    connected,
    connecting,
    micOn,
    state: liveState,
    turns: attempt.turns,
    error: liveError,
    voiceMode,
    mockReason,
    micStatus,
    disconnected,
    reconnecting,
    onReconnect: handleReconnect,
    onConnect: handleConnect,
    onToggleMic: handleToggleMic,
    onEnd: endLive,
  };

  if (round === "behavioral") {
    return <BehavioralRoom voice={voiceProps} attemptNumber={attemptNumber} onFinish={handleFinish} />;
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-4 border-b border-zinc-800 px-6 py-3">
        <Wordmark size={26} />
        <span className="hidden text-base text-zinc-400 md:inline">
          Python · {problem.title}
          {attemptNumber > 1 && ` · Attempt ${attemptNumber}`}
        </span>
        {profile && hasJob(profile.job) && (
          <span
            className="hidden max-w-xs truncate rounded-full border border-brand-coral/40 bg-brand-coral/10 px-3 py-1 text-sm text-brand-coral lg:inline"
            data-testid="target-role"
            title="From your setup. Tailored rounds are a preview."
          >
            Practicing for {profile.job.role.trim() || "your role"}
            {profile.job.company.trim() && ` at ${profile.job.company.trim()}`}
          </span>
        )}
        <span className="ml-auto text-sm text-zinc-500" data-testid="session-stats">
          {attempt.snapshots.length} snapshots · {attempt.runs.length} runs · {attempt.turns.length} turns
        </span>
        {DEV && (
          <details className="relative">
            <summary className="cursor-pointer select-none rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">
              Dev
            </summary>
            <div className="absolute right-0 z-20 mt-2 flex w-72 flex-col gap-3 rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl">
              <label className="flex flex-col gap-1 text-sm text-zinc-400">
                Run with
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as RunMode)}
                  className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-200"
                >
                  <option value="real">Python runner</option>
                  <option value="cycle">Fixtures: cycle all four</option>
                  <option value="pass">Fixture: pass (4/4)</option>
                  <option value="fail">Fixture: fail (3/4)</option>
                  <option value="syntax">Fixture: syntax error</option>
                  <option value="unavailable">Fixture: runner unavailable</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-zinc-400">
                Report
                <select
                  value={reportMode}
                  onChange={(e) => setReportMode(e.target.value as ReportMode)}
                  className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-200"
                >
                  <option value="auto">Auto: /api/report, else fixture</option>
                  <option value="fixture">Fixture only</option>
                  <option value="fixture-error">Fixture: 503 once, then OK</option>
                  <option value="api">/api/report only</option>
                </select>
              </label>
            </div>
          </details>
        )}
        <button
          onClick={handleFinish}
          disabled={running}
          className={`${btn.secondary} px-5 py-2 text-base`}
        >
          Finish
        </button>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-h-0 flex-col border-zinc-800 lg:border-r">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ProblemPanel problem={problem} />
          </div>
          <VoicePanel {...voiceProps} />
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
            <span className="font-mono text-sm text-zinc-500">solution.py · v{codeVersion}</span>
            <button
              onClick={handleRun}
              disabled={running}
              className={`${btn.primary} min-w-[7rem] px-5 py-2 text-base`}
            >
              {running ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                  Running
                </>
              ) : (
                <>
                  <span aria-hidden>▶</span> Run
                </>
              )}
            </button>
          </div>
          <div className="min-h-0 flex-[3] bg-[#1e1e1e]">
            <CodeEditor value={source} onChange={handleEdit} errorLine={error?.line} errorMessage={error?.message} />
          </div>
          <div className="h-[38%] min-h-[220px] border-t border-zinc-800">
            <ResultsPanel result={result} running={running} usingFixtures={fromFixture} />
          </div>
        </div>
      </main>
    </div>
  );
}
