import { TabBodySkeleton } from "@/components/app-pages/database/tab-body-skeleton";

function Bone({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-full bg-stone-200 ${className}`} />
  );
}

/**
 * Entry into a cat, i.e. what shows while the [id] layout resolves the cat. It
 * renders its own container because the layout — and so PageContent — has not
 * rendered yet.
 *
 * Switching tabs does NOT land here: each tab has its own boundary below the
 * layout, so the identity card and tabs stay on screen.
 */
export default function CatDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 xs:px-4 mobile:px-5 tablet:space-y-5 tablet:px-8 tablet:py-6">
      {/* DetailHeader */}
      <div className="flex items-center gap-3">
        <Bone className="h-8 w-8" />
        <div className="flex-1 space-y-1.5">
          <Bone className="h-6 w-40 rounded-lg" />
          <Bone className="h-3 w-28" />
        </div>
      </div>

      {/* Identity card */}
      <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-brand-dark/8">
        <div className="flex flex-col gap-5 p-5 tablet:flex-row tablet:items-center tablet:gap-6 tablet:p-6">
          <div className="h-32 w-32 shrink-0 animate-pulse self-center rounded-2xl bg-stone-200 tablet:h-28 tablet:w-28 tablet:self-auto" />
          <div className="min-w-0 flex-1 space-y-3">
            <Bone className="h-7 w-48 rounded-lg" />
            <div className="flex gap-1.5">
              <Bone className="h-6 w-16" />
              <Bone className="h-6 w-14" />
            </div>
            <Bone className="h-3 w-56" />
          </div>
        </div>

        <div className="border-t border-brand-dark/8 px-5 pt-2 tablet:px-6">
          <div className="flex gap-8 pb-3">
            <Bone className="h-4 w-16" />
            <Bone className="h-4 w-16" />
            <Bone className="h-4 w-24" />
          </div>
        </div>
      </div>

      <TabBodySkeleton rows={8} />
    </div>
  );
}
