function Bone({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-full bg-stone-200 ${className}`} />
  );
}

function FieldSkeleton() {
  return (
    <div className="space-y-1.5">
      <Bone className="h-3 w-20" />
      <Bone className="h-9 w-full rounded-lg" />
    </div>
  );
}

function TabsSkeleton() {
  return (
    <div className="flex w-full gap-8 border-b border-brand-dark/10 pb-3 tablet:inline-flex tablet:w-auto">
      <Bone className="h-4 w-16" />
      <Bone className="h-4 w-16" />
      <Bone className="h-4 w-24" />
    </div>
  );
}

/**
 * Sits at [id] rather than inside each tab because the thing being awaited is
 * the layout's cat lookup, and a boundary has to be above what suspends. It
 * also covers tab switches, which previously fell through to the full-viewport
 * spinner in (protected)/loading.tsx.
 */
export default function CatDetailLoading() {
  return (
    <>
      {/* ── Mobile ── */}
      <div className="tablet:hidden">
        <div className="space-y-4 px-4 py-5">
          <div className="flex items-center gap-3">
            <Bone className="h-8 w-8" />
            <div className="flex-1 space-y-1.5">
              <Bone className="h-6 w-40 rounded-lg" />
              <Bone className="h-3 w-28" />
            </div>
          </div>

          <TabsSkeleton />

          <div className="space-y-3">
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
        </div>
      </div>

      {/* ── Desktop ── */}
      <div className="hidden min-h-full w-full bg-brand-cream tablet:block">
        <div className="mx-auto w-full max-w-7xl space-y-5 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <Bone className="h-7 w-48 rounded-lg" />
              <Bone className="h-3 w-32" />
            </div>
            <Bone className="h-8 w-28 rounded-full" />
          </div>

          <TabsSkeleton />

          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
        </div>
      </div>
    </>
  );
}
