import type {
  ApiError,
  CodeSnapshot,
  LiveClient,
  LiveState,
  LiveTokenResponse,
  Problem,
  RoleContext,
  RunResult,
  TranscriptTurn,
} from "@/lib/contract";
import { createLiveClient, type CreateLiveClientOptions } from "@/lib/live";

// The only place the UI touches voice.
//
// openVoice() asks POST /api/live-token for an ephemeral token and connects the
// real client. If the route is missing, returns an error (503 when
// GEMINI_API_KEY is not set), or the real client fails to connect, it falls
// back to the scripted MockLiveClient so the demo runs with zero keys.
//
// lib/live.ts exports the factory createLiveClient({ turnSeed }). Transcript IDs
// are attempt-scoped: every client built within an attempt (real or scripted) is
// seeded with the attempt's turn count so numbering continues (docs/CONTRACT.md,
// "Live code context, reconnect, and transcript IDs").
type ClientFactory = (options?: CreateLiveClientOptions) => LiveClient;
const REAL_CLIENT: ClientFactory | null = createLiveClient;

// Dev-only test seam: a browser test can set window.__interviewlenzTestLiveClient
// to a LiveClient factory, which then stands in for lib/live.ts behind the same
// token check, gating, and fallback. Production builds compile this out.
function testClientFactory(): ClientFactory | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  const f = (window as unknown as { __interviewlenzTestLiveClient?: ClientFactory }).__interviewlenzTestLiveClient;
  return typeof f === "function" ? f : null;
}

// If the Live socket has not opened by then, use the scripted fallback.
const REAL_CONNECT_TIMEOUT_MS = 10_000;

export type VoiceMode = "live" | "mock";

export interface VoiceHandlers {
  onState: (state: LiveState) => void;
  onTurn: (turn: TranscriptTurn) => void;
  onError: (error: ApiError) => void;
}

export interface VoiceConnection {
  client: LiveClient;
  mode: VoiceMode;
  // Why the mock is in use, for the badge ("no API key", "voice client not merged").
  mockReason?: string;
}

export function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value !== null && "code" in value && "retryable" in value;
}

// Also used by Reconnect: a fresh ephemeral token for the same session.
export async function fetchLiveToken(sessionId: string, roleContext?: RoleContext): Promise<LiveTokenResponse | ApiError> {
  try {
    const res = await fetch("/api/live-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(roleContext ? { sessionId, roleContext } : { sessionId }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body && typeof body.token === "string") return body as LiveTokenResponse;
    if (isApiError(body)) return body;
    return { code: "provider_unavailable", message: `Voice token route returned ${res.status}`, retryable: true };
  } catch {
    return { code: "provider_unavailable", message: "Voice token route unreachable", retryable: true };
  }
}

function wire(client: LiveClient, h: VoiceHandlers) {
  client.onState(h.onState);
  client.onTurn(h.onTurn);
  client.onError(h.onError);
}

// turnSeed: turns already in the current attempt, so IDs continue (t{seed+1}, ...).
export async function openVoice(
  sessionId: string,
  problem: Problem,
  h: VoiceHandlers,
  turnSeed = 0,
  // Optional target role; the token route locks it into the interviewer instruction.
  roleContext?: RoleContext,
): Promise<VoiceConnection> {
  h.onState("connecting");
  const token = await fetchLiveToken(sessionId, roleContext);

  const realFactory = testClientFactory() ?? REAL_CLIENT;
  if (!isApiError(token) && realFactory) {
    const real = realFactory({ turnSeed });
    // Hold the real client's events until connect() settles: lib/live.ts emits
    // its error before throwing. On success, replay them and pass through; on
    // failure, drop them so they never overwrite the scripted fallback.
    let phase: "connecting" | "live" | "abandoned" = "connecting";
    const held: (() => void)[] = [];
    const gate =
      <T,>(fn: (v: T) => void) =>
      (v: T) => {
        if (phase === "live") fn(v);
        else if (phase === "connecting") held.push(() => fn(v));
      };
    wire(real, { onState: gate(h.onState), onTurn: gate(h.onTurn), onError: gate(h.onError) });
    try {
      await Promise.race([
        real.connect(token, problem),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), REAL_CONNECT_TIMEOUT_MS)),
      ]);
      phase = "live";
      held.splice(0).forEach((replay) => replay());
      return { client: real, mode: "live" };
    } catch {
      phase = "abandoned";
      held.length = 0;
      real.end();
      return openMock(problem, h, "voice connection failed", turnSeed);
    }
  }

  return openMock(problem, h, isApiError(token) ? "no API key" : "voice client not merged", turnSeed);
}

async function openMock(problem: Problem, h: VoiceHandlers, reason: string, turnSeed: number): Promise<VoiceConnection> {
  const mock = new MockLiveClient(turnSeed);
  wire(mock, h);
  await mock.connect(MOCK_TOKEN, problem);
  return { client: mock, mode: "mock", mockReason: reason };
}

const MOCK_TOKEN: LiveTokenResponse = { token: "mock-token", model: "mock", expiresAt: "2099-01-01T00:00:00Z" };

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Scripted interviewer that follows the demo story. No audio; it emits the
// same state and transcript events as the real client.


type Approach = "nested" | "set" | "other";

// Simple source check: two "for" lines means a nested comparison; "set(" or
// "in seen" means a set-based solution.
export function detectApproach(source: string): Approach {
  const forLines = source.split("\n").filter((l) => /^\s*for\s/.test(l)).length;
  if (forLines >= 2) return "nested";
  if (source.includes("set(") || source.includes("in seen")) return "set";
  return "other";
}

// What the scripted student "says" after each interviewer question.
const STUDENT_AFTER = {
  intro:
    "I'll take each number and compare it with every number after it using two loops. That's linear, so it should be fast enough.",
  nested:
    "Hmm, every pair gets compared, so that's about n squared over two comparisons. A set would let me check each number once.",
  set: "The set can hold up to n numbers, so it's O(n) extra memory. That matters if the list is huge or memory is tight.",
} as const;

class MockLiveClient implements LiveClient {
  // Attempt-scoped like the real client: seeded, never a global counter.
  constructor(private turnSeq = 0) {}
  private stateCbs: ((s: LiveState) => void)[] = [];
  private turnCbs: ((t: TranscriptTurn) => void)[] = [];
  private errorCbs: ((e: ApiError) => void)[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private connected = false;
  private micOn = false;
  private pendingStudent: string | null = null;

  async connect(token: LiveTokenResponse, problem: Problem) {
    void token;
    this.emitState("connecting");
    await delay(400);
    this.connected = true;
    this.say(`Hi! Before you code, walk me through how you'd approach ${problem.title}.`, STUDENT_AFTER.intro, 300);
  }

  async startMic() {
    this.micOn = true;
    this.emitState("listening");
    this.flushStudent();
  }

  stopMic() {
    this.micOn = false;
    this.emitState("idle");
  }

  sendRunContext(snapshot: CodeSnapshot, result: RunResult) {
    if (!this.connected) return;
    let text: string;
    let reply: string | null = null;
    if (result.status === "error") {
      text =
        result.error.code === "syntax_error"
          ? `That didn't parse${result.error.line ? ` — line ${result.error.line}` : ""}: ${result.error.message}. What do you check first when Python rejects your code?`
          : `The run didn't complete: ${result.error.message}. While that's sorted out, what should your function return for an empty list?`;
    } else if (result.passed < result.total) {
      const c = result.cases.find((x) => !x.pass)!;
      const got = c.actual ?? (c.error ? `an error (${c.error})` : "nothing");
      text = `${c.caseId} fails: for ${c.input} the expected answer is ${c.expected}, but your code returned ${got}. What's different about that case?`;
    } else {
      const approach = detectApproach(snapshot.source);
      if (approach === "nested") {
        text = "All cases pass. You said this is linear. How many comparisons happen when every element is different?";
        reply = STUDENT_AFTER.nested;
      } else if (approach === "set") {
        text = "Nice. What's the space cost of the set, and when might that matter?";
        reply = STUDENT_AFTER.set;
      } else {
        text = `All ${result.total} cases pass. What's the time complexity, and how would you convince me?`;
      }
    }
    this.clearTimers();
    this.say(text, reply, 900);
  }

  end() {
    this.connected = false;
    this.micOn = false;
    this.clearTimers();
    this.emitState("idle");
  }

  onState(cb: (s: LiveState) => void) {
    this.stateCbs.push(cb);
  }
  onTurn(cb: (t: TranscriptTurn) => void) {
    this.turnCbs.push(cb);
  }
  onError(cb: (e: ApiError) => void) {
    this.errorCbs.push(cb);
  }

  // Interviewer speaks after `wait` ms, then the scripted student answers
  // (only while the mic is on; otherwise it waits for the mic).
  private say(text: string, studentReply: string | null, wait: number) {
    this.emitState("speaking");
    this.timers.push(
      setTimeout(() => {
        if (!this.connected) return;
        this.emitTurn("interviewer", text);
        this.pendingStudent = studentReply;
        this.emitState(this.micOn ? "listening" : "idle");
        this.flushStudent();
      }, wait),
    );
  }

  private flushStudent() {
    const line = this.pendingStudent;
    if (!line || !this.micOn) return;
    this.pendingStudent = null;
    this.timers.push(
      setTimeout(() => {
        if (!this.connected || !this.micOn) {
          this.pendingStudent = line;
          return;
        }
        this.emitTurn("student", line);
      }, 2500),
    );
  }

  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
  private emitState(s: LiveState) {
    this.stateCbs.forEach((cb) => cb(s));
  }
  private emitTurn(speaker: TranscriptTurn["speaker"], text: string) {
    const turn: TranscriptTurn = {
      id: `t${++this.turnSeq}`,
      speaker,
      text,
      at: new Date().toISOString(),
    };
    this.turnCbs.forEach((cb) => cb(turn));
  }
}
