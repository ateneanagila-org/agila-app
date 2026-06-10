function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-full bg-stone-200 ${className}`} />;
}

function TableRowSkeleton({ cols }: { cols: string }) {
  return (
    <div className={`grid items-center gap-x-3 border-b border-brand-dark/8 py-3 last:border-0 ${cols}`}>
      <Bone className="h-3.5 w-10" />
      <div className="space-y-1.5">
        <Bone className="h-3 w-24" />
        <Bone className="h-2.5 w-16" />
      </div>
      <Bone className="h-6 w-16" />
      <div />
    </div>
  );
}

function LocationRowSkeleton() {
  return (
    <div className="flex items-center justify-between border-b border-brand-dark/8 py-2.5 last:border-0">
      <Bone className="h-3 w-28" />
      <Bone className="h-3 w-16" />
    </div>
  );
}

export default function SessionsLoading() {
  return (
    <>
      {/* ── Mobile ── */}
      <div className="flex flex-1 flex-col space-y-3 px-4 py-4 tablet:hidden">
        {/* Action buttons */}
        <div className="flex gap-2">
          <Bone className="h-10 flex-1 rounded-full" />
          <Bone className="h-10 flex-1 rounded-full" />
        </div>

        {/* Recent Sessions heading + Create New */}
        <div className="flex items-center justify-between">
          <Bone className="h-6 w-36 rounded-lg" />
          <Bone className="h-8 w-24" />
        </div>

        {/* Sessions card */}
        <div className="overflow-hidden rounded-2xl bg-white px-4 py-3 ring-1 ring-brand-dark/8">
          {/* Col headers */}
          <div className="grid grid-cols-[2.5rem_1fr_4.5rem_2rem] gap-x-3 border-b border-brand-dark/10 pb-2">
            <Bone className="h-2.5 w-6" />
            <Bone className="h-2.5 w-14" />
            <Bone className="h-2.5 w-10" />
            <div />
          </div>
          {[...Array(4)].map((_, i) => (
            <TableRowSkeleton key={i} cols="grid-cols-[2.5rem_1fr_4.5rem_2rem]" />
          ))}
        </div>

        {/* Priority Locations heading */}
        <Bone className="h-6 w-40 rounded-lg" />

        {/* Locations card */}
        <div className="overflow-hidden rounded-2xl bg-white px-4 py-3 ring-1 ring-brand-dark/8">
          <div className="flex justify-between border-b border-brand-dark/10 pb-2">
            <Bone className="h-2.5 w-10" />
            <Bone className="h-2.5 w-20" />
          </div>
          {[...Array(4)].map((_, i) => (
            <LocationRowSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* ── Desktop ── */}
      <div className="hidden min-h-full w-full bg-brand-cream p-8 tablet:block">
        {/* Page header */}
        <div className="flex items-end justify-between">
          <Bone className="h-9 w-32 rounded-lg" />
          <div className="flex gap-2">
            <Bone className="h-9 w-32" />
            <Bone className="h-9 w-36" />
          </div>
        </div>

        {/* Table card */}
        <div className="mt-5 overflow-hidden rounded-2xl bg-white ring-1 ring-border">
          {/* Card header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <Bone className="h-5 w-36 rounded-lg" />
            <div className="flex gap-2">
              <Bone className="h-7 w-20" />
              <Bone className="h-7 w-28" />
            </div>
          </div>
          {/* Col headers */}
          <div className="grid grid-cols-[1fr_8rem_1fr_9rem_2.5rem] gap-x-3 border-b border-border px-5 py-2.5">
            {[...Array(4)].map((_, i) => (
              <Bone key={i} className="h-2.5 w-16" />
            ))}
            <div />
          </div>
          {/* Rows */}
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_8rem_1fr_9rem_2.5rem] items-center gap-x-3 border-b border-border px-5 py-3.5 last:border-0"
            >
              <Bone className="h-3.5 w-10" />
              <Bone className="h-3.5 w-20" />
              <Bone className="h-3.5 w-28" />
              <Bone className="h-6 w-20" />
              <div />
            </div>
          ))}
        </div>

        {/* Priority Locations */}
        <Bone className="mt-7 h-6 w-44 rounded-lg" />
        <Bone className="mt-1 h-3 w-56 rounded-full" />

        <div className="mt-3 overflow-hidden rounded-2xl bg-white ring-1 ring-border">
          <div className="grid grid-cols-2 border-b border-border bg-brand-cream px-5 py-2.5">
            <Bone className="h-2.5 w-16" />
            <Bone className="h-2.5 w-32" />
          </div>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-2 border-b border-border px-5 py-3.5 last:border-0"
            >
              <Bone className="h-3.5 w-28" />
              <Bone className="h-3.5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
