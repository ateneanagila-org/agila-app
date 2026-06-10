function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-full bg-stone-200 ${className}`} />;
}

/** Card whose fill matches the green hero/stat cards, but neutralized for loading. */
function StatCardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-stone-200/70">
      <div className="grid grid-cols-2 divide-x divide-white/40 px-0">
        <div className="space-y-2 px-4 py-3.5">
          <div className="h-2.5 w-16 animate-pulse rounded-full bg-white/70" />
          <div className="h-7 w-12 animate-pulse rounded bg-white/70" />
        </div>
        <div className="space-y-2 px-4 py-3.5">
          <div className="h-2.5 w-16 animate-pulse rounded-full bg-white/70" />
          <div className="h-7 w-12 animate-pulse rounded bg-white/70" />
        </div>
      </div>
      <div className="divide-y divide-white/40 border-t border-white/40">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5">
            <div className="h-3 w-24 animate-pulse rounded-full bg-white/70" />
            <div className="h-3 w-8 animate-pulse rounded-full bg-white/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TnvrLoading() {
  return (
    <>
      {/* ── Mobile ── */}
      <div className="tablet:hidden">
        <div className="mx-auto w-full max-w-7xl space-y-3 px-4 py-5 mobile:px-5">
          {/* Date + title */}
          <div className="space-y-1.5">
            <Bone className="h-2.5 w-24" />
            <Bone className="h-7 w-20 rounded-lg" />
          </div>

          {/* Location pill */}
          <Bone className="h-10 w-full rounded-xl" />

          {/* Pie chart card */}
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-border">
            <div className="px-4 py-3">
              <Bone className="h-3 w-40" />
            </div>
            <div className="flex h-72 items-center justify-center px-3 pb-4">
              <Bone className="h-44 w-44 rounded-full" />
            </div>
          </div>

          {/* Hero stat card */}
          <StatCardSkeleton rows={5} />
        </div>
      </div>

      {/* ── Desktop ── */}
      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-8">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between gap-5">
          <div className="space-y-2">
            <Bone className="h-9 w-28 rounded-lg" />
            <Bone className="h-3 w-32" />
          </div>
          <Bone className="h-12 w-full max-w-72 rounded-xl" />
        </div>

        {/* Hero TNVR score — 4 cols */}
        <div className="mb-4 grid grid-cols-4 gap-px overflow-hidden rounded-2xl bg-stone-200/70">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 px-5 py-4">
              <div className="h-2.5 w-20 animate-pulse rounded-full bg-white/70" />
              <div className="h-9 w-14 animate-pulse rounded bg-white/70" />
            </div>
          ))}
        </div>

        {/* Chart card */}
        <div className="rounded-2xl bg-white p-5 ring-1 ring-border">
          <Bone className="mb-3 h-5 w-44 rounded-lg" />
          <div className="flex h-80 items-center justify-center">
            <Bone className="h-60 w-60 rounded-full" />
          </div>
        </div>

        {/* Sex breakdown — 4 cols */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} rows={2} />
          ))}
        </div>
      </div>
    </>
  );
}
