export default function DatabaseLoading() {
  return (
    <div className="flex flex-1 flex-col p-4 tablet:p-8">
      {/* Header row */}
      <div className="mb-5 flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-7 w-28 animate-pulse rounded-lg bg-stone-200" />
          <div className="h-3 w-20 animate-pulse rounded bg-stone-200" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded-full bg-stone-200" />
      </div>
      {/* Card grid */}
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 tablet:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="aspect-3/4 animate-pulse rounded-2xl bg-stone-200"
          />
        ))}
      </div>
    </div>
  );
}
