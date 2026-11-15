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
// `btn` on purpose: `btn` is used by the dark interview room, which must not
// change. Sizing lives in the base here; call sites add layout only.
const coverBase =
  "inline-flex items-center justify-center gap-2 rounded-[18px] font-semibold " +
  "text-[15px] px-6 py-4 transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export const coverBtn = {
  primary: `${coverBase} bg-maroon text-white shadow-[0_10px_18px_-6px_rgb(90_68_50/0.25)] hover:bg-maroon-hover`,
  secondary: `${coverBase} bg-cream-3 text-maroon-deep hover:bg-[#EFE0CA]`,
  neutral: `${coverBase} text-ink-muted hover:text-ink hover:bg-cream-2`,
} as const;
