// Client-side only. Browser voice client for the Gemini Live API. Never import
// this on the server: it uses Web Audio, getUserMedia, and the ephemeral token
// minted by app/api/live-token.
import { GoogleGenAI, Modality } from "@google/genai";
import type { LiveServerMessage, Session } from "@google/genai";
import type {
  ApiError,
  CodeSnapshot,
  LiveClient,
  LiveState,
  LiveTokenResponse,
  Problem,
  RunResult,
  TranscriptTurn,
} from "./contract";

// See the note in app/api/live-token/route.ts about the v1alpha/v1beta
// conflict. The browser client must match the version the token was minted for.
const LIVE_API_VERSION = "v1beta";
const INPUT_SAMPLE_RATE = 16000; // Live API input: 16-bit PCM, 16 kHz, mono
const OUTPUT_SAMPLE_RATE = 24000; // Live API output: 16-bit PCM, 24 kHz

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function floatToPcm16(input: Float32Array): Uint8Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return new Uint8Array(out.buffer);
}

// Minimal placeholder for the Run-context wording. B3 owns the final text and
// moves it into lib/prompts.ts; the shape here follows docs/CONTRACT.md.
function formatRunContext(snapshot: CodeSnapshot, result: RunResult): string {
  const lines: string[] = [];
  if (result.status === "completed") {
    lines.push(`[RUN v${result.codeVersion}] ${result.passed}/${result.total} passed.`);
    for (const c of result.cases) {
      if (!c.pass) {
        lines.push(
          `Failed: ${c.caseId} input ${c.input} expected ${c.expected} got ${c.actual ?? c.error ?? "error"}`,
        );
      }
    }
  } else {
    lines.push(`[RUN v${result.codeVersion}] error: ${result.error.code} ${result.error.message}`);
  }
  lines.push("Code:", "```python", snapshot.source, "```");
  return lines.join("\n");
}

class BrowserLiveClient implements LiveClient {
  private session: Session | null = null;

  private stateCb: ((state: LiveState) => void) | null = null;
  private turnCb: ((turn: TranscriptTurn) => void) | null = null;
  private errorCb: ((error: ApiError) => void) | null = null;

  private state: LiveState = "idle";
  private turnSeq = 0;

  private pendingInput = "";
  private pendingOutput = "";

  // Microphone input graph.
  private micStream: MediaStream | null = null;
  private inputCtx: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private micActive = false;

  // Playback graph (24 kHz), scheduled gaplessly.
  private outputCtx: AudioContext | null = null;
  private playHead = 0;
  private sources = new Set<AudioBufferSourceNode>();

  onState(cb: (state: LiveState) => void): void {
    this.stateCb = cb;
  }

  onTurn(cb: (turn: TranscriptTurn) => void): void {
    this.turnCb = cb;
  }

  onError(cb: (error: ApiError) => void): void {
    this.errorCb = cb;
  }

  async connect(token: LiveTokenResponse, problem: Problem): Promise<void> {
    this.setState("connecting");

    // Minimal interviewer instruction for B2. B3 replaces the wording via
    // lib/prompts.ts.
    const systemInstruction =
      `You are a technical interviewer for the problem "${problem.title}". ` +
      "The candidate is solving it in Python. Listen to their reasoning and ask short, " +
      "specific follow-up questions about their approach, correctness, and complexity. " +
      "Keep spoken responses brief.";

    try {
      const ai = new GoogleGenAI({
        apiKey: token.token,
        httpOptions: { apiVersion: LIVE_API_VERSION },
      });

      this.session = await ai.live.connect({
        model: token.model,
        callbacks: {
          onopen: () => this.setState(this.micActive ? "listening" : "idle"),
          onmessage: (message: LiveServerMessage) => this.handleMessage(message),
          onerror: (event: ErrorEvent) => this.emitError(event?.message ?? "Live connection error"),
          onclose: () => {
            this.session = null;
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          sessionResumption: {},
          systemInstruction,
        },
      });
    } catch (error) {
      this.session = null;
      this.emitError(error instanceof Error ? error.message : "Could not connect to voice provider");
      throw error;
    }
  }

  async startMic(): Promise<void> {
    if (this.micActive) return;
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      this.inputCtx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      if (this.inputCtx.state === "suspended") await this.inputCtx.resume();

      const rate = this.inputCtx.sampleRate; // honor the real rate; server resamples
      this.inputSource = this.inputCtx.createMediaStreamSource(this.micStream);
      // ScriptProcessorNode keeps this file self-contained (no separate
      // AudioWorklet asset to serve). Adequate for a short demo.
      this.processor = this.inputCtx.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!this.session || !this.micActive) return;
        const pcm = floatToPcm16(event.inputBuffer.getChannelData(0));
        try {
          this.session.sendRealtimeInput({
            audio: { data: toBase64(pcm), mimeType: `audio/pcm;rate=${rate}` },
          });
        } catch {
          // Drop a frame rather than throw out of the audio callback.
        }
      };
      this.inputSource.connect(this.processor);
      this.processor.connect(this.inputCtx.destination); // outputs silence; keeps the node alive
      this.micActive = true;
      if (this.state !== "speaking") this.setState("listening");
    } catch (error) {
      this.cleanupMic();
      const apiError: ApiError = {
        code: "provider_unavailable",
        message: error instanceof Error ? error.message : "Microphone unavailable",
        retryable: true,
      };
      this.errorCb?.(apiError);
      throw error;
    }
  }

  stopMic(): void {
    this.micActive = false;
    this.cleanupMic();
    if (this.session) {
      try {
        this.session.sendRealtimeInput({ audioStreamEnd: true });
      } catch {
        // ignore
      }
    }
    if (this.state !== "speaking") this.setState("idle");
  }

  sendRunContext(snapshot: CodeSnapshot, result: RunResult): void {
    if (!this.session) return;
    try {
      this.session.sendClientContent({
        turns: [{ role: "user", parts: [{ text: formatRunContext(snapshot, result) }] }],
        turnComplete: false,
      });
    } catch {
      // ignore; the next run will try again
    }
  }

  end(): void {
    this.micActive = false;
    this.cleanupMic();
    this.stopPlayback();
    if (this.outputCtx) {
      try {
        void this.outputCtx.close();
      } catch {
        // ignore
      }
      this.outputCtx = null;
    }
    if (this.session) {
      try {
        this.session.close();
      } catch {
        // ignore
      }
      this.session = null;
    }
    this.pendingInput = "";
    this.pendingOutput = "";
    this.setState("idle");
  }

  private handleMessage(message: LiveServerMessage): void {
    const audio = message.data; // concatenated base64 PCM (24 kHz)
    if (audio) this.playAudio(audio);

    const content = message.serverContent;
    if (!content) return;

    if (content.inputTranscription?.text) {
      this.pendingInput += content.inputTranscription.text;
      if (content.inputTranscription.finished) {
        this.emitTurn("student", this.pendingInput);
        this.pendingInput = "";
      }
    }

    if (content.outputTranscription?.text) {
      this.pendingOutput += content.outputTranscription.text;
      this.setState("speaking");
      if (content.outputTranscription.finished) {
        this.emitTurn("interviewer", this.pendingOutput);
        this.pendingOutput = "";
      }
    }

    if (content.interrupted) this.stopPlayback();

    if (content.turnComplete) {
      if (this.pendingInput) {
        this.emitTurn("student", this.pendingInput);
        this.pendingInput = "";
      }
      if (this.pendingOutput) {
        this.emitTurn("interviewer", this.pendingOutput);
        this.pendingOutput = "";
      }
      this.setState(this.micActive ? "listening" : "idle");
    }
  }

  private playAudio(b64: string): void {
    const ctx = this.ensureOutputCtx();
    const bytes = fromBase64(b64);
    const frames = Math.floor(bytes.byteLength / 2);
    if (frames === 0) return;
    const samples = new Int16Array(bytes.buffer, bytes.byteOffset, frames);

    const buffer = ctx.createBuffer(1, frames, OUTPUT_SAMPLE_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) channel[i] = samples[i] / 0x8000;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const start = Math.max(this.playHead, ctx.currentTime);
    source.start(start);
    this.playHead = start + buffer.duration;
    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
  }

  private ensureOutputCtx(): AudioContext {
    if (!this.outputCtx) {
      this.outputCtx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      this.playHead = this.outputCtx.currentTime;
    }
    return this.outputCtx;
  }

  private stopPlayback(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    this.sources.clear();
    if (this.outputCtx) this.playHead = this.outputCtx.currentTime;
  }

  private cleanupMic(): void {
    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {
        // ignore
      }
      this.processor.onaudioprocess = null;
      this.processor = null;
    }
    if (this.inputSource) {
      try {
        this.inputSource.disconnect();
      } catch {
        // ignore
      }
      this.inputSource = null;
    }
    if (this.inputCtx) {
      try {
        void this.inputCtx.close();
      } catch {
        // ignore
      }
      this.inputCtx = null;
    }
    if (this.micStream) {
      for (const track of this.micStream.getTracks()) track.stop();
      this.micStream = null;
    }
  }

  private setState(state: LiveState): void {
    if (state === this.state) return;
    this.state = state;
    this.stateCb?.(state);
  }

  private emitError(message: string): void {
    this.setState("error");
    this.errorCb?.({ code: "provider_unavailable", message, retryable: true });
  }

  private emitTurn(speaker: TranscriptTurn["speaker"], text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.turnSeq += 1;
    this.turnCb?.({
      id: `t${this.turnSeq}`,
      speaker,
      text: trimmed,
      at: new Date().toISOString(),
    });
  }
}

export function createLiveClient(): LiveClient {
  return new BrowserLiveClient();
}

export { BrowserLiveClient };
