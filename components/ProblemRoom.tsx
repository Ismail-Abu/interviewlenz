"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ApiError, BehavioralContext, CodeSnapshot, CodingSession, LiveClient, LiveState, Problem, RoundType, RunResult, Session } from "@/lib/contract";
import { ProblemPanel } from "./ProblemPanel";
import { ResultsPanel } from "./ResultsPanel";
import { VoicePanel } from "./VoicePanel";
import { BehavioralRoom } from "./BehavioralRoom";
import { ReportView, type AttemptRecord } from "./ReportView";
import { FullMockSummary } from "./FullMockSummary";
import { StartScreen, type MicStatus, type PracticeMode } from "./StartScreen";
import { hasJob, toRoleContext, type CandidateProfile } from "./landing/profile";
import { Wordmark } from "./Logo";
import { EditorSkeleton } from "./Skeletons";
import { runCodeAdapter, type RunMode } from "./runCodeAdapter";
import { fetchLiveToken, isApiError, openVoice, type BehavioralRound, type VoiceMode } from "./liveAdapter";
import { DEFAULT_REPORT_MODE, requestReport, type ReportMode } from "./reportAdapter";
import { preloadRunner } from "@/lib/runner";
import { behavioralOpeningExtra, isBehavioralSession } from "@/lib/behavioral";
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

  const [practiceMode, setPracticeMode] = useState<PracticeMode>("coding");
  const [round, setRound] = useState<RoundType>("coding");
  const [view, setView] = useState<"start" | "room" | "report" | "transition" | "summary">("start");
  const [codingRecords, setCodingRecords] = useState<AttemptRecord[]>([]);
  const [behavioralRecords, setBehavioralRecords] = useState<AttemptRecord[]>([]);

  const activeRecords = round === "behavioral" ? behavioralRecords : codingRecords;

  const [micStatus, setMicStatus] = useState<MicStatus>("unchecked");
  const [profile, setProfile] = useState<CandidateProfile | null>(null);

  // Text fields only, sent to the token route (every connect, incl. Reconnect)
  // and in the Session for the report. Resume screenshots stay local.
  const roleContext = profile ? toRoleContext(profile.job) : undefined;

  // Behavioral rounds never send the raw job listing: title, company, level only.
  const behavioralRole = (() => {
    if (!roleContext) return undefined;
    const { jobDescription, ...rest } = roleContext;
    void jobDescription;
    return Object.keys(rest).length ? rest : undefined;
  })();

  // Personalization confirmed on the landing page (no files, listing, or
  // excerpts). Kept for Reconnect and Practice again; never re-analyzed.
  const [behavioralContext, setBehavioralContext] = useState<BehavioralContext | undefined>(undefined);
  const behavioralRound: BehavioralRound | undefined =
    round === "behavioral"
      ? {
          type: "behavioral",
          ...(behavioralContext ? { context: behavioralContext, openingExtra: behavioralOpeningExtra(behavioralContext) } : {}),
        }
      : undefined;
  const focusLabel = behavioralContext
    ? [behavioralContext.project?.name, behavioralContext.focus?.skill].filter(Boolean).join(" · ")
    : undefined;

  const fullSession = (): Session =>
    round === "behavioral"
      ? {
          ...ids(),
          roundType: "behavioral",
          turns: attempt.turns,
          ...(behavioralRole ? { roleContext: behavioralRole } : {}),
          ...(behavioralContext ? { behavioralContext } : {}),
        }
      : codingSession();

  function codingSession(): CodingSession {
    const draft = latest.current;
    const lastSnapshot = attempt.snapshots.at(-1);
    const hasUnrunEdit = draft.codeVersion > 1 && lastSnapshot?.codeVersion !== draft.codeVersion;
    return {
      ...ids(),
      problemId: problem.id,
      ...attempt,
      snapshots: hasUnrunEdit
        ? [...attempt.snapshots, { ...draft, at: new Date().toISOString() }]
        : attempt.snapshots,
      ...(roleContext ? { roleContext } : {}),
    };
  }

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
    if (!live.current || !syncEnabled.current) return;
    const cur = latest.current;
    if (lastSyncedVersion.current === cur.codeVersion) return;
    live.current.syncCode?.({ codeVersion: cur.codeVersion, source: cur.source, at: new Date().toISOString() });
    lastSyncedVersion.current = cur.codeVersion;
  }

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
          onState: (s: LiveState) => {
            if (!current()) return;
            setLiveState(s);
            if (s === "error" && voiceModeRef.current === "live" && live.current) setDisconnected(true);
          },
          onTurn: (t) => {
            if (!current()) return;
            turnCount.current += 1;
            setAttempt((s) => ({ ...s, turns: [...s.turns, t] }));
          },
          onError: (e: ApiError) => current() && setLiveError(e),
        },
        turnCount.current,
        round === "behavioral" ? behavioralRole : roleContext,
        behavioralRound,
      );

      if (!current()) {
        conn.client.end();
        return;
      }

      live.current = conn.client;
      voiceModeRef.current = conn.mode;
      syncEnabled.current = conn.mode === "live";
      lastSyncedVersion.current = null;
      if (round === "coding") syncLatest();
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

  async function handleReconnect() {
    const client = live.current;
    if (!client || voiceModeRef.current !== "live" || reconnectInFlight.current) return;
    reconnectInFlight.current = true;
    setReconnecting(true);
    const gen = connGen.current;
    const current = () => gen === connGen.current && live.current === client;

    try {
      const token = await fetchLiveToken(
        ids().sessionId,
        round === "behavioral" ? behavioralRole : roleContext,
        behavioralRound?.type,
        behavioralRound?.context,
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
      live.current?.sendRunContext?.(snapshot, res.result);
      if (live.current) {
        lastSyncedVersion.current = Math.max(lastSyncedVersion.current ?? 0, snapshot.codeVersion);
      }
    } finally {
      setRunning(false);
    }
  }

  async function loadReport(target: Session) {
    const isBeh = isBehavioralSession(target);
    const updateRecords = (fn: (rs: AttemptRecord[]) => AttemptRecord[]) => {
      if (isBeh) setBehavioralRecords(fn);
      else setCodingRecords(fn);
    };

    updateRecords((rs) =>
      rs.map((r) => (r.session.attemptId === target.attemptId ? { session: target, status: "loading" } : r)),
    );
    const outcome = await requestReport(target, reportMode);
    updateRecords((rs) =>
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
    if (practiceMode === "full-mock") {
      if (round === "coding") {
        setCodingRecords((rs) => [...rs, { session: finished, status: "loading" }]);
        void loadReport(finished);
        setView("transition");
      } else {
        setBehavioralRecords((rs) => [...rs, { session: finished, status: "loading" }]);
        void loadReport(finished);
        setView("summary");
      }
    } else {
      // Standalone mode
      if (round === "behavioral") {
        setBehavioralRecords((rs) => [...rs, { session: finished, status: "loading" }]);
      } else {
        setCodingRecords((rs) => [...rs, { session: finished, status: "loading" }]);
      }
      setView("report");
      void loadReport(finished);
    }
  }

  function handleContinueToBehavioral() {
    endLive();
    const prior = ids();
    idsRef.current = { sessionId: prior.sessionId, attemptId: crypto.randomUUID(), priorAttemptId: prior.attemptId };
    turnCount.current = 0;
    setAttempt(EMPTY_ATTEMPT);
    setRound("behavioral");
    setView("room");
  }

  function handleRetryReport(attemptId: string) {
    const rec = [...codingRecords, ...behavioralRecords].find((r) => r.session.attemptId === attemptId);
    if (rec) void loadReport(rec.session);
  }

  function handleRetryAttempt() {
    const prior = ids();
    idsRef.current = { sessionId: prior.sessionId, attemptId: crypto.randomUUID(), priorAttemptId: prior.attemptId };
    endLive();
    turnCount.current = 0;
    setAttempt(EMPTY_ATTEMPT);
    setLiveError(null);

    if (round === "coding") {
      lastSyncedVersion.current = null;
      latest.current = { codeVersion: 1, source: problem.starterCode };
      setSource(problem.starterCode);
      setCodeVersion(1);
      setResult(null);
      setFromFixture(false);
    }
    setView("room");
  }

  function handlePracticeAgain(targetRound: RoundType) {
    endLive();
    const prior = ids();
    idsRef.current = { sessionId: prior.sessionId, attemptId: crypto.randomUUID(), priorAttemptId: prior.attemptId };
    turnCount.current = 0;
    setAttempt(EMPTY_ATTEMPT);
    setLiveError(null);

    if (targetRound === "coding") {
      lastSyncedVersion.current = null;
      latest.current = { codeVersion: 1, source: problem.starterCode };
      setSource(problem.starterCode);
      setCodeVersion(1);
      setResult(null);
      setFromFixture(false);
      setRound("coding");
    } else {
      setRound("behavioral");
    }
    setView("room");
  }

  if (view === "start") {
    return (
      <StartScreen
        micStatus={micStatus}
        onMicStatus={setMicStatus}
        onStart={(p, m, ctx) => {
          setProfile(p);
          setPracticeMode(m);
          setBehavioralContext(ctx);
          if (m === "behavioral") {
            setRound("behavioral");
          } else {
            // "coding" or "full-mock" starts with coding
            setRound("coding");
          }
          setView("room");
        }}
      />
    );
  }

  if (view === "transition") {
    const lastCodingRecord = codingRecords.at(-1);
    const lastCodingSession = lastCodingRecord?.session as CodingSession | undefined;
    const lastCodingRun = lastCodingSession?.runs.at(-1);
    const codingReportStatus = lastCodingRecord?.status;

    return (
      <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100" data-testid="full-mock-transition">
        <header className="flex items-center gap-4 border-b border-zinc-800 bg-zinc-950/95 px-6 py-3">
          <Wordmark size={26} />
          <span className="text-base text-zinc-400">Full Mock Interview · Transition</span>
        </header>

        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-12">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                ✓ Round 1 Complete
              </span>
              <span className="text-xs text-zinc-500">Step 1 of 2</span>
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-50">Coding round complete</h1>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              {lastCodingRun?.status === "completed"
                ? `Your Python solution passed ${lastCodingRun.passed} of ${lastCodingRun.total} test cases.`
                : "Your coding draft and interview responses have been saved."}
            </p>

            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-brand-coral mb-1">
                Next Up: Round 2 · Behavioral Practice
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">
                The interviewer will transition to questions about your engineering experiences, technical decisions, and personal contributions.
              </p>
              {focusLabel && (
                <p className="mt-2 text-xs text-zinc-400 font-medium">Tailored focus: {focusLabel}</p>
              )}
              {codingReportStatus === "loading" && (
                <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500" data-testid="bg-report-loading">
                  <span className="h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-zinc-200" />
                  Generating coding feedback in background…
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleContinueToBehavioral}
                className={`${btn.primary} flex-1 justify-center py-3 text-base font-semibold`}
                data-testid="continue-behavioral"
              >
                Continue to Behavioral Round →
              </button>
              <button
                type="button"
                onClick={() => setView("report")}
                className={`${btn.secondary} justify-center py-3 text-sm font-medium`}
                data-testid="view-coding-feedback"
              >
                View coding feedback
              </button>
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setView("summary")}
                className="text-xs text-zinc-500 hover:text-zinc-300 underline-offset-4 hover:underline"
                data-testid="end-early"
              >
                End interview early & view summary
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (view === "summary") {
    return (
      <FullMockSummary
        codingRecord={codingRecords.at(-1)}
        behavioralRecord={behavioralRecords.at(-1)}
        onRetryReport={handleRetryReport}
        onPracticeAgain={handlePracticeAgain}
        onReturnHome={() => setView("start")}
      />
    );
  }

  if (view === "report") {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        {practiceMode === "full-mock" && round === "coding" && (
          <div className="bg-brand-coral/10 border-b border-brand-coral/30 px-6 py-2.5 flex items-center justify-between text-sm">
            <span className="text-zinc-300 text-xs sm:text-sm">
              Round 1 (Coding) feedback. Ready for Round 2?
            </span>
            <button
              onClick={handleContinueToBehavioral}
              className={`${btn.primary} px-3.5 py-1.5 text-xs font-semibold`}
              data-testid="report-continue-behavioral"
            >
              Continue to Behavioral Round →
            </button>
          </div>
        )}
        <ReportView
          records={activeRecords}
          onRetryReport={handleRetryReport}
          onRetryAttempt={handleRetryAttempt}
        />
      </div>
    );
  }

  const error = result?.status === "error" ? result.error : undefined;
  const attemptNumber = activeRecords.length + 1;
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
    return (
      <BehavioralRoom
        voice={voiceProps}
        attemptNumber={attemptNumber}
        focusLabel={focusLabel}
        onFinish={handleFinish}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950 lg:h-screen text-zinc-100">
      <header className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-3 sm:gap-4 sm:px-6">
        <Wordmark size={26} />
        <span className="hidden text-base text-zinc-400 md:inline">
          Python · {problem.title}
          {attemptNumber > 1 && ` · Attempt ${attemptNumber}`}
          {practiceMode === "full-mock" && " · Round 1 of 2"}
        </span>
        {profile && hasJob(profile.job) && (
          <span
            className="hidden max-w-xs truncate rounded-full border border-brand-coral/40 bg-brand-coral/10 px-3 py-1 text-sm text-brand-coral lg:inline"
            data-testid="target-role"
            title="Role details used for interview framing and feedback."
          >
            Practicing for {profile.job.role.trim() || "your role"}
            {profile.job.company.trim() && ` at ${profile.job.company.trim()}`}
          </span>
        )}
        <span className="ml-auto text-sm text-zinc-500 max-sm:sr-only" data-testid="session-stats">
          {attempt.snapshots.length} snapshots · {attempt.runs.length} runs · {attempt.turns.length} turns
        </span>
        {DEV && (
          <details className="relative max-sm:ml-auto">
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
          data-testid="finish-btn"
        >
          Finish
        </button>
      </header>

      <main className="flex flex-col lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex shrink-0 flex-col border-zinc-800 lg:min-h-0 lg:shrink lg:border-r">
          <div className="min-h-0 flex-1 overflow-y-auto" tabIndex={0}>
            <ProblemPanel problem={problem} />
          </div>
          <VoicePanel
            connected={connected}
            connecting={connecting}
            micOn={micOn}
            state={liveState}
            turns={attempt.turns}
            error={liveError}
            voiceMode={voiceMode}
            mockReason={mockReason}
            micStatus={micStatus}
            disconnected={disconnected}
            reconnecting={reconnecting}
            onReconnect={handleReconnect}
            onConnect={handleConnect}
            onToggleMic={handleToggleMic}
            onEnd={endLive}
          />
        </div>

        <div className="flex flex-col lg:min-h-0">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
            <div>
              <span className="font-mono text-sm text-zinc-500">solution.py · v{codeVersion}</span>
              <p className="text-xs text-zinc-400">Leave editor: Ctrl+M (Mac: Ctrl+Shift+M), then Shift+Tab.</p>
            </div>
            <button
              onClick={handleRun}
              disabled={running}
              className={`${btn.primary} min-w-[7rem] px-5 py-2 text-base`}
              data-testid="run-btn"
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
          <div className="mobile-editor-pane bg-[#1e1e1e] lg:h-auto lg:min-h-0 lg:flex-[3]">
            <CodeEditor value={source} onChange={handleEdit} errorLine={error?.line} errorMessage={error?.message} />
          </div>
          <div className="min-h-[260px] shrink-0 border-t border-zinc-800 lg:h-[38%] lg:shrink">
            <ResultsPanel result={result} running={running} usingFixtures={fromFixture} />
          </div>
        </div>
      </main>
    </div>
  );
}
