"use client";

interface Props {
  nextStep: string;
}

export function VerdictBanner({ nextStep }: Props) {
  return (
    <section className="rounded-[22px] bg-cream-3/80 p-5 sm:p-6 shadow-[0_10px_18px_-6px_rgb(90_68_50/0.08)] border border-cream-line/60">
      <div className="text-xs font-bold uppercase tracking-wider text-maroon-deep">Next step to practice</div>
      <p className="mt-1.5 text-[20px] font-medium leading-relaxed text-ink" data-testid="next-step">
        {nextStep}
      </p>
    </section>
  );
}
