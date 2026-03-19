"use client";

import { useState } from "react";
import Link from "next/link";
import { CatEntryForm } from "@/components/app-pages/shared/cat-entry-form";
import { FiltersDialog, SortByDialog } from "@/components/app-pages/shared/dialogs";
import { ImagePlaceholderIcon, PlusCircleIcon } from "@/components/app-pages/shared/icons";

const CAT_DATA = [
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

export function DatabaseListScreen() {
  const [showAdd, setShowAdd] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-3 px-4 py-4">
        {/* Search + Filter + Sort */}
        <div className="flex gap-2">
          <div className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400">
            Search
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700"
          >
            Filters
          </button>
          <button
            type="button"
            onClick={() => setShowSort(true)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700"
          >
            Sort By
          </button>
        </div>

        {/* Cat entries */}
        <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
          {CAT_DATA.map((cat, i) => (
            <Link key={cat.id} href="/database/general" className="block">
              <div className="flex items-start gap-3 p-3 pb-2">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200">
                  <ImagePlaceholderIcon className="h-6 w-6 text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900">{cat.name}</span>
                    {cat.sex === "male" && (
                      <span className="text-sm font-medium text-blue-500">&#9794;</span>
                    )}
                    <span className="ml-auto text-xs tracking-widest text-slate-400">&bull;&bull;&bull;</span>
                  </div>
                  <p className="text-xs text-slate-500">{cat.breed}</p>
                  <p className="text-xs text-slate-500">{cat.age}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {cat.location} - {cat.date}
                  </p>
                </div>
              </div>
              {i < CAT_DATA.length - 1 && <div className="mx-3 border-b border-slate-200" />}
            </Link>
          ))}
        </div>
      </div>

      {/* Add Entry button */}
      <div className="flex justify-end px-4 pb-5">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-full bg-stone-600 px-5 py-2.5 text-sm font-semibold text-white shadow"
        >
          Add Entry
          <PlusCircleIcon className="h-4 w-4" />
        </button>
      </div>

      {showAdd && <CatEntryForm onClose={() => setShowAdd(false)} />}
      <FiltersDialog open={showFilters} onClose={() => setShowFilters(false)} />
      <SortByDialog open={showSort} onClose={() => setShowSort(false)} />
    </div>
  );
}
