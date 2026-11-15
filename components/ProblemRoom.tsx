"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ApiError, ApplicationTarget, BehavioralContext, CodeSnapshot, CodingSession, InterviewPlan, LiveClient, LiveState, Problem, RoundType, RunResult, Session } from "@/lib/contract";
import { ProblemPanel } from "./ProblemPanel";
import { ResultsPanel } from "./ResultsPanel";
import { VoicePanel } from "./VoicePanel";
import { BehavioralRoom } from "./BehavioralRoom";
import { CONSOLE, SessionClock } from "./behavioral/studio";
import { ReportView, type AttemptRecord } from "./ReportView";
import { FullMockSummary } from "./FullMockSummary";
import { StartScreen, type MicStatus, type PracticeMode } from "./StartScreen";
import { EMPTY_JOB, hasJob, toRoleContext, type CandidateProfile } from "./landing/profile";
import { ApplicationSetup } from "./flow/ApplicationSetup";
import { PlanReview } from "./flow/PlanReview";
import { sendPreview, type ApplicationDraft, type SetupStatus } from "./flow/types";
import { requestPlan } from "./planAdapter";
import { planRef, revisePlan } from "@/lib/plan";
import { Wordmark } from "./Logo";
import { EditorSkeleton } from "./Skeletons";
import { runCodeAdapter, type RunMode } from "./runCodeAdapter";
import { fetchLiveToken, isApiError, openVoice, type BehavioralRound, type VoiceMode } from "./liveAdapter";
import { DEFAULT_REPORT_MODE, requestReport, type ReportMode } from "./reportAdapter";
import { preloadRunner } from "@/lib/runner";
import { CodeSyncScheduler, DEFAULT_SYNC_INTERVAL_MS } from "@/lib/codeSync";
import { behavioralOpeningExtra, isBehavioralSession } from "@/lib/behavioral";
import { btn, coverBtnSm } from "./ui/buttons";

const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});

const DEV = process.env.NODE_ENV !== "production";

type AttemptIds = Pick<Session, "sessionId" | "attemptId" | "priorAttemptId">;
type AttemptData = Pick<CodingSession, "turns" | "snapshots" | "runs">;
const EMPTY_ATTEMPT: AttemptData = { turns: [], snapshots: [], runs: [] };

// Upper bound on how long the newest editor version can wait before it is
// written to the active Live session. Also the floor on the gap between two
// code-context messages, so continuous typing cannot produce one message per
// keystroke.
const SYNC_INTERVAL_MS = DEFAULT_SYNC_INTERVAL_MS;

export function ProblemRoom({ problem }: { problem: Problem }) {
  // One Session per attempt, kept in browser memory (CONTRACT.md). IDs are
  // minted on first use in an event handler: Cache Components forbids random
  // values during prerender, and the room never renders them.
  const idsRef = useRef<AttemptIds | null>(null);
  const ids = () => (idsRef.current ??= { sessionId: crypto.randomUUID(), attemptId: crypto.randomUUID() });
  const [attempt, setAttempt] = useState<AttemptData>(EMPTY_ATTEMPT);

  const [practiceMode, setPracticeMode] = useState<PracticeMode>("coding");
  const [round, setRound] = useState<RoundType>("coding");
  const [view, setView] = useState<"start" | "setup" | "plan" | "room" | "report" | "transition" | "summary">("start");
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

  // --- Application-first flow (plan/session wiring) ------------------------
  // `plan` is editable on the review screen. `activePlan` is the revision
  // frozen at Start: every attempt's Session.plan, Reconnect, report retry, and
  // Practice again use it until the student starts a new plan. Quick standalone
  // practice clears it, so those sessions carry no plan.
  const [draft, setDraft] = useState<ApplicationDraft>({ job: EMPTY_JOB, resume: [] });
  const [setupStatus, setSetupStatus] = useState<SetupStatus>({ kind: "editing" });
  const [plan, setPlan] = useState<InterviewPlan | null>(null);
  const [activePlan, setActivePlan] = useState<InterviewPlan | null>(null);
  // Every started revision, by "planId@revision", for reviewing earlier attempts.
  const startedPlans = useRef(new Map<string, InterviewPlan>());
  const planRequest = useRef(0);
  const application = (): ApplicationTarget => ({
    roleContext: toRoleContext(draft.job) ?? {},
    ...(draft.resumeContext ? { resumeContext: draft.resumeContext } : {}),
  });
  const planMarker = activePlan ? { "data-plan-id": activePlan.planId, "data-plan-revision": activePlan.revision } : {};

  const fullSession = (): Session =>
    round === "behavioral"
      ? {
          ...ids(),
          roundType: "behavioral",
          turns: attempt.turns,
          ...(behavioralRole ? { roleContext: behavioralRole } : {}),
          ...(behavioralContext ? { behavioralContext } : {}),
          ...(activePlan ? { plan: planRef(activePlan, "behavioral") } : {}),
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
      ...(activePlan ? { plan: planRef(activePlan, "technical") } : {}),
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
  const syncEnabled = useRef(false); // true only while a real (non-mock) client is connected
  // Bumped whenever a voice connection ends. Callbacks and a connect that
  // resolves late check it, so nothing from an ended connection reaches the
  // current attempt.
  const connGen = useRef(0);

  function syncLatest() {
    if (!live.current || !syncEnabled.current) return;
    const cur = latest.current;
    if (lastSyncedVersion.current === cur.codeVersion) return;
    live.current.syncCode?.({ codeVersion: cur.codeVersion, source: cur.source, at: new Date().toISOString() });
    lastSyncedVersion.current = cur.codeVersion;
  }

  // Leading send + bounded trailing flush; see lib/codeSync.ts for why.
  // Built on first use from an event handler or the connect path, never during
  // render. syncLatest reads only refs, so the captured closure always sees the
  // current buffer.
  const syncer = useRef<CodeSyncScheduler | null>(null);
  function sync(): CodeSyncScheduler {
    if (syncer.current == null) {
      syncer.current = new CodeSyncScheduler(syncLatest, SYNC_INTERVAL_MS);
    }
    return syncer.current;
  }

  function cancelPendingSync() {
    sync().cancel();
  }

  function scheduleSync() {
    if (!syncEnabled.current) return;
    sync().schedule();
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
      sync().reset();
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
    scheduleSync();
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
      sync().reset();
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
      sync().reset();
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

  // Quick standalone practice: no plan.
  function startQuick(p: CandidateProfile, m: PracticeMode, ctx?: BehavioralContext) {
    setActivePlan(null);
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
  }

  // "Build my interview plan": research or a role-based fallback. Never blocks;
  // inputs stay in `draft` whatever happens.
  async function handleBuildPlan() {
    const id = ++planRequest.current;
    setSetupStatus({ kind: "analyzing" });
    const outcome = await requestPlan(application());
    if (id !== planRequest.current) return; // Back or a newer request
    setPlan(outcome.plan);
    setSetupStatus(outcome.fellBack && outcome.notice ? { kind: "fell-back", message: outcome.notice } : { kind: "editing" });
    setView("plan");
  }

  // "Start technical round": freeze this revision for the whole journey.
  function handleStartPlan() {
    if (!plan) return;
    startedPlans.current.set(`${plan.planId}@${plan.revision}`, plan);
    setActivePlan(plan);
    setProfile({ resume: draft.resume, job: draft.job });
    setBehavioralContext(plan.behavioral.focus);
    setPracticeMode("full-mock");
    // The room renders one problem today; a plan always names it (lib/plan.ts).
    if (plan.technical.problemId !== problem.id) console.warn("plan problem differs from the loaded problem");
    if (idsRef.current) handlePracticeAgain("coding"); // fresh attempt, editor reset
    else {
      setRound("coding");
      setView("room");
    }
  }

  if (view === "setup") {
    const target = application();
    const j = draft.job;
    return (
      <ApplicationSetup
        draft={draft}
        onDraftChange={setDraft}
        status={setupStatus}
        sendPreview={sendPreview(target)}
        canAnalyze={Boolean(j.role.trim() || j.listing.trim() || j.company.trim())}
        onAnalyze={handleBuildPlan}
        onBack={() => {
          planRequest.current += 1;
          setSetupStatus({ kind: "editing" });
          setView("start");
        }}
        onQuickPractice={(m) => startQuick({ resume: draft.resume, job: draft.job }, m, m === "coding" ? undefined : draft.resumeContext)}
      />
    );
  }

  if (view === "plan" && plan) {
    return (
      <PlanReview
        plan={plan}
        application={application()}
        onEdit={(edits) => setPlan((p) => (p ? revisePlan(p, edits) : p))}
        onStart={handleStartPlan}
        onBack={() => setView("setup")}
        starting={false}
      />
    );
  }

  if (view === "start") {
    return (
      <StartScreen
        micStatus={micStatus}
        onMicStatus={setMicStatus}
        onApply={() => setView("setup")}
        onStart={startQuick}
      />
    );
  }

  if (view === "transition") {
    const lastCodingRecord = codingRecords.at(-1);
    const lastCodingSession = lastCodingRecord?.session as CodingSession | undefined;
    const lastCodingRun = lastCodingSession?.runs.at(-1);
    const codingReportStatus = lastCodingRecord?.status;

    return (
      <div data-surface="cream" className="flex min-h-screen flex-col bg-cream text-ink [color-scheme:light]" data-testid="full-mock-transition" {...planMarker}>
        <header className="flex items-center gap-4 border-b border-cream-line bg-cream-2/95 px-6 py-4 shadow-sm">
          <Wordmark size={26} tone="light" />
          <span className="text-sm font-semibold text-ink-muted">Technical Coding Complete · Transition</span>
        </header>

        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-12">
          <div className="rounded-[28px] border border-cream-line/60 bg-cream-2 p-8 shadow-warm">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                ✓ Technical Coding Complete
              </span>
              <span className="text-xs font-semibold text-ink-muted">Next: Behavioral Deep-Dive</span>
            </div>

            <h1 className="mt-4 font-brand text-3xl font-bold tracking-tight text-ink">Technical coding interview complete</h1>
            <p className="mt-2 text-sm text-ink-muted leading-relaxed">
              {lastCodingRun?.status === "completed"
                ? `Your Python solution passed ${lastCodingRun.passed} of ${lastCodingRun.total} test cases.`
                : "Your coding draft and interview responses have been saved."}
            </p>

            <div className="mt-6 rounded-[20px] border border-cream-line/60 bg-white/80 p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-maroon mb-1">
                Next Up: Behavioral Deep-Dive Interview
              </div>
              <p className="text-sm text-ink-muted leading-relaxed">
                The interviewer will transition to questions about your engineering experiences, technical trade-offs, and personal contributions.
              </p>
              {focusLabel && (
                <p className="mt-2 text-xs text-maroon-deep font-semibold">Tailored focus: {focusLabel}</p>
              )}
              {codingReportStatus === "loading" && (
                <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted" data-testid="bg-report-loading">
                  <span className="h-3 w-3 animate-spin rounded-full border border-maroon border-t-transparent" />
                  Generating coding feedback in background…
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleContinueToBehavioral}
                className={`${btn.primary} flex-1 justify-center py-3 text-base font-semibold shadow-sm`}
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
                className="text-xs text-ink-muted hover:text-ink underline-offset-4 hover:underline"
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
        roleLabel={
          profile && hasJob(profile.job)
            ? `Practicing for ${profile.job.role.trim() || "your role"}${profile.job.company.trim() ? ` at ${profile.job.company.trim()}` : ""}`
            : undefined
        }
      />
    );
  }

  if (view === "report") {
    return (
      <div data-surface="cream" className="min-h-screen bg-cream text-ink flex flex-col [color-scheme:light]">
        {practiceMode === "full-mock" && round === "coding" && (
          <div className="bg-cream-2 border-b border-cream-line px-6 py-3 flex items-center justify-between text-sm shadow-sm">
            <span className="text-ink-muted text-xs sm:text-sm font-medium">
              Technical Coding feedback. Ready for Behavioral Deep-Dive?
            </span>
            <button
              onClick={handleContinueToBehavioral}
              className={`${coverBtnSm.primary} px-4 py-1.5 text-xs font-semibold`}
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
      <div className="contents" {...planMarker}>
        <BehavioralRoom voice={voiceProps} attemptNumber={attemptNumber} focusLabel={focusLabel} onFinish={handleFinish} />
      </div>
    );
  }

  // Tested version + result, grouped for the status bar (the editor buffer can be newer).
  const tested = result
    ? result.status === "completed"
      ? { ok: result.passed === result.total, text: `tested v${result.codeVersion} · ${result.passed}/${result.total} passed · ${result.durationMs} ms` }
      : { ok: false, text: `tested v${result.codeVersion} · ${result.error.code.replace(/_/g, " ")}` }
    : null;

  return (
    <div className={`flex min-h-dvh flex-col lg:h-screen ${CONSOLE.page}`} {...planMarker}>
      <header className={`${CONSOLE.header} flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6`}>
        <Wordmark size={26} tone="dark" />
        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <span className="truncate font-mono text-sm text-zinc-200">
            python · <span className="font-sans font-semibold text-zinc-50">{problem.title}</span>
          </span>
          {attemptNumber > 1 && (
            <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-zinc-300">Attempt {attemptNumber}</span>
          )}
          {practiceMode === "full-mock" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-950/50 px-3 py-1 text-xs font-bold text-rose-200">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]" />
              Technical Coding Interview
            </span>
          )}
        </div>
        {profile && hasJob(profile.job) && (
          <span
            className="hidden max-w-xs truncate rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-xs font-semibold text-zinc-200 lg:inline"
            data-testid="target-role"
            title="Role details used for interview framing and feedback."
          >
            Practicing for {profile.job.role.trim() || "your role"}
            {profile.job.company.trim() && ` at ${profile.job.company.trim()}`}
          </span>
        )}
        {/* Session telemetry: snapshots, runs, turns, elapsed. */}
        <span
          className="ml-auto rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-zinc-300 max-sm:sr-only"
          data-testid="session-stats"
        >
          {attempt.snapshots.length} snapshots · {attempt.runs.length} runs · {attempt.turns.length} turns · <SessionClock key={attemptNumber} />
        </span>
        {DEV && (
          <details className="relative max-sm:ml-auto">
            <summary className={`${CONSOLE.ghost} cursor-pointer select-none px-3 py-1.5 text-xs`}>Dev</summary>
            <div className="absolute right-0 z-20 mt-2 flex w-72 flex-col gap-3 rounded-[14px] border border-white/[0.1] bg-[#15161A] p-4 shadow-2xl">
              <label className="flex flex-col gap-1 text-xs font-bold text-zinc-200">
                Run with
                <select value={mode} onChange={(e) => setMode(e.target.value as RunMode)} className="rounded-lg border border-white/[0.1] bg-[#0B0C0E] px-2 py-1.5 text-sm text-zinc-100">
                  <option value="real">Python runner</option>
                  <option value="cycle">Fixtures: cycle all four</option>
                  <option value="pass">Fixture: pass (4/4)</option>
                  <option value="fail">Fixture: fail (3/4)</option>
                  <option value="syntax">Fixture: syntax error</option>
                  <option value="unavailable">Fixture: runner unavailable</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-zinc-200">
                Report
                <select value={reportMode} onChange={(e) => setReportMode(e.target.value as ReportMode)} className="rounded-lg border border-white/[0.1] bg-[#0B0C0E] px-2 py-1.5 text-sm text-zinc-100">
                  <option value="auto">Auto: /api/report, else fixture</option>
                  <option value="fixture">Fixture only</option>
                  <option value="fixture-error">Fixture: 503 once, then OK</option>
                  <option value="api">/api/report only</option>
                </select>
              </label>
            </div>
          </details>
        )}
        <button onClick={handleFinish} disabled={running} className={CONSOLE.finish} data-testid="finish-btn">
          Finish
        </button>
      </header>

      <main className="flex flex-col gap-4 p-3 sm:p-4 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className={`flex shrink-0 flex-col overflow-hidden lg:min-h-0 lg:shrink ${CONSOLE.panel}`}>
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

        <div className={`flex flex-col overflow-hidden lg:min-h-0 ${CONSOLE.panel}`}>
          {/* Workbench status bar: buffer version, tested version + result, runtime. */}
          <div className={`${CONSOLE.bar} flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5 sm:px-5`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs sm:text-sm">
                <span className="font-semibold text-zinc-100">solution.py · v{codeVersion}</span>
                {tested && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      tested.ok ? "border-emerald-500/30 bg-emerald-950/60 text-emerald-400" : "border-amber-500/30 bg-amber-950/60 text-amber-300"
                    }`}
                    data-testid="status-passed"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${tested.ok ? "bg-emerald-400" : "bg-amber-400"}`} aria-hidden />
                    {tested.text}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-400">Leave editor: Ctrl+M (Mac: Ctrl+Shift+M), then Shift+Tab.</p>
            </div>
            <button onClick={handleRun} disabled={running} className={`${CONSOLE.primary} min-w-[7rem] px-5 py-2 text-sm`} data-testid="run-btn">
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
          <div className="min-h-[260px] shrink-0 border-t border-white/[0.08] bg-[#0E0F12] lg:h-[38%] lg:shrink">
            <ResultsPanel result={result} running={running} usingFixtures={fromFixture} />
          </div>
        </div>
      </main>
    </div>
  );
}
