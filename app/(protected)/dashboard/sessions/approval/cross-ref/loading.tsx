function Bone({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-full bg-stone-200 ${className}`} />
  );
}

/** Mirrors MergeListSkeleton in the cross-ref screen, so the loading boundary
 *  and the screen's own list placeholder look like the same thing. */
function MergeCardSkeleton() {
  return <div className="h-36 animate-pulse rounded-2xl bg-stone-200" />;
}

export default function CrossRefLoading() {
  return (
    <>
      {/* ── Mobile ── */}
      <div className="tablet:hidden">
        <div className="space-y-3 px-4 py-4">
          {/* DetailHeader */}
          <div className="flex items-center gap-3">
            <Bone className="h-8 w-8" />
            <div className="flex-1 space-y-1.5">
              <Bone className="h-6 w-40 rounded-lg" />
              <Bone className="h-3 w-28" />
            </div>
          </div>

          <div className="flex gap-2">
            <Bone className="h-10 flex-1 rounded-full" />
            <Bone className="h-10 flex-1 rounded-full" />
          </div>

          <div className="h-px bg-pink-200" />

          {/* Filter toolbar */}
          <div className="flex items-center gap-2">
            <Bone className="h-9 flex-1 rounded-full" />
            <Bone className="h-9 w-9" />
            <Bone className="h-9 w-9" />
          </div>

          <div className="space-y-2">
            <MergeCardSkeleton />
            <MergeCardSkeleton />
            <MergeCardSkeleton />
          </div>
        </div>
      </div>

      {/* ── Desktop ── */}
      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Bone className="h-7 w-48 rounded-lg" />
            <Bone className="h-3 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Bone className="h-8 w-28 rounded-full" />
            <Bone className="h-8 w-28 rounded-full" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Bone className="h-9 w-72 rounded-full" />
          <Bone className="h-9 w-24 rounded-full" />
          <Bone className="h-9 w-24 rounded-full" />
        </div>

        <div className="mt-4 space-y-3">
          <MergeCardSkeleton />
          <MergeCardSkeleton />
          <MergeCardSkeleton />
        </div>
      </div>
    </>
  );
}
