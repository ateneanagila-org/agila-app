"use client";

import { useState } from "react";
import Link from "next/link";
import { DetailHeader } from "@/components/app-pages/shared/page-frame";

function ImagePlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
      <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m21 15-5-5L5 21" />
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
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

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
        <div className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400">
          Search
        </div>
        <button
          onClick={() => setShowFilters(true)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700"
        >
          Filters
        </button>
        <button
          onClick={() => setShowSort(true)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700"
        >
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
                  <span className="text-sm font-bold text-slate-900">{cat.name}</span>
                  {cat.sex === "male" && (
                    <span className="text-sm font-medium text-blue-500">♂</span>
                  )}
                  <span className="ml-auto text-xs tracking-widest text-slate-400">•••</span>
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
            {i < SIMILAR_CATS.length - 1 && <div className="mx-3 border-b border-slate-200" />}
          </div>
        ))}
      </div>

      {/* Filters Dialog */}
      {showFilters && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
          onClick={() => setShowFilters(false)}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Filters</h2>
              <button onClick={() => setShowFilters(false)} className="text-xl leading-none text-slate-400">
                ✕
              </button>
            </div>
            <div className="h-32 rounded-lg bg-slate-100" />
            <button
              onClick={() => setShowFilters(false)}
              className="w-full rounded-full bg-stone-600 py-3 text-sm font-semibold text-white"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Sort By Dialog */}
      {showSort && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
          onClick={() => setShowSort(false)}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Sort By</h2>
              <button onClick={() => setShowSort(false)} className="text-xl leading-none text-slate-400">
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {["Ascending", "Descending"].map((opt) => (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
                >
                  <input type="radio" name="sortOrder" value={opt} className="accent-stone-600" />
                  <span className="text-sm font-medium text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => setShowSort(false)}
              className="w-full rounded-full bg-stone-600 py-3 text-sm font-semibold text-white"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
