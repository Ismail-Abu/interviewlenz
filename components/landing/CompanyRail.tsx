import { COMPANIES } from "./companyLogos";

export function CompanyRail() {
  return (
    <section aria-label="Practice in the style of" className="w-full">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-4 mb-4">
          <div>
            <h2 className="text-xl sm:text-[22px] font-bold text-ink font-brand tracking-tight">
              Practice in the style of
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              Logos identify the company style you practice for. Not affiliated with or endorsed by these companies.
            </p>
          </div>
          <a
            href="#practice-modes"
            className="shrink-0 text-sm font-semibold text-maroon-deep hover:underline transition-colors self-start sm:self-auto"
          >
            Browse all →
          </a>
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl overflow-hidden px-4 sm:px-6">
        {/* Left edge gradient fade */}
        <div
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-r from-cream to-transparent pointer-events-none z-10"
        />

        {/* Right edge gradient fade */}
        <div
          aria-hidden="true"
          className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-l from-cream to-transparent pointer-events-none z-10"
        />

        {/* Native scrollable region */}
        <div
          role="region"
          aria-label="Company styles, scrollable"
          tabIndex={0}
          className="overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-4 -my-4 px-1 rounded-[26px]"
        >
          <ul role="list" className="flex items-center gap-4 w-max">
            {COMPANIES.map((company) => (
              <li
                key={company.name}
                className="flex flex-col items-center justify-center rounded-[24px] bg-white shadow-warm w-[128px] sm:w-[156px] h-[104px] sm:h-[114px] p-3 sm:p-4 shrink-0 snap-start select-none"
              >
                <div className="flex items-center justify-center h-10 sm:h-11 w-full mb-1 sm:mb-2">
                  {company.logo}
                </div>
                <span className="text-xs sm:text-[13px] font-medium text-ink-muted">
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
