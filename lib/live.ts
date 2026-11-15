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
import { formatCodeContext, formatRunEvidence, formatRunFollowup, interviewerInstructions } from "./prompts";

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

class BrowserLiveClient implements LiveClient {
  private session: Session | null = null;

  private stateCb: ((state: LiveState) => void) | null = null;
  private turnCb: ((turn: TranscriptTurn) => void) | null = null;
  private errorCb: ((error: ApiError) => void) | null = null;

  private state: LiveState = "idle";
  private turnSeq = 0;

  private pendingInput = "";
  private pendingOutput = "";

  // --- Code context + completed-Run evidence + follow-up gating ----------
  // The newest code the student has (from edits or runs). A late older Run never
  // lowers these. Preserved across a disconnect for this attempt.
  private currentBufferVersion = 0;
  private currentBufferSource = "";
  // Highest "not run yet" buffer version this session has received.
  private lastSentBufferVersion = 0;
  // Versions that have been run (never labeled "not run yet").
  private runVersions = new Set<number>();
  // The most recent completed Run, kept version+source+score together and
  // preserved for the whole attempt so it can be restored after a reconnect.
  private latestRun: { epoch: number; snapshot: CodeSnapshot; result: RunResult } | null = null;
  private runEpoch = 0; // increments per Run; identifies the latest Run
  private deliveredRunEpoch = 0; // latest Run epoch this session has received as evidence
  // We owe a spoken follow-up about latestRun (separate from sending evidence).
  private followupOwed = false;
  // True between the interviewer's first audio/transcript and its turnComplete.
  private modelTurnActive = false;
  // True while the interviewer has asked a question and is waiting for the
  // student's spoken answer. Only a completed student turn clears it (an edit,
  // Run, silence, or partial transcript does not), so an extra Run cannot pose a
  // second question or skip a stage.
  private outstanding = false;
  // The session dropped unexpectedly (vs. an intentional end()).
  private disconnected = false;
  private ending = false;

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
    this.ending = false;

    const systemInstruction = interviewerInstructions(problem);

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
            if (this.ending) this.session = null;
            else this.markDisconnected();
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

      // A fresh session knows nothing yet: reset per-session delivery trackers
      // and conversation state, but keep the preserved buffer + latest Run and
      // re-deliver them now. This restores Run evidence after a reconnect.
      this.deliveredRunEpoch = 0;
      this.lastSentBufferVersion = 0;
      this.modelTurnActive = false;
      this.outstanding = false;
      this.disconnected = false;
      this.pendingInput = "";
      this.pendingOutput = "";
      this.pump();
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

  // Update the model's code context WITHOUT requesting a spoken turn (initial
  // sync and paused-edit snapshots). A typing pause alone never asks a question.
  // Preserves the buffer even while disconnected, so it is restored on reconnect.
  syncCode(snapshot: CodeSnapshot): void {
    this.observeVersion(snapshot.codeVersion, snapshot.source);
    this.pump();
  }

  // Record a completed Run — exact version, source, and score kept together —
  // and deliver it as evidence. Requesting a spoken follow-up is a SEPARATE step
  // (pumpFollowup), gated so it cannot fire while a question is outstanding or
  // mid-answer. The Run is preserved even while disconnected, so it survives to
  // the next reconnect.
  sendRunContext(snapshot: CodeSnapshot, result: RunResult): void {
    const version = result.codeVersion;
    this.runVersions.add(version);
    this.observeVersion(version, snapshot.source);
    this.runEpoch += 1;
    this.latestRun = { epoch: this.runEpoch, snapshot, result };
    this.followupOwed = true;
    this.pump();
  }

  // Record the newest code the student has. A higher version supersedes the
  // buffer; an equal/older version never lowers it (a late v4 Run must not
  // overwrite a current v5 buffer).
  private observeVersion(version: number, source: string): void {
    if (version >= this.currentBufferVersion) {
      this.currentBufferVersion = version;
      this.currentBufferSource = source;
    }
  }

  private pump(): void {
    this.pumpEvidence();
    this.pumpFollowup();
  }

  // Deliver completed-Run evidence (and any genuine "not run yet" buffer) as
  // SILENT context (turnComplete:false). This is NOT gated by the outstanding
  // question: the model must always have the accurate latest score. Held only
  // while the interviewer is mid-turn, flushed at the next boundary.
  private pumpEvidence(): void {
    if (!this.session || this.modelTurnActive) return;

    const parts: string[] = [];
    const runUndelivered = !!this.latestRun && this.latestRun.epoch > this.deliveredRunEpoch;
    if (runUndelivered && this.latestRun) {
      parts.push(formatRunEvidence(this.latestRun.snapshot, this.latestRun.result, this.currentBufferVersion));
    }
    // Only offer a version as "not run yet" if it genuinely has not been run.
    const bufferEligible =
      this.currentBufferVersion > this.lastSentBufferVersion && !this.runVersions.has(this.currentBufferVersion);
    if (bufferEligible) {
      parts.push(
        formatCodeContext({
          codeVersion: this.currentBufferVersion,
          source: this.currentBufferSource,
          at: new Date().toISOString(),
        }),
      );
    }
    if (parts.length === 0) return;

    try {
      this.session.sendClientContent({
        turns: [{ role: "user", parts: [{ text: parts.join("\n\n") }] }],
        turnComplete: false,
      });
      if (runUndelivered && this.latestRun) this.deliveredRunEpoch = this.latestRun.epoch;
      if (bufferEligible) this.lastSentBufferVersion = this.currentBufferVersion;
    } catch {
      this.markDisconnected();
    }
  }

  // Request ONE spoken follow-up about the latest Run. Gated: never while the
  // interviewer is mid-turn, while a question is already outstanding, or while
  // the student is mid-answer — a partial transcript must not trigger a question.
  private pumpFollowup(): void {
    if (!this.session || this.modelTurnActive || this.outstanding) return;
    if (this.pendingInput !== "") return; // student is mid-utterance
    if (!this.followupOwed || !this.latestRun) return;

    const text = formatRunFollowup(this.latestRun.result, this.currentBufferVersion);
    try {
      this.session.sendClientContent({
        turns: [{ role: "user", parts: [{ text }] }],
        turnComplete: true,
      });
      this.followupOwed = false;
      this.modelTurnActive = true; // a turn is coming
      this.outstanding = true; // we just posed a question
    } catch {
      this.markDisconnected();
    }
  }

  // Preserve state and surface the disconnected state; a reconnect restores the
  // buffer and the latest Run.
  private markDisconnected(): void {
    this.session = null;
    this.modelTurnActive = false;
    if (this.disconnected) return;
    this.disconnected = true;
    this.setState("error");
    this.errorCb?.({ code: "provider_unavailable", message: "Voice connection lost", retryable: true });
  }

  end(): void {
    this.ending = true;
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
    // Clear all preserved evidence on End (and therefore Retry, which ends the
    // session first): the next attempt starts clean.
    this.pendingInput = "";
    this.pendingOutput = "";
    this.latestRun = null;
    this.followupOwed = false;
    this.runVersions.clear();
    this.runEpoch = 0;
    this.deliveredRunEpoch = 0;
    this.currentBufferVersion = 0;
    this.currentBufferSource = "";
    this.lastSentBufferVersion = 0;
    this.modelTurnActive = false;
    this.outstanding = false;
    this.disconnected = false;
    this.setState("idle");
  }

  private handleMessage(message: LiveServerMessage): void {
    const audio = message.data; // concatenated base64 PCM (24 kHz)
    if (audio) {
      this.modelTurnActive = true; // the interviewer is producing a turn
      this.setState("speaking");
      this.playAudio(audio);
    }

    const content = message.serverContent;
    if (!content) return;

    // Transcription streams text across chunks, and a completion event can carry
    // `finished` with no text of its own. Handle presence and the finished flag
    // separately so a text-less completion still flushes the turn.
    if (content.inputTranscription) {
      if (content.inputTranscription.text) this.pendingInput += content.inputTranscription.text;
      if (content.inputTranscription.finished && this.pendingInput) {
        const text = this.pendingInput;
        this.pendingInput = ""; // clear before emit so a follow-up sees no mid-utterance
        this.emitTurn("student", text);
      }
    }

    if (content.outputTranscription) {
      if (content.outputTranscription.text) this.pendingOutput += content.outputTranscription.text;
      if (content.outputTranscription.text || content.outputTranscription.finished) {
        this.modelTurnActive = true;
        this.setState("speaking");
      }
      if (content.outputTranscription.finished && this.pendingOutput) {
        const text = this.pendingOutput;
        this.pendingOutput = "";
        this.emitTurn("interviewer", text);
      }
    }

    if (content.interrupted) this.stopPlayback();

    if (content.turnComplete) {
      if (this.pendingInput) {
        const text = this.pendingInput;
        this.pendingInput = "";
        this.emitTurn("student", text);
      }
      if (this.pendingOutput) {
        const text = this.pendingOutput;
        this.pendingOutput = "";
        this.emitTurn("interviewer", text);
      }
      this.modelTurnActive = false;
      this.setState(this.micActive ? "listening" : "idle");
      // Natural turn boundary: deliver queued evidence and any owed follow-up.
      this.pump();
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
    if (speaker === "student") {
      // Only a completed student turn answers the outstanding question; an owed
      // follow-up (if any) may now be raised at this boundary.
      this.outstanding = false;
      this.pump();
    } else {
      this.outstanding = true; // the interviewer just asked; wait for the student
    }
  }
}

export function createLiveClient(): LiveClient {
  return new BrowserLiveClient();
}

export { BrowserLiveClient };
