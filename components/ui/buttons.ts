// Button styles in the logo's palette: crimson (#C8102E) for primary actions,
// coral (#FE6B73) for secondary actions, and the logo's ink/white for neutral
// ones. Use these instead of ad-hoc colors so every button matches the brand.
// Sizing (padding, text size) stays at each call site.

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export const btn = {
  primary: `${base} bg-brand text-white shadow-sm shadow-black/30 hover:bg-brand-hover`,
  secondary: `${base} border border-brand-coral/60 text-brand-coral hover:border-brand-coral hover:bg-brand-coral/10`,
  neutral: `${base} border border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800/60`,
} as const;

// Cover page buttons (cream surface, design/COVER-PAGE-BRIEF.md). Separate from
// `btn` on purpose: `btn` is used by the dark interview room.
// Sizing lives in the base here; call sites add layout only.
const coverBase =
  "inline-flex items-center justify-center gap-2 rounded-[18px] font-semibold " +
  "text-[15px] px-6 py-3.5 transition-all duration-150 select-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-soft " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

export const coverBtn = {
  primary: `${coverBase} bg-maroon text-white shadow-[0_10px_18px_-6px_rgb(90_68_50/0.25)] hover:bg-maroon-hover active:bg-maroon-deep hover:shadow-[0_12px_22px_-6px_rgb(90_68_50/0.32)]`,
  secondary: `${coverBase} bg-cream-3 text-maroon-deep border border-cream-line hover:bg-[#EFE0CA] hover:border-maroon-soft/40 active:bg-cream-2`,
  neutral: `${coverBase} text-ink-muted hover:text-ink hover:bg-cream-2 border border-transparent`,
} as const;

// Compact cover buttons (inline actions inside setup cards). Same colours.
const coverSmBase =
  "inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold " +
  "text-sm px-4 py-2 transition-all duration-150 select-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-soft " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const coverBtnSm = {
  primary: `${coverSmBase} bg-maroon text-white shadow-sm hover:bg-maroon-hover active:bg-maroon-deep`,
  secondary: `${coverSmBase} bg-cream-3 text-maroon-deep border border-cream-line hover:bg-[#EFE0CA] hover:border-maroon-soft/40 active:bg-cream-2`,
  neutral: `${coverSmBase} text-ink-muted hover:text-ink hover:bg-cream-3 border border-transparent`,
} as const;
