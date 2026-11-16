"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ApiError, ApplicationTarget, BehavioralContext, CodeSnapshot, CodingSession, InterviewPlan, LiveClient, LiveState, Problem, RoundType, RunResult, Session } from "@/lib/contract";
import { ProblemPanel } from "./ProblemPanel";
import { ResultsPanel } from "./ResultsPanel";
import { VoicePanel } from "./VoicePanel";
import { BehavioralRoom } from "./BehavioralRoom";
import { ReportView, type AttemptRecord } from "./ReportView";
import { FullMockSummary } from "./FullMockSummary";
import { recordAttempt } from "./historyStore";
import { BEHAVIORAL_LIMIT_MS, describeClock, formatClock, useRoundClock, type RoundTiming } from "./roundClock";
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
import { DEFAULT_REPORT_MODE, requestReport, type ReportMode, type ReportOutcome } from "./reportAdapter";
import { preloadRunner } from "@/lib/runner";
import { getProblem, randomProblem } from "@/lib/problems";
import { CodeSyncScheduler, DEFAULT_SYNC_INTERVAL_MS } from "@/lib/codeSync";
import { isBehavioralSession } from "@/lib/behavioral";

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

// Newlines only; cheap enough to run on every keystroke.
function lineCount(source: string): number {
  let n = 1;
  for (let i = 0; i < source.length; i++) if (source.charCodeAt(i) === 10) n++;
  return n;
}

export function ProblemRoom({ problem: initialProblem }: { problem: Problem }) {
  // Which problem this attempt is on. The prop is only the starting value:
  // selection happens per attempt on the client, because picking in the server
  // component would choose once per build and hand everyone the same problem.
  const [problem, setProblem] = useState<Problem>(initialProblem);

  // Reset the editor for a coding attempt on `next`, which may differ from the
  // problem just attempted.
  function loadProblem(next: Problem) {
    setProblem(next);
    lastSyncedVersion.current = null;
    sync().reset();
    latest.current = { codeVersion: 1, source: next.starterCode };
    setSource(next.starterCode);
    setCodeVersion(1);
    setResult(null);
    setFromFixture(false);
  }
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

  // Round timing (components/roundClock.ts). attemptSeq changes whenever a new
  // attempt begins, so each attempt gets its own clock.
  const [attemptSeq, setAttemptSeq] = useState(0);
  const [timings, setTimings] = useState<Record<string, RoundTiming>>({});
  const withTiming = (r: AttemptRecord | undefined): AttemptRecord | undefined =>
    r && timings[r.session.attemptId] ? { ...r, timing: timings[r.session.attemptId] } : r;

  const activeRecords = (round === "behavioral" ? behavioralRecords : codingRecords).map((r) => withTiming(r)!);

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
          context: behavioralContext,
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

  // The technical round is timed from when the room opens, with no limit. The
  // behavioral round's countdown starts with the interview (first connect or
  // turn) and finishes the round when it reaches zero.
  const behavioralStarted = connected || attempt.turns.length > 0;
  const clockKey =
    view !== "room" ? null : round === "coding" ? `coding-${attemptSeq}` : behavioralStarted ? `behavioral-${attemptSeq}` : null;
  const clock = useRoundClock(clockKey, {
    limitMs: round === "behavioral" ? BEHAVIORAL_LIMIT_MS : undefined,
    onExpire: () => finishRound(true),
  });

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
            setTimeout(() => schedulePreload(), 100);
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
      syncEnabled.current = true;
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
        round === "behavioral" ? undefined : problem.id,
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
    const prev = latest.current.source;
    const v = latest.current.codeVersion + 1;
    latest.current = { codeVersion: v, source: next };
    setSource(next);
    setCodeVersion(v);

    // A finished line is the natural unit of "I wrote something": send it at
    // once rather than waiting out the throttle window, so a question asked
    // immediately after pressing Enter is answered against the new line.
    // Mid-line typing still coalesces, so this cannot become one provider
    // message per keystroke.
    if (lineCount(next) !== lineCount(prev)) sync().flushNow();
    else scheduleSync();
  }

  async function handleRun() {
    const curSource = latest.current.source;
    const curVersion = latest.current.codeVersion;
    const snapshot: CodeSnapshot = { codeVersion: curVersion, source: curSource, at: new Date().toISOString() };
    setAttempt((s) => ({ ...s, snapshots: [...s.snapshots, snapshot] }));
    setRunning(true);
    try {
      const res = await runCodeAdapter(
        {
          sessionId: ids().sessionId,
          problemId: problem.id,
          codeVersion: curVersion,
          language: "python",
          source: curSource,
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
      setTimeout(() => schedulePreload(), 100);
    } finally {
      setRunning(false);
    }
  }

  // Speculative report preloader: evaluates in the background while candidate speaks/codes
  const preloadedReportRef = useRef<{
    attemptId: string;
    key: string;
    promise: Promise<ReportOutcome>;
    outcome: ReportOutcome | null;
  } | null>(null);

  function schedulePreload() {
    try {
      const s = fullSession();
      const isBeh = isBehavioralSession(s);
      // Need minimum context to evaluate:
      // For coding: at least 1 test run or 2 spoken turns
      // For behavioral: at least 2 spoken turns
      if (!isBeh && s.runs.length === 0 && s.turns.length < 2) return;
      if (isBeh && s.turns.length < 2) return;

      const lastSnap = !isBeh && s.snapshots.length > 0 ? s.snapshots[s.snapshots.length - 1].codeVersion : 0;
      const lastRun = !isBeh && s.runs.length > 0 ? s.runs[s.runs.length - 1].codeVersion : 0;
      const key = `${s.attemptId}:snap${lastSnap}:run${lastRun}:turns${s.turns.length}`;

      if (preloadedReportRef.current?.key === key) return;

      const promise = requestReport(s, reportMode)
        .then((res) => {
          if (preloadedReportRef.current?.key === key) {
            preloadedReportRef.current.outcome = res;
          }
          return res;
        })
        .catch(() => null as unknown as ReportOutcome);

      preloadedReportRef.current = {
        attemptId: s.attemptId,
        key,
        promise,
        outcome: null,
      };
    } catch {
      // Preload is non-blocking
    }
  }

  async function loadReport(target: Session) {
    const isBeh = isBehavioralSession(target);
    const updateRecords = (fn: (rs: AttemptRecord[]) => AttemptRecord[]) => {
      if (isBeh) setBehavioralRecords(fn);
      else setCodingRecords(fn);
    };

    const cached = preloadedReportRef.current;
    let outcome: ReportOutcome | null = null;

    // Check if a preloaded report is ready or in-flight for this attempt
    if (cached && cached.attemptId === target.attemptId) {
      if (cached.outcome && cached.outcome.ok) {
        outcome = cached.outcome;
      } else if (cached.promise) {
        outcome = await cached.promise;
      }
    }

    if (!outcome || !outcome.ok) {
      updateRecords((rs) =>
        rs.map((r) => (r.session.attemptId === target.attemptId ? { session: target, status: "loading" } : r)),
      );
      outcome = await requestReport(target, reportMode);
    }

    if (outcome.ok) {
      const job = profile?.job;
      const role = job && hasJob(job) ? [job.role.trim(), job.company.trim()].filter(Boolean).join(" at ") : undefined;
      recordAttempt(target, outcome.report, outcome.fromFixture, role);
    }
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
    finishRound(false);
  }

  function finishRound(timedOut: boolean) {
    if (view !== "room") return;
    const measured = clockKey ? clock.read(clockKey) : null;
    endLive();
    const finished = fullSession();
    if (measured !== null) {
      const timing: RoundTiming =
        round === "behavioral"
          ? { durationMs: timedOut ? BEHAVIORAL_LIMIT_MS : Math.min(measured, BEHAVIORAL_LIMIT_MS), limitMs: BEHAVIORAL_LIMIT_MS, timedOut }
          : { durationMs: measured };
      setTimings((t) => ({ ...t, [finished.attemptId]: timing }));
    }
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
    setAttemptSeq((n) => n + 1);
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
    setAttemptSeq((n) => n + 1);
    setLiveError(null);

    if (round === "coding") {
      loadProblem(problem); // retry is another attempt at the same problem
    }
    setView("room");
  }

  function handlePracticeAgain(targetRound: RoundType, nextProblem?: Problem) {
    endLive();
    const prior = ids();
    idsRef.current = { sessionId: prior.sessionId, attemptId: crypto.randomUUID(), priorAttemptId: prior.attemptId };
    turnCount.current = 0;
    setAttempt(EMPTY_ATTEMPT);
    setAttemptSeq((n) => n + 1);
    setLiveError(null);

    if (targetRound === "coding") {
      // A fresh practice run gets a different problem; excluding the current one
      // means "practice again" never hands back the problem just attempted.
      loadProblem(nextProblem ?? randomProblem(problem.id));
      setRound("coding");
    } else {
      setRound("behavioral");
    }
    setView("room");
  }

  function handleSwitchProblem(next: Problem) {
    if (next.id === problem.id) return;
    loadProblem(next);
    if (live.current) {
      void handleReconnect();
    }
  }

  // Quick standalone practice: no plan.
  function startQuick(p: CandidateProfile, m: PracticeMode, ctx?: BehavioralContext) {
    setActivePlan(null);
    setProfile(p);
    setPracticeMode(m);
    setBehavioralContext(ctx);
    setAttemptSeq((n) => n + 1);
    if (m === "behavioral") {
      setRound("behavioral");
    } else {
      // "coding" or "full-mock" starts with coding. No plan named a problem, so
      // skipping straight in gets a random one from the bank.
      loadProblem(randomProblem());
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
    // The plan names its problem (lib/plan.ts); load that one, not a random one.
    const planned = getProblem(plan.technical.problemId) ?? problem;
    if (idsRef.current) handlePracticeAgain("coding", planned); // fresh attempt, editor reset
    else {
      loadProblem(planned);
      setAttemptSeq((n) => n + 1);
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
      <div className="flex min-h-screen flex-col bg-background text-foreground [color-scheme:light]" data-testid="full-mock-transition" {...planMarker}>
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur px-6 py-4 flex items-center justify-between">
          <Wordmark size={24} tone="light" />
          <span className="text-xs font-semibold text-muted-foreground">Technical Coding Complete · Transition</span>
        </header>

        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-12">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-lift">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-full bg-success-soft border border-emerald-500/20 px-3 py-1 text-xs font-bold text-success uppercase tracking-wider">
                ✓ Technical Coding Complete
              </span>
              <span className="text-xs font-medium text-muted-foreground">Next: Behavioral Deep-Dive</span>
            </div>

            <h1 className="mt-4 font-brand text-3xl font-bold tracking-tight text-foreground">
              Technical coding interview complete
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {lastCodingRun?.status === "completed"
                ? `Your Python solution passed ${lastCodingRun.passed} of ${lastCodingRun.total} test cases.`
                : "Your coding draft and interview responses have been saved."}
              {lastCodingRecord && timings[lastCodingRecord.session.attemptId] && (
                <span data-testid="transition-coding-time">
                  {" "}
                  It took you {describeClock(timings[lastCodingRecord.session.attemptId].durationMs)}.
                </span>
              )}
            </p>

            <div className="mt-6 rounded-xl border border-border bg-background p-5 shadow-card">
              <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
                Next Up: Behavioral Deep-Dive Interview
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The interviewer will transition to questions about your engineering experiences, technical trade-offs, and personal contributions.
              </p>
              {focusLabel && (
                <p className="mt-2 text-xs text-primary font-semibold">Tailored focus: {focusLabel}</p>
              )}
              {codingReportStatus === "loading" && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground" data-testid="bg-report-loading">
                  <span className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
                  Generating coding feedback in background…
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleContinueToBehavioral}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background bg-primary text-primary-foreground shadow-cta hover:bg-primary-hover active:translate-y-px py-3 px-6 flex-1"
                data-testid="continue-behavioral"
              >
                Continue to Behavioral Round →
              </button>
              <button
                type="button"
                onClick={() => setView("report")}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background border border-border bg-background text-foreground shadow-card hover:bg-muted py-3 px-5"
                data-testid="view-coding-feedback"
              >
                View coding feedback
              </button>
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setView("summary")}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline cursor-pointer"
                data-testid="end-early"
              >
                End interview early &amp; view summary
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
        codingRecord={withTiming(codingRecords.at(-1))}
        behavioralRecord={withTiming(behavioralRecords.at(-1))}
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
      <div className="min-h-screen bg-background text-foreground flex flex-col [color-scheme:light]">
        {practiceMode === "full-mock" && round === "coding" && (
          <div className="bg-card border-b border-border px-6 py-3 flex items-center justify-between text-sm shadow-card">
            <span className="text-muted-foreground text-xs sm:text-sm font-medium">
              Technical Coding feedback. Ready for Behavioral Deep-Dive?
            </span>
            <button
              onClick={handleContinueToBehavioral}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-semibold cursor-pointer transition-all bg-primary text-primary-foreground shadow-cta hover:bg-primary-hover active:translate-y-px px-4 py-1.5"
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
        <BehavioralRoom
          voice={voiceProps}
          attemptNumber={attemptNumber}
          focusLabel={focusLabel}
          onFinish={handleFinish}
          clock={{ started: behavioralStarted, elapsedMs: clock.elapsedMs, limitMs: BEHAVIORAL_LIMIT_MS }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground lg:h-screen [color-scheme:light]" {...planMarker}>
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Back to Interviewlenz home"
              onClick={() => setView("start")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-arrow-left h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              >
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
            </button>
            <Wordmark size={22} tone="light" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium text-foreground" data-testid="target-role">
                <span className="text-muted-foreground">Practicing for: </span>
                {profile?.job?.role
                  ? `${profile.job.company ? `${profile.job.company} · ` : ""}${profile.job.role}`
                  : "Stripe · Backend Engineer"}
              </p>
              {practiceMode === "full-mock" ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/25 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-primary tracking-wide"
                    data-testid="full-mock-indicator"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    Full Mock Loop · Round 1 of 2 (Coding)
                  </span>
                  <p className="truncate text-xs text-muted-foreground">
                    Problem: {problem.title} (Python 3) · Behavioral follows
                  </p>
                </div>
              ) : (
                <p className="truncate text-xs text-muted-foreground">
                  Problem: {problem.title} (Python 3)
                </p>
              )}
            </div>
          </div>

          <div className="order-last col-span-2 flex items-center justify-center lg:order-none lg:col-span-1">
            <span
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-sm tabular-nums text-foreground"
              data-testid="round-clock"
              role="timer"
              aria-label={`Time on this problem: ${describeClock(clock.elapsedMs)}`}
            >
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              <span aria-hidden="true">{formatClock(clock.elapsedMs)} elapsed</span>
            </span>
          </div>

          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-muted-foreground max-sm:sr-only" data-testid="session-stats">
              {attempt.snapshots.length} snapshots · {attempt.runs.length} runs · {attempt.turns.length} turns
            </span>
            {DEV && (
              <details className="relative">
                <summary className="cursor-pointer select-none rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted">
                  Dev
                </summary>
                <div className="absolute right-0 z-20 mt-2 flex w-64 flex-col gap-2.5 rounded-xl border border-border bg-card p-3 shadow-xl">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
                    Run with
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value as RunMode)}
                      className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                    >
                      <option value="real">Python runner</option>
                      <option value="cycle">Fixtures: cycle all four</option>
                      <option value="pass">Fixture: pass (4/4)</option>
                      <option value="fail">Fixture: fail (3/4)</option>
                      <option value="syntax">Fixture: syntax error</option>
                      <option value="unavailable">Fixture: runner unavailable</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
                    Report
                    <select
                      value={reportMode}
                      onChange={(e) => setReportMode(e.target.value as ReportMode)}
                      className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
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
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground shadow-cta hover:bg-primary-hover active:translate-y-px py-2 h-9 px-3 sm:px-4"
              data-testid="finish-btn"
            >
              <span className="sm:hidden">End &amp; Score</span>
              <span className="hidden sm:inline">End Interview &amp; Generate Scorecard</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sticky Quick Switcher (Mobile Only) */}
      <div className="sticky top-[57px] z-10 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur px-4 py-2 sm:hidden shadow-sm">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Workspace View
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              document.getElementById("problem-pane")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted cursor-pointer active:scale-95 transition-all"
            data-testid="mobile-jump-problem"
          >
            <span>📝 Problem</span>
          </button>
          <button
            type="button"
            onClick={() => {
              document.getElementById("code-pane")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary-soft text-primary px-2.5 py-1 text-xs font-semibold hover:bg-primary/10 cursor-pointer active:scale-95 transition-all"
            data-testid="mobile-jump-code"
          >
            <span>💻 Code &amp; Run ↓</span>
          </button>
        </div>
      </div>

      <main className="grid flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] bg-background min-w-0 max-w-full overflow-x-hidden">
        {/* Left Column: Problem description & Live voice console */}
        <section id="problem-pane" className="flex flex-col border-border lg:min-h-0 lg:border-r bg-background min-w-0 max-w-full">
          <div className="flex-1 px-5 py-6 sm:px-7 lg:overflow-y-auto">
            <ProblemPanel problem={problem} onSelectProblem={handleSwitchProblem} />
            <div className="mt-5 pt-3 border-t border-border/60 sm:hidden">
              <button
                type="button"
                onClick={() => {
                  document.getElementById("code-pane")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-2.5 px-4 text-xs font-semibold shadow-cta hover:bg-primary-hover active:translate-y-px transition-all cursor-pointer"
              >
                <span>💻 Continue to Code Editor &amp; Run Tests ↓</span>
              </button>
            </div>
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
        </section>

        {/* Right Column: Code editor, test results, and GREEN Run Code button */}
        <section id="code-pane" className="flex flex-col border-t border-border lg:min-h-0 lg:border-t-0 bg-background min-w-0 max-w-full">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 bg-background">
            <div className="flex items-center gap-2 font-mono text-xs text-foreground">
              <span className="font-semibold text-foreground">solution.py · v{codeVersion}</span>
              <span className="rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[11px] text-muted-foreground">Python 3</span>
              {result?.status === "completed" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft border border-emerald-500/20 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-success">
                  ✓ {result.passed} / {result.total} passed in {result.durationMs}ms
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground font-mono">4 tests</span>
          </div>

          {/* Monaco Editor Pane */}
          <div className="mobile-editor-pane min-h-[280px] flex-1 overflow-hidden bg-card border-b border-border lg:h-auto lg:min-h-0">
            <CodeEditor value={source} onChange={handleEdit} errorLine={error?.line} errorMessage={error?.message} />
          </div>

          {/* Results Panel */}
          <div className="mobile-results-pane min-h-[160px] shrink-0 border-b border-border lg:h-[35%] lg:shrink lg:overflow-hidden overflow-visible">
            <ResultsPanel result={result} running={running} usingFixtures={fromFixture} />
          </div>

          {/* Bottom Bar: Tip + GREEN RUN BUTTON */}
          <div className="border-t border-border bg-background sticky bottom-0 z-10 shadow-lift sm:static sm:shadow-none">
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="text-xs text-muted-foreground">Tip: explain your idea out loud before you run.</span>
              <button
                onClick={handleRun}
                disabled={running}
                data-testid="run-btn"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 active:translate-y-px h-9 px-4 py-2 min-w-[6.5rem]"
              >
                {running ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                    <span>Running…</span>
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-play fill-current"
                      aria-hidden="true"
                    >
                      <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
                    </svg>
                    <span>Run Code</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
