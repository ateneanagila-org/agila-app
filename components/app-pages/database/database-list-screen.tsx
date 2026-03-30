"use client";

import { useState } from "react";
import Link from "next/link";
import { CatEntryForm } from "@/components/app-pages/shared/cat-entry-form";
import {
  FiltersDialog,
  SortByDialog,
} from "@/components/app-pages/shared/dialogs";
import {
  ChevronDownIcon,
  ImagePlaceholderIcon,
  PlusCircleIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";

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
  {
    id: "2",
    name: "Cat Name",
    sex: "male",
    breed: "Orange and White Tabby",
    age: "Adult",
    location: "Arete",
    date: "02/21/26",
  },
  {
    id: "3",
    name: "Cat Name",
    sex: "male",
    breed: "Orange and White Tabby",
    age: "Adult",
    location: "Arete",
    date: "02/21/26",
  },
  {
    id: "4",
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
    <>
      <div className="flex flex-1 flex-col tablet:hidden">
        <div className="flex-1 space-y-4 px-4 py-4">
          <div className="flex gap-2">
            <div className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400">
              Search
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Filters
            </button>
            <button
              type="button"
              onClick={() => setShowSort(true)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Sort By
            </button>
          </div>

          <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
            {CAT_DATA.map((cat, i) => (
              <Link key={cat.id} href="/database/general" className="block">
                <div className="flex items-start gap-3 px-3.5 py-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200">
                    <ImagePlaceholderIcon className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold tracking-tight text-slate-900">
                        {cat.name}
                      </span>
                      {cat.sex === "male" && (
                        <span className="text-sm text-blue-500">
                          &#9794;
                        </span>
                      )}
                      <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        Edit
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{cat.breed}</p>
                    <p className="text-xs text-slate-500">{cat.age}</p>
                    <p className="mt-1.5 text-[11px] font-medium text-slate-600">
                      {cat.location} &middot; {cat.date}
                    </p>
                  </div>
                </div>
                {i < CAT_DATA.length - 1 && (
                  <div className="mx-3.5 border-b border-slate-100" />
                )}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex justify-end px-4 pb-5">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-full bg-stone-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-stone-700"
          >
            Add Entry
            <PlusCircleIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="hidden min-h-full w-full bg-slate-100 p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Database</h1>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-full bg-lime-300 px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-lime-400"
          >
            Add entry
            <span className="text-lg leading-none">+</span>
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-100">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search"
              className="h-9 w-full rounded-full bg-slate-50 px-4 pr-10 text-sm text-slate-800 outline-none"
            />
            <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            Filter
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowSort(true)}
            className="flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            Sort by
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {CAT_DATA.map((cat) => (
            <Link
              key={`desktop-${cat.id}`}
              href="/database/general"
              className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 ring-1 ring-slate-100 transition-shadow hover:shadow-sm"
            >
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200">
                <ImagePlaceholderIcon className="h-9 w-9 text-slate-400" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">
                    {cat.name}
                  </h2>
                  {cat.sex === "male" && (
                    <span className="text-xl text-blue-500">&#9794;</span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {["Intervention", "Color", "Size/Age"].map((chip) => (
                    <span
                      key={`${cat.id}-${chip}`}
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600"
                    >
                      {chip}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Last seen: {cat.location} &middot; {cat.date}
                  </p>
                  <span className="rounded-full bg-slate-50 px-3.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-100 transition-colors hover:bg-slate-100">
                    Edit entry <span className="ml-1">&#9998;</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {showAdd && <CatEntryForm onClose={() => setShowAdd(false)} />}
      <FiltersDialog open={showFilters} onClose={() => setShowFilters(false)} />
      <SortByDialog open={showSort} onClose={() => setShowSort(false)} />
    </>
  );
}
