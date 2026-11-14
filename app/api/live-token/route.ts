import { GoogleGenAI, Modality } from "@google/genai";
import type { ApiError, LiveTokenResponse } from "../../../lib/contract";

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

export async function POST(request: Request): Promise<Response> {
  let sessionId: unknown;
  try {
    const body = (await request.json()) as { sessionId?: unknown };
    sessionId = body?.sessionId;
  } catch {
    const error: ApiError = {
      code: "invalid_request",
      message: "Request body must be JSON containing a sessionId",
      retryable: false,
    };
    return json(error, 400);
  }

  if (typeof sessionId !== "string" || sessionId.length === 0) {
    const error: ApiError = {
      code: "invalid_request",
      message: "sessionId is required",
      retryable: false,
    };
    return json(error, 400);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.LIVE_MODEL;
  if (!apiKey || !model) {
    // Misconfiguration is surfaced to the client as a provider outage.
    return json(PROVIDER_UNAVAILABLE, 503);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: LIVE_API_VERSION },
    });

    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: expiresAt,
        newSessionExpireTime: new Date(Date.now() + SESSION_START_TTL_MS).toISOString(),
        // Lock the token to the configured model and audio Live session.
        liveConnectConstraints: {
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            sessionResumption: {},
          },
        },
      },
    });

    if (!token.name) {
      return json(PROVIDER_UNAVAILABLE, 503);
    }

    const response: LiveTokenResponse = { token: token.name, model, expiresAt };
    return json(response, 200);
  } catch {
    return json(PROVIDER_UNAVAILABLE, 503);
  }
}
