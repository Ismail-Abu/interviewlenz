// Placeholders sized like the content they stand in for, so nothing jumps
// when the real content arrives.

const bar = "animate-pulse rounded bg-zinc-800";

export function EditorSkeleton() {
  const widths = ["w-2/5", "w-3/5", "w-1/2", "w-2/3", "w-1/3"];
  return (
    <div className="flex h-full flex-col gap-3 bg-[#1e1e1e] px-6 py-4" aria-label="Loading editor" role="status">
      {widths.map((w, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-4 w-4 rounded bg-zinc-800/60" />
          <div className={`h-4 ${w} ${bar}`} />
        </div>
      ))}
    </div>
  );
}

export function CaseSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-3" aria-label="Running tests" role="status">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className={`h-6 w-20 ${bar}`} />
            <div className={`h-4 w-8 ${bar}`} />
          </div>
          <div className={`mb-2 h-4 w-2/3 ${bar}`} />
          <div className={`h-4 w-1/3 ${bar}`} />
        </li>
      ))}
    </ul>
  );
}

export function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-label="Writing your report" role="status">
      <div className="h-24 animate-pulse rounded-lg border border-sky-500/20 bg-sky-500/5" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-3 flex gap-2">
            <div className={`h-5 w-32 ${bar}`} />
            <div className={`h-5 w-20 ${bar}`} />
          </div>
          <div className={`mb-2 h-4 w-full ${bar}`} />
          <div className={`mb-4 h-4 w-3/4 ${bar}`} />
          <div className={`h-7 w-36 ${bar}`} />
        </div>
      ))}
    </div>
  );
}
