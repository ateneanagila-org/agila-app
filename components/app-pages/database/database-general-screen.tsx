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

function DropdownField({ label }: { label: string }) {
  return (
    <div>
      <label className="text-xs text-slate-700">{label}</label>
      <div className="mt-1 flex h-8 items-center justify-between rounded-md border border-lime-300 bg-white px-3">
        <span className="text-sm text-slate-500">&nbsp;</span>
        <ChevronDownIcon className="h-3.5 w-3.5 text-slate-500" />
      </div>
    </div>
  );
}

export function DatabaseGeneralScreen() {
  const [showDesktopFilters, setShowDesktopFilters] = useState(false);

  return (
    <>
      <div className="tablet:hidden">
        <PageContent>
          <DetailHeader />
          <TopTabs active="General" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">
                Adoptable/Fosterable
              </span>
              <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-800">
                <span className="inline-block h-4 w-4 translate-x-6 transform rounded-full bg-white transition" />
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-600">Last seen at:</p>
              <p className="text-sm font-semibold text-slate-900">
                Date / Region / Spot
              </p>
            </div>

            <DropdownField label="Color" />
            <DropdownField label="Size/Age" />
            <DropdownField label="Sex" />
            <DropdownField label="Sociability" />
            <DropdownField label="Status" />

            <div>
              <label className="text-sm text-slate-700">Caretaker</label>
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none" />
            </div>

            <div>
              <label className="text-sm text-slate-700">Notes</label>
              <textarea className="mt-1 h-20 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none" />
            </div>
          </div>
        </PageContent>
      </div>

      <div className="hidden min-h-full w-full bg-amber-100 p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-slate-900">Database</h1>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full bg-lime-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            Add entry
            <span className="text-lg leading-none">+</span>
          </button>
        </div>

        <div className="mt-4 rounded-3xl bg-white p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search"
                className="h-9 w-full rounded-full bg-amber-100 px-4 pr-10 text-sm text-slate-800 outline-none"
              />
              <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>

            <button
              type="button"
              onClick={() => setShowDesktopFilters((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-sm text-slate-700"
            >
              Filter
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-sm text-slate-700"
            >
              Sort by
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {showDesktopFilters && (
            <div className="mt-2 flex flex-wrap gap-2">
              {FILTER_CHIPS.map((chip, index) => (
                <span
                  key={`${chip}-${index}`}
                  className="rounded-full bg-amber-100 px-3 py-1 text-sm text-slate-700"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>

        <section className="mt-4 rounded-3xl bg-slate-50 p-5">
          <div className="flex gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-slate-300">
              <span className="text-4xl text-slate-800">&#9635;</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-4xl font-bold text-slate-900">Cat Name</h2>
                <span className="text-4xl text-blue-500">&#9794;</span>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {["Intervention", "Color", "Size/Age"].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-amber-100 px-3 py-1 text-xs text-slate-700"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <p className="mt-4 text-sm font-medium text-slate-900">
                Last seen: Arete - 02/21/26
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <TopTabs active="General" />
            <div className="ml-4 flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm text-slate-700">
              <span>Adoptable</span>
              <span className="relative inline-flex h-4 w-7 items-center rounded-full bg-slate-300">
                <span className="inline-block h-3 w-3 translate-x-3.5 rounded-full bg-slate-800" />
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <DropdownField label="Color" />
            <DropdownField label="Size/Age" />
            <DropdownField label="Sex" />
            <DropdownField label="Sociability" />
            <DropdownField label="Status" />
            <DropdownField label="Caretaker" />
          </div>

          <div className="mt-3">
            <label className="text-xs text-slate-700">Notes</label>
            <textarea className="mt-1 h-13 w-full resize-none rounded-md border border-lime-300 px-3 py-2 text-sm outline-none" />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-full bg-amber-100 px-4 py-1 text-sm text-slate-700"
            >
              Save <span className="ml-1">&#10003;</span>
            </button>
            <button
              type="button"
              className="rounded-full bg-amber-100 px-4 py-1 text-sm text-slate-700"
            >
              Cancel <span className="ml-1">&#10005;</span>
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
