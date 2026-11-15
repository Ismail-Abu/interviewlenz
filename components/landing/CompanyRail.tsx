import { COMPANIES } from "./companyLogos";

export function CompanyRail() {
  return (
    <section aria-label="Practice in the style of" className="w-full">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-4 mb-4">
          <div>
            <h2 className="text-xl sm:text-[22px] font-bold text-zinc-50 font-brand tracking-tight">
              Practice in the style of
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Logos identify the company style you practice for. Not affiliated with or endorsed by these companies.
            </p>
          </div>
          <a
            href="#bento-heading"
            className="shrink-0 text-sm font-semibold text-rose-300 hover:text-rose-200 hover:underline transition-colors self-start sm:self-auto"
          >
            How it works →
          </a>
        </div>
      </div>

      {/* Bleeds into the page gutter: at rest the fades sit over empty margin and
          the first tile lines up with the heading; scrolled tiles fade at the edges. */}
      <div className="relative -mx-5 sm:-mx-8 lg:-mx-10">
        {/* Left edge gradient fade */}
        <div
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-10 sm:w-12 lg:w-16 bg-gradient-to-r from-[#09090B] to-transparent pointer-events-none z-10"
        />

        {/* Right edge gradient fade */}
        <div
          aria-hidden="true"
          className="absolute right-0 top-0 bottom-0 w-12 sm:w-16 lg:w-20 bg-gradient-to-l from-[#09090B] to-transparent pointer-events-none z-10"
        />

        {/* Native scrollable region */}
        <div
          role="region"
          aria-label="Company styles, scrollable"
          tabIndex={0}
          className="overflow-x-auto snap-x snap-mandatory scroll-px-5 sm:scroll-px-8 lg:scroll-px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-5 -my-1 rounded-[26px]"
        >
          <ul role="list" className="flex items-center gap-4 w-max px-5 sm:px-8 lg:px-10">
            {COMPANIES.map((company) => (
              <li
                key={company.name}
                className="flex flex-col items-center justify-center rounded-[20px] border border-white/[0.08] bg-zinc-900/60 backdrop-blur-xl shadow-2xl shadow-black/40 transition hover:border-white/20 hover:shadow-[0_0_24px_-8px_rgba(244,63,94,0.45)] w-[128px] sm:w-[164px] h-[104px] sm:h-[114px] p-3 sm:p-4 shrink-0 snap-start select-none"
              >
                <div className="flex items-center justify-center h-10 sm:h-11 w-full mb-1 sm:mb-2 [filter:drop-shadow(0_0_10px_rgba(255,255,255,0.14))]">
                  {company.logo}
                </div>
                <span className="text-xs sm:text-[13px] font-medium text-zinc-300">
                  {company.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
