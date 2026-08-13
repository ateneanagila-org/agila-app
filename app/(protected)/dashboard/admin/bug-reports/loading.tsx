function Bone({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-full bg-stone-200 ${className}`} />
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-border">
      <Bone className="h-3.5 w-40" />
      <Bone className="h-2.5 w-52" />
      <Bone className="h-2.5 w-full" />
      <Bone className="h-2.5 w-3/4" />
    </div>
  );
}

export default function Loading() {
  return (
    <>
      <div className="flex flex-1 flex-col tablet:hidden">
        <div className="flex-1 px-4 py-4">
          <div className="mb-4 flex items-center justify-between">
            <Bone className="h-6 w-36" />
            <Bone className="h-8 w-20" />
          </div>
          <div className="space-y-3">
            <ReportSkeleton />
            <ReportSkeleton />
            <ReportSkeleton />
          </div>
        </div>
      </div>

      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <Bone className="h-8 w-44" />
            <Bone className="h-8 w-20" />
          </div>
          <div className="space-y-3">
            <ReportSkeleton />
            <ReportSkeleton />
            <ReportSkeleton />
          </div>
        </div>
      </div>
    </>
  );
}
