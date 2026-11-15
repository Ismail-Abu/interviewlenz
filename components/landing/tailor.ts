// Browser side of "Prepare my interview": compress the selected resume pages,
// build the request, check its exact serialized size, and call
// POST /api/analyze-tailoring. Nothing here runs until the student selects
// Prepare; selecting files or opening the form never calls it.
import type { ApiError, BehavioralContext, TailoringRequest, TailoringSuggestion } from "@/lib/contract";
import { TAILORING_LIMITS } from "@/lib/behavioral";
import type { ResumeImage } from "./profile";

// Long side (px) and JPEG quality, from best to smallest. The floor keeps
// resume text legible; below it we stop and let the student choose.
const LADDER: [number, number][] = [
  [1600, 0.85],
  [1400, 0.8],
  [1250, 0.72],
  [1100, 0.65],
];

export type Prepared =
  | { ok: true; body: string; bytes: number; pages: number }
  | { ok: false; reason: "too-large" | "unreadable"; bytes?: number };

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("unreadable"));
    img.src = url;
  });
}

function encode(img: HTMLImageElement, longSide: number, quality: number): string {
  const scale = Math.min(1, longSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("unreadable");
  ctx.fillStyle = "#fff"; // JPEG has no alpha: keep text dark on white
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality).split(",")[1] ?? "";
}

export const byteSize = (s: string) => new TextEncoder().encode(s).length;

export async function prepareRequest(
  resume: ResumeImage[],
  rest: Omit<TailoringRequest, "images">,
): Promise<Prepared> {
  let loaded: HTMLImageElement[];
  try {
    loaded = await Promise.all(resume.map((r) => loadImage(r.url)));
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  let last = 0;
  for (const [side, quality] of LADDER) {
    let images: TailoringRequest["images"];
    try {
      images = loaded.map((img) => ({ mimeType: "image/jpeg" as const, data: encode(img, side, quality) }));
    } catch {
      return { ok: false, reason: "unreadable" };
    }
    const req: TailoringRequest = { ...(images.length ? { images } : {}), ...rest };
    const body = JSON.stringify(req);
    last = byteSize(body);
    if (last <= TAILORING_LIMITS.maxBytes) return { ok: true, body, bytes: last, pages: images.length };
  }
  return { ok: false, reason: "too-large", bytes: last };
}

export type AnalyzeResult = { ok: true; suggestion: TailoringSuggestion } | { ok: false; error: ApiError };

export async function analyzeTailoring(body: string, signal: AbortSignal): Promise<AnalyzeResult> {
  // The exact bytes we are about to send, checked once more.
  if (byteSize(body) > TAILORING_LIMITS.maxBytes) {
    return { ok: false, error: { code: "invalid_request", message: "Too large to send", retryable: false } };
  }
  try {
    const res = await fetch("/api/analyze-tailoring", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal });
    const json = await res.json().catch(() => null);
    if (res.ok && json && typeof json.suggestion === "object") return { ok: true, suggestion: json.suggestion as TailoringSuggestion };
    if (json && typeof json.code === "string") return { ok: false, error: json as ApiError };
    return { ok: false, error: { code: "provider_unavailable", message: "Tailoring is unavailable right now.", retryable: true } };
  } catch {
    return { ok: false, error: { code: "provider_unavailable", message: "Couldn't reach the tailoring service.", retryable: true } };
  }
}

// The editable preview -> the confirmed context. Excerpts are never included.
export interface Draft {
  project?: { name: string; summary: string; excerpt?: string };
  focus?: { skill: string; detail: string; excerpt?: string };
}
export function draftToContext(d: Draft): BehavioralContext | undefined {
  const ctx: BehavioralContext = {};
  if (d.project?.name.trim()) {
    ctx.project = d.project.summary.trim() ? { name: d.project.name.trim(), summary: d.project.summary.trim() } : { name: d.project.name.trim() };
  }
  if (d.focus?.skill.trim()) {
    ctx.focus = d.focus.detail.trim() ? { skill: d.focus.skill.trim(), detail: d.focus.detail.trim() } : { skill: d.focus.skill.trim() };
  }
  return ctx.project || ctx.focus ? ctx : undefined;
}
