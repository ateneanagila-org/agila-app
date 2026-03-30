import Link from "next/link";
import { SearchIcon, ImagePlaceholderIcon } from "@/components/app-pages/shared/icons";

const CATS = [
  { id: "1", name: "Cat Name", sex: "male", color: "Color", age: "Adult" },
  { id: "2", name: "Cat Name", sex: "male", color: "Color", age: "Adult" },
  { id: "3", name: "Cat Name", sex: "male", color: "Color", age: "Adult" },
  { id: "4", name: "Cat Name", sex: "male", color: "Color", age: "Adult" },
];

export function CatalogScreen() {
  return (
    <div className="space-y-4 px-4 py-5">
      {/* Heading */}
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold tracking-tight text-slate-900">
          Adopt / Foster
        </p>
        <button
          type="button"
          className="rounded-full bg-lime-300 px-5 py-1.5 text-sm font-medium text-slate-800 transition-colors hover:bg-lime-400"
        >
          Apply
        </button>
      </div>

      {/* Search + Filter + Sort */}
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2.5">
          <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="text-sm text-slate-400">Search</span>
        </div>
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Filters
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Sort By
        </button>
      </div>

      {/* Cat cards */}
      <div className="space-y-3">
        {CATS.map((cat) => (
          <Link key={cat.id} href={`/catalog/${cat.id}`} className="block">
            <div className="flex items-center gap-3 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 transition-shadow hover:shadow-sm">
              {/* Photo */}
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                <ImagePlaceholderIcon className="h-9 w-9 text-slate-400" />
              </div>
              {/* Info */}
              <div className="py-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold tracking-tight text-slate-900">
                    {cat.name}
                  </span>
                  {cat.sex === "male" && (
                    <span className="text-sm text-blue-500">&#9794;</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{cat.color}</p>
                <p className="text-xs text-slate-500">{cat.age}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
