// The wordmark for cream surfaces.
//
// components/Logo.tsx exports a Wordmark built for the dark UI: white
// "Interview" with a coral mark, which disappears on cream. Logo.tsx's own
// header already states the intent — "Coral is the brand accent on dark
// backgrounds, crimson on light ones" — but no light variant exists yet, and
// Logo.tsx belongs to the cover-page task.
//
// So this composes the exported LogoMark with ink + crimson text instead of
// editing the shared file. When Wordmark gains a `tone` prop, delete this and
// use it.

import { LogoMark } from "../Logo";

// LogoMark paints with `fill="currentColor"`, so the colour comes from a class.
export function WordmarkCream({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: size * 0.38 }}>
      <LogoMark size={size} className="shrink-0 text-[#C8102E]" />
      <span
        className="font-brand font-bold leading-none tracking-[-0.02em] text-ink"
        style={{ fontSize: size * 0.82 }}
        aria-label="Interviewlenz"
      >
        Interview<span className="text-[#C8102E]">lenz</span>
      </span>
    </span>
  );
}
