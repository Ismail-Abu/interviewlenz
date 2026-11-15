"use client";

import { useEffect, useRef, useState } from "react";
import { RESUME_LIMITS, type ResumeImage } from "./profile";

interface Props {
  images: ResumeImage[];
  onChange: (next: ResumeImage[]) => void;
}

const fmt = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`);

// Resume screenshots: click to choose, drag and drop, or paste (Ctrl/Cmd+V).
// Images stay in the browser as object URLs; nothing is uploaded.
export function ResumeDrop({ images, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  function add(files: File[]) {
    const errs: string[] = [];
    const next = [...images];
    for (const f of files) {
      if (!(RESUME_LIMITS.types as readonly string[]).includes(f.type)) {
        errs.push(`${f.name || "Pasted file"}: use a PNG, JPG, or WebP screenshot.`);
        continue;
      }
      if (f.size > RESUME_LIMITS.maxBytes) {
        errs.push(`${f.name}: larger than ${fmt(RESUME_LIMITS.maxBytes)}.`);
        continue;
      }
      if (next.length >= RESUME_LIMITS.maxFiles) {
        errs.push(`Up to ${RESUME_LIMITS.maxFiles} screenshots.`);
        break;
      }
      next.push({
        id: crypto.randomUUID(),
        name: f.name || `screenshot-${next.length + 1}.png`,
        size: f.size,
        type: f.type,
        url: URL.createObjectURL(f),
      });
    }
    setProblems(errs);
    if (next.length !== images.length) onChange(next);
  }

  function remove(id: string) {
    const img = images.find((i) => i.id === id);
    if (img) URL.revokeObjectURL(img.url);
    onChange(images.filter((i) => i.id !== id));
  }

  // Paste a screenshot straight from the clipboard while the landing page is open.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        add(files);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(Array.from(e.dataTransfer.files));
        }}
        data-testid="resume-drop"
        className={`flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-6 text-center transition-colors ${
          dragging ? "border-brand-coral bg-brand-coral/10" : "border-zinc-700 bg-zinc-900/60 hover:border-zinc-500"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-brand-coral" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-base font-semibold text-zinc-100">Drop resume screenshots, or click to choose</span>
        <span className="text-sm text-zinc-400">
          PNG, JPG, or WebP · up to {RESUME_LIMITS.maxFiles} images · you can also paste with Ctrl/⌘+V
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={RESUME_LIMITS.types.join(",")}
        multiple
        hidden
        data-testid="resume-input"
        onChange={(e) => {
          add(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {problems.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-amber-300" role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="resume-list">
          {images.map((img, i) => (
            <li key={img.id} className="group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={img.url} alt={`Resume screenshot ${i + 1}`} className="h-28 w-full object-cover object-top" />
              <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-zinc-400">
                <span className="truncate" title={img.name}>
                  {img.name}
                </span>
                <span className="shrink-0">{fmt(img.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => remove(img.id)}
                aria-label={`Remove ${img.name}`}
                className="absolute right-1.5 top-1.5 rounded-md bg-zinc-950/85 px-2 py-0.5 text-sm text-zinc-200 hover:bg-red-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
