export default function SessionsLoading() {
  return (
    <div className="flex flex-1 flex-col p-4 tablet:p-8">
      {/* Header */}
      <div className="mb-5 flex items-end justify-between">
        <div className="h-8 w-28 animate-pulse rounded-lg bg-stone-200" />
        <div className="flex gap-2">
          <div className="h-9 w-28 animate-pulse rounded-full bg-stone-200" />
          <div className="h-9 w-28 animate-pulse rounded-full bg-stone-200" />
        </div>
      </div>
      {/* Table card */}
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-brand-dark/8">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_8rem_1fr_9rem] gap-3 border-b border-brand-dark/8 px-5 py-3">
          {["", "", "", ""].map((_, i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-stone-200" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_8rem_1fr_9rem] items-center gap-3 border-b border-brand-dark/8 px-5 py-4 last:border-0"
          >
            <div className="h-4 w-12 animate-pulse rounded bg-stone-200" />
            <div className="h-4 w-20 animate-pulse rounded bg-stone-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-stone-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
