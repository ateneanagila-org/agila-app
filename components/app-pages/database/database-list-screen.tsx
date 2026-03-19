"use client";

import { useState } from "react";
import Link from "next/link";

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

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function PlusCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <path strokeLinecap="round" strokeWidth="2" d="M12 8v8M8 12h8" />
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

export function DatabaseListScreen() {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col">
      <div className="flex-1 space-y-3 px-4 py-4">
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

        {/* Cat entries */}
        <div className="overflow-hidden rounded-lg bg-white">
          {CAT_DATA.map((cat, i) => (
            <Link key={cat.id} href="/database/general" className="block">
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
                      <span className="text-sm font-medium text-blue-500">
                        ♂
                      </span>
                    )}
                    <span className="ml-auto text-xs tracking-widest text-slate-400">
                      •••
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{cat.breed}</p>
                  <p className="text-xs text-slate-500">{cat.age}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {cat.location} - {cat.date}
                  </p>
                </div>
              </div>
              {i < CAT_DATA.length - 1 && (
                <div className="mx-3 border-b border-slate-200" />
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Add Entry button */}
      <div className="flex justify-end px-4 pb-5">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-full bg-stone-600 px-5 py-2.5 text-sm font-semibold text-white shadow"
        >
          Add Entry
          <PlusCircleIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Add Entry Dialog */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setShowAdd(false)}
        >
          <div
            className="w-full max-w-7xl space-y-4 rounded-t-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Add New Entry
              </h2>
              <button
                onClick={() => setShowAdd(false)}
                className="text-xl text-slate-400"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500">
                  Cat Name
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-400"
                  placeholder="Enter cat name"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">
                  Breed / Color
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-400"
                  placeholder="e.g. Orange Tabby"
                />
              </div>
            </div>
            <button className="w-full rounded-full bg-stone-600 py-3 text-sm font-semibold text-white">
              Create Entry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
