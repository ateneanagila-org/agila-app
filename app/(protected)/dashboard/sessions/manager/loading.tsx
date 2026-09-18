function Bone({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-full bg-stone-200 ${className}`} />
  );
}

function ReviewCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-brand-green/20">
      <div className="flex items-stretch gap-0">
        <div className="h-28 w-28 shrink-0 animate-pulse bg-stone-200" />
        <div className="flex min-w-0 flex-1 flex-col justify-between px-3.5 py-3">
          <div className="space-y-2">
            <Bone className="h-5 w-32 rounded-lg" />
            <Bone className="h-3 w-24" />
            <Bone className="h-4 w-20" />
          </div>
          <Bone className="h-3 w-36" />
        </div>
      </div>
    </div>
  );
}

function ReviewRowSkeleton() {
  return (
    <div className="rounded-2xl bg-brand-green/20 p-4">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-stone-200" />
        <div className="flex-1 space-y-2">
          <Bone className="h-5 w-40 rounded-lg" />
          <div className="flex gap-1.5">
            <Bone className="h-4 w-16" />
            <Bone className="h-4 w-12" />
            <Bone className="h-4 w-20" />
          </div>
          <Bone className="h-3 w-52" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Bone className="h-8 w-24 rounded-full" />
          <Bone className="h-8 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function SessionsManagerLoading() {
  return (
    <>
      {/* ── Mobile ── */}
      <div className="flex flex-1 flex-col tablet:hidden">
        <div className="flex-1 space-y-3 px-4 py-4">
          <div className="flex gap-2">
            <Bone className="h-10 flex-1 rounded-full" />
            <Bone className="h-10 flex-1 rounded-full" />
          </div>

          <div className="flex items-center gap-2">
            <Bone className="h-7 w-32 rounded-lg" />
            <Bone className="h-5 w-20" />
          </div>

          <div className="space-y-2">
            <ReviewCardSkeleton />
            <ReviewCardSkeleton />
            <ReviewCardSkeleton />
          </div>
        </div>
      </div>

      {/* ── Desktop ── */}
      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <Bone className="h-7 w-40 rounded-lg" />
          <div className="flex items-center gap-2">
            <Bone className="h-8 w-32 rounded-full" />
            <Bone className="h-8 w-32 rounded-full" />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <ReviewRowSkeleton />
          <ReviewRowSkeleton />
          <ReviewRowSkeleton />
        </div>
      </div>
    </>
  );
}
