// Interviewlenz brand mark and wordmark, rebuilt as SVG from the team's logo
// sheet (magnifier ring + speech tail + voice bars; "Interview" + accent "lenz").
// Coral is the brand accent on dark backgrounds, crimson on light ones.

export const BRAND = {
  crimson: "#C8102E",
  coral: "#FE6B73",
} as const;

export function LogoMark({ size = 32, className = "", title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 356 394"
      width={(size * 356) / 394}
      height={size}
      className={className}
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        fillRule="evenodd"
        d="M170 0a170 170 0 1 0 0 340a170 170 0 1 0 0-340zm0 39a131 131 0 1 1 0 262a131 131 0 1 1 0-262z"
      />
      <path d="M232 316 L324 246 L352 383 Q353 391 345 388 Z" stroke="currentColor" strokeWidth={6} strokeLinejoin="round" />
      <rect x="83" y="136" width="27" height="66" rx="13.5" />
      <rect x="130" y="98" width="27" height="139" rx="13.5" />
      <rect x="177" y="121" width="27" height="96" rx="13.5" />
      <rect x="223" y="146" width="27" height="48" rx="13.5" />
    </svg>
  );
}

interface WordmarkProps {
  // Height of the mark in px; the text scales with it.
  size?: number;
  tagline?: boolean;
  className?: string;
}

// Mark + "Interviewlenz" for the dark UI: white "Interview", coral mark and "lenz".
export function Wordmark({ size = 28, tagline = false, className = "" }: WordmarkProps) {
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: size * 0.38 }}>
      <LogoMark size={size} className="shrink-0 text-[#FE6B73]" />
      <span className="flex flex-col items-start text-left">
        <span
          className="font-brand font-bold leading-none tracking-[-0.02em] text-zinc-50"
          style={{ fontSize: size * 0.82 }}
          aria-label="Interviewlenz"
        >
          Interview<span className="text-[#FE6B73]">lenz</span>
        </span>
        {tagline && (
          <span className="font-brand mt-[0.45em] leading-none tracking-[0.03em] text-zinc-400" style={{ fontSize: size * 0.24 }}>
            Mock interviews for CS students
          </span>
        )}
      </span>
    </span>
  );
}
