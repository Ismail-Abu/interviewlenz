const MAX_TEXT = 2500;

// Bound paid calls per warm instance. A provider-side quota also caps usage across replicas.
let windowStart = 0;
let calls = 0;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Cross-origin playback request." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "Send JSON." }, { status: 415 });
  }
  if (Number(request.headers.get("content-length")) > MAX_TEXT * 6 + 128) {
    return Response.json({ error: "Text is too long." }, { status: 413 });
  }
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > MAX_TEXT) {
    return Response.json({ error: "Provide 1 to 2500 characters." }, { status: 400 });
  }
  const fallback = () => Response.json({ playback: "browser" }, { headers: { "Cache-Control": "no-store" } });
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return fallback();
  if (Date.now() - windowStart >= 60000) {
    windowStart = Date.now();
    calls = 0;
  }
  if (calls >= 30) return fallback();
  calls++;
  const voice = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000)]),
    });
    if (!response.ok || !response.body) return fallback();
    return new Response(response.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch {
    return fallback();
  }
}
