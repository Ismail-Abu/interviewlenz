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
