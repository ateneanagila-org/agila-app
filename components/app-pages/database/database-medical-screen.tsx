"use client";

import { useState } from "react";
import {
  DetailHeader,
  TopTabs,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import {
  ChevronDownIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";

const FILTER_CHIPS = [
  "Include +",
  "Filter 1 Sample",
  "Filter 2 Sample",
  "Exclude -",
  "Filter 1 Sample",
  "Filter 2 Sample",
];

function DateInputRow() {
  return (
    <div className="mt-1 grid grid-cols-3 gap-2">
      <div className="flex h-8 items-center justify-between rounded-md border border-lime-300 bg-white px-3 text-sm text-slate-500">
        <span>MM</span>
        <ChevronDownIcon className="h-3.5 w-3.5" />
      </div>
      <div className="flex h-8 items-center justify-between rounded-md border border-lime-300 bg-white px-3 text-sm text-slate-500">
        <span>DD</span>
        <ChevronDownIcon className="h-3.5 w-3.5" />
      </div>
      <div className="flex h-8 items-center justify-between rounded-md border border-lime-300 bg-white px-3 text-sm text-slate-500">
        <span>YYYY</span>
        <ChevronDownIcon className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}

export function DatabaseMedicalScreen() {
  const [showDesktopFilters, setShowDesktopFilters] = useState(false);

  return (
    <>
      <div className="tablet:hidden">
        <PageContent>
          <DetailHeader />
          <TopTabs active="Medical" />

          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-700">Condition</label>
              <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <span className="text-sm text-slate-400">Value</span>
                <ChevronDownIcon className="h-4 w-4 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-700">Neuter Date</label>
              <DateInputRow />
            </div>

            <div>
              <label className="text-sm text-slate-700">Vaccination Date</label>
              <DateInputRow />
            </div>
          </div>
        </PageContent>
      </div>

      <div className="hidden min-h-full w-full bg-slate-100 p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Database</h1>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full bg-lime-300 px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-lime-400"
          >
            Add entry
            <span className="text-lg leading-none">+</span>
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-slate-100">
          <div className="flex items-center gap-2">
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
              onClick={() => setShowDesktopFilters((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
            >
              Filter
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              className="flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
            >
              Sort by
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {showDesktopFilters && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FILTER_CHIPS.map((chip, index) => (
                <span
                  key={`${chip}-${index}`}
                  className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-600"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>

        <section className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-slate-100">
          <div className="flex gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200">
              <span className="text-2xl text-slate-400">&#9635;</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Cat Name</h2>
                <span className="text-xl text-blue-500">&#9794;</span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Intervention", "Color", "Size/Age"].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <p className="mt-3 text-sm text-slate-600">
                Last seen: Arete &middot; 02/21/26
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <TopTabs active="Medical" />
            <div className="ml-4 flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              <span>Adoptable</span>
              <span className="relative inline-flex h-4 w-7 items-center rounded-full bg-slate-300">
                <span className="inline-block h-3 w-3 translate-x-3.5 rounded-full bg-slate-800" />
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Condition</label>
              <input className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200" />
            </div>
            <div />

            <div>
              <label className="text-xs font-medium text-slate-600">Neuter Date</label>
              <DateInputRow />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Vaccination Date</label>
              <DateInputRow />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-200"
            >
              Save <span className="ml-1">&#10003;</span>
            </button>
            <button
              type="button"
              className="rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-200"
            >
              Cancel <span className="ml-1">&#10005;</span>
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
