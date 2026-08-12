function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-full bg-stone-200 ${className}`} />;
}

function UserRowSkeleton() {
  return (
    <div className="flex items-center justify-between overflow-hidden rounded-2xl bg-white p-3.5 ring-1 ring-brand-dark/8">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Bone className="h-3.5 w-32" />
        <Bone className="h-2.5 w-44" />
      </div>
      <div className="ml-2 flex shrink-0 items-center gap-2">
        <Bone className="h-8 w-36 rounded-lg" />
        <Bone className="h-7 w-8 rounded-lg" />
      </div>
    </div>
  );
}

function SimpleRowSkeleton() {
  return (
    <div className="flex items-center justify-between overflow-hidden rounded-2xl bg-white p-3.5 ring-1 ring-brand-dark/8">
      <Bone className="h-3.5 w-40" />
      <Bone className="h-7 w-7 rounded-lg" />
    </div>
  );
}

/** Heading sits OUTSIDE the white boxes (admin settings style). */
function SectionSkeleton({
  headingWidth,
  withAction,
  children,
}: {
  headingWidth: string;
  withAction?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Bone className={`h-4 ${headingWidth}`} />
        {withAction ? <Bone className="h-7 w-24" /> : null}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function AdminSkeletonBody() {
  return (
    <div className="space-y-6">
      {/* Users & Access */}
      <SectionSkeleton headingWidth="w-32" withAction>
        {/* Search / filter / sort */}
        <div className="mb-1 flex items-center gap-2">
          <Bone className="h-10 flex-1 rounded-xl" />
          <Bone className="h-10 w-20 rounded-xl" />
          <Bone className="h-10 w-24 rounded-xl" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <UserRowSkeleton key={i} />
        ))}
      </SectionSkeleton>

      {/* GSheet Config */}
      <SectionSkeleton headingWidth="w-28">
        {Array.from({ length: 2 }).map((_, i) => (
          <SimpleRowSkeleton key={i} />
        ))}
      </SectionSkeleton>

      {/* Edit Regions */}
      <SectionSkeleton headingWidth="w-24" withAction>
        {Array.from({ length: 3 }).map((_, i) => (
          <SimpleRowSkeleton key={i} />
        ))}
      </SectionSkeleton>
    </div>
  );
}

export default function AdminLoading() {
  return (
    <>
      {/* ── Mobile ── */}
      <div className="flex flex-1 flex-col tablet:hidden">
        <div className="flex-1 px-4 py-4">
          <Bone className="mb-4 h-7 w-24 rounded-lg" />
          <AdminSkeletonBody />
        </div>
      </div>

      {/* ── Desktop ── */}
      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-8">
        <Bone className="mb-6 h-9 w-28 rounded-lg" />
        <AdminSkeletonBody />
      </div>
    </>
  );
}
