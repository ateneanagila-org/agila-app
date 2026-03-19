import Link from "next/link";

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <circle cx="11" cy="11" r="7" strokeWidth="2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m21 21-4.35-4.35" />
    </svg>
  );
}

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

const CATS = [
  { id: "1", name: "Cat Name", sex: "male", color: "Color", age: "Adult" },
  { id: "2", name: "Cat Name", sex: "male", color: "Color", age: "Adult" },
  { id: "3", name: "Cat Name", sex: "male", color: "Color", age: "Adult" },
  { id: "4", name: "Cat Name", sex: "male", color: "Color", age: "Adult" },
];

export function CatalogScreen() {
  return (
    <div className="space-y-4 px-4 py-4">
      {/* Heading */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <p className="text-base font-semibold text-slate-900">
          Adopt/ Foster a cat
        </p>
        <button className="rounded-full border border-amber-200 bg-amber-50 px-6 py-1.5 text-sm font-medium text-slate-700">
          Apply
        </button>
      </div>

      {/* Search + Filter + Sort */}
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-3 py-2">
          <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="text-sm text-slate-400">Search</span>
        </div>
        <button className="rounded-full border border-amber-100 bg-amber-50 px-4 py-2 text-xs font-medium text-slate-700">
          Filters
        </button>
        <button className="rounded-full border border-amber-100 bg-amber-50 px-4 py-2 text-xs font-medium text-slate-700">
          Sort By
        </button>
      </div>

      {/* Cat cards */}
      <div className="space-y-3">
        {CATS.map((cat) => (
          <Link key={cat.id} href={`/catalog/${cat.id}`} className="block">
            <div className="flex items-center gap-3 overflow-hidden rounded-2xl bg-amber-50">
              {/* Photo */}
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-slate-200">
                <ImagePlaceholderIcon className="h-10 w-10 text-slate-400" />
              </div>
              {/* Info */}
              <div className="py-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold text-slate-900">
                    {cat.name}
                  </span>
                  {cat.sex === "male" && (
                    <span className="text-base font-medium text-blue-500">♂</span>
                  )}
                </div>
                <p className="text-sm text-slate-600">{cat.color}</p>
                <p className="text-sm text-slate-600">{cat.age}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
