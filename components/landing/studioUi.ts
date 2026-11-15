// "Obsidian developer studio" classes for the homepage, application setup and
// plan review. Kept here (not components/ui/buttons.ts) so the front door can
// change without touching other screens. Colors are chosen for WCAG AA on
// #09090B / #0C0D12.

const base = "inline-flex items-center justify-center gap-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

export const studioBtn = {
  // Radiant crimson CTA.
  primary: `${base} rounded-[14px] bg-gradient-to-r from-[#C8102E] to-[#E11D48] px-6 py-3.5 text-[15px] text-white shadow-[0_0_25px_rgba(200,16,46,0.35)] ring-1 ring-rose-300/20 hover:shadow-[0_0_32px_rgba(225,29,72,0.5)] hover:brightness-110`,
  secondary: `${base} rounded-[14px] border border-white/[0.12] bg-white/[0.05] px-6 py-3.5 text-[15px] text-zinc-100 backdrop-blur-xl hover:border-white/25 hover:bg-white/[0.09]`,
  ghost: `${base} rounded-[12px] px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white`,
} as const;

export const studioBtnSm = {
  primary: `${base} rounded-[12px] bg-gradient-to-r from-[#C8102E] to-[#E11D48] px-3.5 py-2 text-sm text-white shadow-[0_0_18px_rgba(200,16,46,0.3)] hover:brightness-110`,
  secondary: `${base} rounded-[12px] border border-white/[0.12] bg-white/[0.05] px-3.5 py-2 text-sm text-zinc-100 hover:border-white/25 hover:bg-white/[0.09]`,
  neutral: `${base} rounded-[12px] px-3.5 py-2 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white`,
} as const;

export const studio = {
  page: "studio-surface min-h-screen bg-[#09090B] text-zinc-100 [color-scheme:dark]",
  glass: "rounded-[22px] border border-white/[0.08] bg-zinc-900/60 backdrop-blur-xl shadow-2xl shadow-black/40",
  inset: "rounded-[16px] border border-white/[0.06] bg-[#0C0D12]/80",
  eyebrow: "inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-950/40 px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rose-200",
  field:
    "w-full rounded-[12px] border border-white/[0.1] bg-[#0C0D12] px-3 py-2.5 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-rose-400/60 focus:outline-none focus:ring-2 focus:ring-rose-500/30",
  warn: "rounded-[16px] border border-amber-500/30 bg-amber-950/50 p-3 text-sm text-amber-200",
} as const;
