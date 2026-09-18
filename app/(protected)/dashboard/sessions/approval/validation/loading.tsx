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

export default function ValidationLoading() {
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

          {/* Discard / Approve Instantly */}
          <div className="flex gap-2">
            <Bone className="h-10 flex-1 rounded-full" />
            <Bone className="h-10 flex-1 rounded-full" />
          </div>

          <div className="h-px bg-pink-200" />

          <Bone className="h-5 w-32 rounded-lg" />

          <div className="space-y-3">
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
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

        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4">
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
      </div>
    </>
  );
}
