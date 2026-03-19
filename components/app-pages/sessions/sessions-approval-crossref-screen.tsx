import Link from "next/link";
import { DetailHeader } from "@/components/app-pages/shared/page-frame";

function ImagePlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
      <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="m21 15-5-5L5 21"
      />
    </svg>
  );
}

const SIMILAR_CATS = [
  {
    id: "1",
    name: "Cat Name",
    sex: "male",
    breed: "Orange and White Tabby",
    age: "Adult",
    location: "Arete",
    date: "02/21/26",
  },
];

export function SessionsApprovalCrossRefScreen() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4">
      <DetailHeader backHref="/sessions/approval/validation" />

      {/* Action buttons */}
      <div className="flex gap-2">
        <button className="rounded-full bg-stone-600 px-4 py-2 text-xs font-semibold text-white">
          Approve Instantly
        </button>
        <button className="rounded-full bg-stone-600 px-4 py-2 text-xs font-semibold text-white">
          Discard
        </button>
      </div>

      {/* Heading + Prev */}
      <div className="flex items-center justify-between">
        <p className="text-base font-bold text-slate-900">Cross-reference</p>
        <Link
          href="/sessions/approval/validation"
          className="flex items-center gap-0.5 text-sm text-slate-600"
        >
          <span className="text-base leading-none">‹</span> Prev
        </Link>
      </div>

      <p className="text-xs text-slate-500">
        Check if this is a duplicate and merge accordingly.
      </p>

      {/* Search + Filter + Sort */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-full border border-amber-100 bg-amber-50 px-4 py-2.5 text-sm text-slate-400">
          Search
        </div>
        <button className="rounded-full border border-amber-100 bg-amber-50 px-4 py-2.5 text-xs font-medium text-slate-700">
          Filters
        </button>
        <button className="rounded-full border border-amber-100 bg-amber-50 px-4 py-2.5 text-xs font-medium text-slate-700">
          Sort By
        </button>
      </div>

      {/* Similar cats list */}
      <div className="overflow-hidden rounded-lg bg-white">
        {SIMILAR_CATS.map((cat, i) => (
          <div key={cat.id}>
            <div className="flex items-start gap-3 p-3 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200">
                <ImagePlaceholderIcon className="h-6 w-6 text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-900">
                    {cat.name}
                  </span>
                  {cat.sex === "male" && (
                    <span className="text-sm font-medium text-blue-500">♂</span>
                  )}
                  <span className="ml-auto text-xs tracking-widest text-slate-400">
                    •••
                  </span>
                </div>
                <p className="text-xs text-slate-500">{cat.breed}</p>
                <p className="text-xs text-slate-500">{cat.age}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-slate-600">
                    {cat.location} - {cat.date}
                  </p>
                  <button className="rounded-full bg-stone-600 px-3 py-1 text-xs font-semibold text-white">
                    Merge
                  </button>
                </div>
              </div>
            </div>
            {i < SIMILAR_CATS.length - 1 && (
              <div className="mx-3 border-b border-slate-200" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
