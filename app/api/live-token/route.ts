import { EndSensitivity, GoogleGenAI, Modality } from "@google/genai";
import type { ApiError, LiveTokenResponse } from "../../../lib/contract";
import { containsDuplicate } from "../../../lib/problems";
import { interviewerInstructions } from "../../../lib/prompts";

// The interviewer instruction for the canonical problem, built by the shared
// builder. A token minted with liveConnectConstraints locks the ENTIRE Live
// config (SDK 3.3.0 authTokens.create docs, "Case 2"), so a client-side
// systemInstruction or realtimeInputConfig is ignored: both must live here.
const SYSTEM_INSTRUCTION = interviewerInstructions(containsDuplicate);

// Server turn detection: require 1.2 s of silence before ending the student's
// turn, so a natural ~850 ms pause mid-sentence does not hand the turn to the
// interviewer. Low end-of-speech sensitivity for the same reason.
const TURN_DETECTION = {
  automaticActivityDetection: {
    silenceDurationMs: 1200,
    prefixPaddingMs: 300,
    endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
  },
};

// Runs on the default Node.js runtime (route handlers are Node by default), so
// the GenAI SDK and the permanent GEMINI_API_KEY stay on the server; the browser
// only ever receives the short-lived ephemeral token minted here. No
// `export const runtime` here: it is incompatible with Next's cacheComponents.

// The SDK 3.3.0 docstring says ephemeral tokens are "v1alpha only", while the
// current docs and README say v1beta. Default to v1beta (README) and allow an
// env override so integration can flip it without a code change.
const LIVE_API_VERSION = process.env.LIVE_API_VERSION ?? "v1beta";

const TOKEN_TTL_MS = 30 * 60 * 1000; // message window for the token
const SESSION_START_TTL_MS = 2 * 60 * 1000; // window to open the Live session

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const PROVIDER_UNAVAILABLE: ApiError = {
  code: "provider_unavailable",
  message: "Voice provider unavailable",
  retryable: true,
};
// Missing key/model is a deployment setting, not a transient failure.
const NOT_CONFIGURED: ApiError = {
  code: "provider_unavailable",
  message: "Voice provider not configured",
  retryable: false,
};
const TIMED_OUT: ApiError = { code: "timeout", message: "Voice token request timed out. Try again.", retryable: true };

// The body is just {sessionId}; anything larger is rejected before any provider call.
const MAX_BODY_BYTES = 1_024;
const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MINT_TIMEOUT_MS = Number(process.env.LIVE_TOKEN_TIMEOUT_MS) || 10_000;

export async function POST(request: Request): Promise<Response> {
  let sessionId: unknown;
  try {
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) throw new Error("too large");
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) throw new Error("too large");
    const body = JSON.parse(raw) as { sessionId?: unknown } | null;
    sessionId = body?.sessionId;
  } catch {
    const error: ApiError = {
      code: "invalid_request",
      message: "Request body must be JSON containing a sessionId",
      retryable: false,
    };
    return json(error, 400);
  }

  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) {
    const error: ApiError = {
      code: "invalid_request",
      message: "sessionId is required (letters, digits, - or _, up to 128)",
      retryable: false,
    };
    return json(error, 400);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.LIVE_MODEL;
  if (!apiKey || !model) {
    // Not a transient outage: the client falls back without offering a retry.
    return json(NOT_CONFIGURED, 503);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, MINT_TIMEOUT_MS);
  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: LIVE_API_VERSION, timeout: MINT_TIMEOUT_MS },
    });

    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    const mint = ai.authTokens.create({
      config: {
        abortSignal: controller.signal,
        uses: 1,
        expireTime: expiresAt,
        newSessionExpireTime: new Date(Date.now() + SESSION_START_TTL_MS).toISOString(),
        // Lock the token to the configured model and audio Live session.
        liveConnectConstraints: {
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            // The locked config is authoritative for the session, so request
            // transcription here or the browser never receives any (audio still
            // flows, but the transcript panel stays empty).
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            sessionResumption: {},
            systemInstruction: SYSTEM_INSTRUCTION,
            realtimeInputConfig: TURN_DETECTION,
          },
        },
      },
    });
    const timeout = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("timeout"))));
    const token = await Promise.race([mint, timeout]);

    if (!token.name) {
      return json(PROVIDER_UNAVAILABLE, 503);
    }

    const response: LiveTokenResponse = { token: token.name, model, expiresAt };
    return json(response, 200);
  } catch {
    // Generic only: provider details and credentials never reach the browser.
    return json(timedOut ? TIMED_OUT : PROVIDER_UNAVAILABLE, 503);
  } finally {
    clearTimeout(timer);
  }
}
