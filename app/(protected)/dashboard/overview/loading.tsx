export default function OverviewLoading() {
  return (
    <div className="flex flex-1 flex-col p-4 tablet:p-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl bg-stone-200"
          />
        ))}
      </div>
      {/* Chart block */}
      <div className="mt-5 h-64 animate-pulse rounded-2xl bg-stone-200" />
      <div className="mt-3 h-48 animate-pulse rounded-2xl bg-stone-200" />
    </div>
  );
}
