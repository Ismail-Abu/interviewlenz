// The four pillars of Interviewlenz, as an engineering bento grid. Copy is kept
// to what the app actually does: no latency, memory, or "no hallucination"
// claims, and no claim that the rubric comes from any company.

const card = "relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-zinc-900/60 p-6 backdrop-blur-xl shadow-2xl shadow-black/40";
const tag = "font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rose-300";

function Wave() {
  // Decorative: CSS-only, static under reduced motion.
  const bars = [0.35, 0.7, 1, 0.55, 0.85, 0.4, 0.95, 0.6, 0.3, 0.75, 0.5, 0.9];
  return (
    <div aria-hidden className="mt-5 flex h-16 items-end gap-1.5">
      <style>{`@keyframes bento-wave{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
@media (prefers-reduced-motion: reduce){.bento-bar{animation:none!important}}`}</style>
      {bars.map((h, i) => (
        <span
          key={i}
          className="bento-bar block w-2 origin-bottom rounded-full bg-gradient-to-t from-[#C8102E] to-[#FB7185]"
          style={{ height: `${h * 100}%`, animation: `bento-wave ${0.9 + (i % 4) * 0.15}s ease-in-out ${i * 0.07}s infinite` }}
        />
      ))}
    </div>
  );
}

// onTryVoice: start a behavioral (voice-only) round straight from the audio card.
export function BentoGrid({ onTryVoice, disabled = false }: { onTryVoice?: () => void; disabled?: boolean }) {
  return (
    <section aria-labelledby="bento-heading" className="py-16" data-testid="bento-grid">
      <p className={tag}>How it works</p>
      <h2 id="bento-heading" className="mt-2 font-brand text-[28px] font-bold tracking-tight text-zinc-50 sm:text-[34px]">
        An interviewer, a sandbox, and receipts.
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-6">
        {/* 1. Live audio */}
        <article className={`${card} md:col-span-4`}>
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-rose-600/20 blur-3xl" />
          <p className={tag}>01 · Live audio engine</p>
          <h3 className="mt-2 text-xl font-bold text-zinc-50">Follow-ups on what you just said</h3>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-zinc-300">
            A real-time voice interviewer (Gemini Live) listens while you reason out loud and asks one follow-up at a time about
            the gap in your answer, not a script.
          </p>
          <Wave />
          {onTryVoice && (
            <button
              type="button"
              onClick={onTryVoice}
              disabled={disabled}
              data-testid="skip-behavioral"
              className="relative mt-5 inline-flex items-center gap-2 rounded-[12px] border border-rose-500/30 bg-rose-950/40 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-400/60 hover:bg-rose-900/50 disabled:opacity-60"
            >
              Try the voice interviewer <span aria-hidden>→</span>
            </button>
          )}
        </article>

        {/* 2. Python sandbox */}
        <article className={`${card} md:col-span-2`}>
          <p className={tag}>02 · Python in your browser</p>
          <h3 className="mt-2 text-xl font-bold text-zinc-50">Runs locally with Pyodide</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-zinc-300">
            Your code runs in the browser, with no server round-trip. Each Run reports every test case and the observed runtime.
          </p>
          <div aria-hidden className="mt-5 rounded-[14px] border border-white/[0.06] bg-[#0C0D12] p-3 font-mono text-xs text-zinc-300">
            <div className="flex justify-between"><span>run v4</span><span className="text-emerald-400">4/4 passed</span></div>
            <div className="mt-1 flex justify-between text-zinc-400"><span>c1 c2 c3 c4</span><span>12 ms</span></div>
          </div>
        </article>

        {/* 3. Grounded evidence */}
        <article className={`${card} md:col-span-3`}>
          <p className={tag}>03 · Grounded evidence</p>
          <h3 className="mt-2 text-xl font-bold text-zinc-50">Every finding cites what you did</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-zinc-300">
            Feedback points to your code lines, your test runs, or your exact words. Citations to anything that didn&apos;t happen in
            your attempt are dropped before you see the report.
          </p>
          <div aria-hidden className="mt-5 flex flex-wrap gap-2 font-mono text-xs">
            <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-zinc-200">solution.py v4 · lines 2–5</span>
            <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-zinc-200">Run v4 · 4/4 passed</span>
            <span className="rounded-full border border-rose-500/30 bg-rose-950/40 px-3 py-1 text-rose-200">You · t2 · 01:12</span>
          </div>
        </article>

        {/* 4. Calibrated bar */}
        <article className={`${card} md:col-span-3`}>
          <p className={tag}>04 · Calibrated bar</p>
          <h3 className="mt-2 text-xl font-bold text-zinc-50">One rubric, scored as bands</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-zinc-300">
            A fixed rubric for both rounds: correctness, complexity, testing and communication; then specificity, ownership,
            reasoning and outcome. Strong, Solid or Developing, never a made-up percentage, and anything without evidence is left out.
          </p>
          <div aria-hidden className="mt-5 grid grid-cols-3 gap-1.5">
            {["bg-[#E11D48]", "bg-[#E11D48]", "bg-[#E11D48]", "bg-amber-500", "bg-amber-500", "bg-white/10", "bg-stone-400", "bg-white/10", "bg-white/10"].map((c, i) => (
              <span key={i} className={`h-2 rounded-full ${c}`} />
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
