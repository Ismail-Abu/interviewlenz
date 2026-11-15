export function LiveDemoPanel() {
  return (
    <div
      role="img"
      aria-label="Example: the interviewer asks a follow-up about the code you just ran"
      className="w-full rounded-[26px] border border-white/[0.08] bg-[#0C0D12]/90 p-5 sm:p-7 md:p-8 shadow-[0_0_60px_-20px_rgba(200,16,46,0.45)] backdrop-blur-xl"
    >
      <div aria-hidden="true" className="flex flex-col gap-5 sm:gap-6">
        {/* Mock editor card */}
        <div className="overflow-hidden rounded-[22px] sm:rounded-[24px] bg-[#141211]">
          {/* Title bar */}
          <div className="flex items-center justify-between bg-panel-2 px-4 py-3 sm:px-5 sm:py-3.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs sm:text-[13px] text-[#9A8C84]">
                solution.py · v4
              </span>
              <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-[#C7BDB7]">
                example
              </span>
            </div>
            <span className="inline-flex items-center rounded-full bg-maroon px-3 py-1 text-[11px] font-semibold text-white select-none">
              ▶ Run
            </span>
          </div>

          {/* Code body & pass pill */}
          <div className="p-4 sm:p-5">
            <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <pre className="font-mono text-xs sm:text-[13px] leading-relaxed select-text">
                <code>
                  <div>
                    <span className="inline-block w-4 sm:w-5 mr-3 text-right text-[#5E534E] select-none">1</span>
                    <span style={{ color: "#D79BD0" }}>def</span> <span style={{ color: "#E8D08A" }}>contains_duplicate</span><span style={{ color: "#D9D2CE" }}>(nums):</span>
                  </div>
                  <div>
                    <span className="inline-block w-4 sm:w-5 mr-3 text-right text-[#5E534E] select-none">2</span>
                    <span style={{ color: "#D9D2CE" }}>    seen = </span><span style={{ color: "#7FD3C4" }}>set</span><span style={{ color: "#D9D2CE" }}>()</span>
                  </div>
                  <div>
                    <span className="inline-block w-4 sm:w-5 mr-3 text-right text-[#5E534E] select-none">3</span>
                    <span style={{ color: "#D79BD0" }}>    for</span> <span style={{ color: "#D9D2CE" }}>n </span><span style={{ color: "#D79BD0" }}>in</span> <span style={{ color: "#D9D2CE" }}>nums:</span>
                  </div>
                  <div>
                    <span className="inline-block w-4 sm:w-5 mr-3 text-right text-[#5E534E] select-none">4</span>
                    <span style={{ color: "#D79BD0" }}>        if</span> <span style={{ color: "#D9D2CE" }}>n </span><span style={{ color: "#D79BD0" }}>in</span> <span style={{ color: "#D9D2CE" }}>seen:</span>
                  </div>
                  <div>
                    <span className="inline-block w-4 sm:w-5 mr-3 text-right text-[#5E534E] select-none">5</span>
                    <span style={{ color: "#D79BD0" }}>            return</span> <span style={{ color: "#7FB2E5" }}>True</span>
                  </div>
                  <div>
                    <span className="inline-block w-4 sm:w-5 mr-3 text-right text-[#5E534E] select-none">6</span>
                    <span style={{ color: "#D9D2CE" }}>        seen.add(n)</span>
                  </div>
                  <div>
                    <span className="inline-block w-4 sm:w-5 mr-3 text-right text-[#5E534E] select-none">7</span>
                    <span style={{ color: "#D79BD0" }}>    return</span> <span style={{ color: "#7FB2E5" }}>False</span>
                  </div>
                </code>
              </pre>
            </div>

            {/* Bottom-right pass pill & runtime */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-[#8A7C74]">runtime · 14 ms (example)</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1B3A28] px-3.5 py-1 text-xs font-bold text-[#6EE7A0] select-none">
                <span>v4</span>
                <span>·</span>
                <span>4 / 4 passed</span>
              </span>
            </div>
          </div>
        </div>

        {/* Transcript header */}
        <div className="flex items-center justify-between text-[11px] font-bold tracking-[0.16em] text-[#8A7C74]">
          <span className="flex items-center gap-1.5">
            <span>TRANSCRIPT</span>
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9.5px] font-semibold tracking-normal text-[#A89C94]">
              example
            </span>
          </span>
          <div className="flex items-center gap-2 text-xs font-normal tracking-normal text-[#8A7C74]">
            <span>listening</span>
            <span className="inline-block h-2 w-2 rounded-full bg-[#6EE7A0]" />
          </div>
        </div>

        {/* Speech bubbles */}
        <div className="flex flex-col gap-3">
          {/* Bubble 1: Interviewer */}
          <div className="bubble-1 w-fit max-w-[85%] sm:max-w-[75%] rounded-[22px] bg-maroon p-4 sm:p-5 text-[#FFF4F6]">
            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#F2C9D2]">
              INTERVIEWER
            </p>
            <p className="text-sm leading-snug sm:text-[14px]">
              You used a hash set here to pass all test cases. What&apos;s the space cost of this approach?
            </p>
          </div>

          {/* Bubble 2: You */}
          <div className="bubble-2 ml-auto w-fit max-w-[85%] sm:max-w-[75%] rounded-[22px] bg-panel-2 p-4 sm:p-5 text-[#DED7D3]">
            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#9A8C84]">
              YOU
            </p>
            <p className="text-sm leading-snug sm:text-[14px]">
              It&apos;s O(n) space in the worst case because we store each distinct number in the set.
            </p>
          </div>

          {/* Bubble 3: Interviewer */}
          <div className="bubble-3 w-fit max-w-[85%] sm:max-w-[75%] rounded-[22px] bg-maroon p-4 sm:p-5 text-[#FFF4F6]">
            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#F2C9D2]">
              INTERVIEWER
            </p>
            <p className="text-sm leading-snug sm:text-[14px]">
              Right. Could we achieve O(1) auxiliary space if the input array can be sorted in place?
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bubbleFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .bubble-1 { animation: bubbleFadeIn 0.4s ease-out 0.1s both; }
          .bubble-2 { animation: bubbleFadeIn 0.4s ease-out 0.25s both; }
          .bubble-3 { animation: bubbleFadeIn 0.4s ease-out 0.4s both; }
        }
      `}</style>
    </div>
  );
}
