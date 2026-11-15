"use client";

interface Props {
  nextStep: string;
}

export function VerdictBanner({ nextStep }: Props) {
  return (
    <section className="rounded-[22px] bg-[#161720]/90 border border-white/[0.08] p-5 sm:p-6 shadow-xl relative overflow-hidden">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" aria-hidden />
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400">
          Targeted Practice Strategy
        </span>
      </div>
      <p className="mt-2 text-[18px] sm:text-[20px] font-medium leading-relaxed text-zinc-100" data-testid="next-step">
        {nextStep}
      </p>
    </section>
  );
}
