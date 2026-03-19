"use client";

import { useState } from "react";
import Link from "next/link";
import { DetailHeader } from "@/components/app-pages/shared/page-frame";
import { FiltersDialog, SortByDialog } from "@/components/app-pages/shared/dialogs";
import { ImagePlaceholderIcon } from "@/components/app-pages/shared/icons";
import { PageContent } from "@/components/app-pages/shared/page-frame";

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
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  return (
    <PageContent>
      <DetailHeader backHref="/sessions/approval/validation" />

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-full bg-stone-600 px-4 py-2 text-xs font-semibold text-white"
        >
          Approve Instantly
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
        >
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
          <span className="text-base leading-none">&lsaquo;</span> Prev
        </Link>
      </div>

      <p className="text-xs text-slate-500">
        Check if this is a duplicate and merge accordingly.
      </p>

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

      {/* Similar cats list */}
      <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
        {SIMILAR_CATS.map((cat, i) => (
          <div key={cat.id}>
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
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-slate-600">
                    {cat.location} - {cat.date}
                  </p>
                  <button
                    type="button"
                    className="rounded-full bg-stone-600 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Merge
                  </button>
                </div>
              </div>
            </div>
            {i < SIMILAR_CATS.length - 1 && <div className="mx-3 border-b border-slate-200" />}
          </div>
        ))}
      </div>

      <FiltersDialog open={showFilters} onClose={() => setShowFilters(false)} />
      <SortByDialog open={showSort} onClose={() => setShowSort(false)} />
    </PageContent>
  );
}
