function Bone({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-full bg-stone-200 ${className}`} />
  );
}

/**
 * The form card's placeholder, sized to the card the tab bodies render. Shared
 * by the three tab loading boundaries so a switch swaps one card for another of
 * the same shape rather than collapsing the page height.
 */
export function TabBodySkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-brand-dark/8 tablet:p-6">
      <div className="grid grid-cols-1 gap-5 tablet:grid-cols-2 tablet:gap-x-6">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <Bone className="h-3 w-20" />
            <Bone className="h-11 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
