"use client";

interface Props {
  nextStep: string;
}

export function VerdictBanner({ nextStep }: Props) {
  return (
    <section className="rounded-xl bg-card border border-border p-5 sm:p-6 shadow-sm relative overflow-hidden">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
          Targeted Practice Strategy
        </span>
      </div>
      <p className="mt-2 text-[17px] sm:text-[19px] font-medium leading-relaxed text-foreground" data-testid="next-step">
        {nextStep}
      </p>
    </section>
  );
}
