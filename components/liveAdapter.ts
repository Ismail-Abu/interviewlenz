import type {
  ApiError,
  CodeSnapshot,
  LiveClient,
  LiveState,
  LiveTokenResponse,
  Problem,
  RunResult,
  TranscriptTurn,
} from "@/lib/contract";

// The only place the UI touches voice. When Ismail's lib/live.ts and
// POST /api/live-token merge, replace these two bodies with the real client
// and a fetch to /api/live-token, and set USING_MOCK_LIVE to false.
// Agreed with Ismail: lib/live.ts exports a factory createLiveClient(), and
// turn IDs stay unique across reconnects within a session.
export const USING_MOCK_LIVE = true;

export async function fetchLiveToken(sessionId: string): Promise<LiveTokenResponse | ApiError> {
  void sessionId;
  await delay(300);
  return {
    token: "mock-token",
    model: "mock-live-model",
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  };
}

export function createLiveClient(): LiveClient {
  return new MockLiveClient();
}

export function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value !== null && "code" in value && "retryable" in value;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let mockTurnCount = 0;

// Scripted stand-in that follows the LiveClient contract: state events,
// transcript turns with IDs t1, t2, ..., and no real audio.
class MockLiveClient implements LiveClient {
  private stateCbs: ((s: LiveState) => void)[] = [];
  private turnCbs: ((t: TranscriptTurn) => void)[] = [];
  private errorCbs: ((e: ApiError) => void)[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private connected = false;
  private micOn = false;
  private script = [
    "I'd keep a set of numbers I've seen and return True as soon as one repeats.",
    "Since set lookups are constant time on average, it's linear overall.",
  ];
  private replies = [
    "Before you code it, what does your approach return for an empty list?",
    "What extra memory does the set use in the worst case, and could you avoid it?",
  ];

  async connect(token: LiveTokenResponse, problem: Problem) {
    void token;
    void problem;
    this.emitState("connecting");
    await delay(500);
    this.connected = true;
    this.emitState("idle");
  }

  async startMic() {
    this.micOn = true;
    this.emitState("listening");
    this.scheduleExchange();
  }

  stopMic() {
    this.micOn = false;
    this.clearTimers();
    this.emitState("idle");
  }

  // Scripted interviewer reply that reflects the run, standing in for Live's
  // own question about the implementation and outcome.
  sendRunContext(snapshot: CodeSnapshot, result: RunResult) {
    if (!this.connected) return;
    const v = snapshot.codeVersion;
    let text: string;
    if (result.status === "error") {
      text =
        result.error.code === "syntax_error"
          ? `Version ${v} didn't parse${result.error.line ? ` (line ${result.error.line})` : ""}: ${result.error.message}. What do you check first when Python rejects a function definition?`
          : `Version ${v} couldn't run: ${result.error.message}. While that's sorted out, talk me through what your code should return for an empty list.`;
    } else if (result.passed === result.total) {
      text = `All ${result.passed}/${result.total} cases pass on version ${v}. What's the time and space complexity, and is there a version that uses less memory?`;
    } else {
      const failed = result.cases.filter((c) => !c.pass);
      const first = failed[0];
      text = `Version ${v} passes ${result.passed}/${result.total}. ${failed.map((c) => c.caseId).join(", ")} failed — for ${first.input} you returned ${first.actual ?? first.error} but expected ${first.expected}. Why does your approach miss that one?`;
    }
    this.clearTimers();
    this.emitState("speaking");
    this.timers.push(
      setTimeout(() => {
        if (!this.connected) return;
        this.emitTurn("interviewer", text);
        this.emitState(this.micOn ? "listening" : "idle");
        if (this.micOn) this.scheduleExchange();
      }, 900),
    );
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

  private scheduleExchange() {
    const i = Math.floor(mockTurnCount / 2) % this.script.length;
    this.timers.push(
      setTimeout(() => {
        if (!this.micOn) return;
        this.emitTurn("student", this.script[i]);
        this.emitState("speaking");
        this.timers.push(
          setTimeout(() => {
            if (!this.micOn) return;
            this.emitTurn("interviewer", this.replies[i]);
            this.emitState("listening");
            this.scheduleExchange();
          }, 2000),
        );
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
      id: `t${++mockTurnCount}`,
      speaker,
      text,
      at: new Date().toISOString(),
    };
    this.turnCbs.forEach((cb) => cb(turn));
  }
}
