"use client";

import { useState } from "react";
import {
  DetailHeader,
  TopTabs,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import {
  DialogShell,
  SortByDialog,
} from "@/components/app-pages/shared/dialogs";
import {
  ChevronDownIcon,
  PlusCircleIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";

const INTERVENTIONS = [{ id: 1 }, { id: 2 }];

const FILTER_CHIPS = [
  "Include +",
  "Filter 1 Sample",
  "Filter 2 Sample",
  "Exclude -",
  "Filter 1 Sample",
  "Filter 2 Sample",
];

export function DatabaseInterventionsScreen() {
  const [showSort, setShowSort] = useState(false);
  const [showIntervention, setShowIntervention] = useState(false);
  const [showDesktopFilters, setShowDesktopFilters] = useState(false);

  return (
    <>
      <div className="tablet:hidden">
        <PageContent>
          <DetailHeader />
          <TopTabs active="Interventions" />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowSort(true)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700"
            >
              Sort By
            </button>
            <button
              type="button"
              onClick={() => setShowIntervention(true)}
              className="flex items-center gap-1.5 rounded-full bg-stone-600 px-4 py-2 text-xs font-medium text-white"
            >
              Create New
              <PlusCircleIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {INTERVENTIONS.map((item) => (
            <div key={item.id}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">
                  Intervention No. __
                </span>
                <span className="flex items-center gap-1 rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                  Status
                  <ChevronDownIcon className="h-3 w-3" />
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Requested At MM/DD/YY
              </p>
              <p className="text-xs text-slate-500">Notes:</p>
              <div className="mt-3 border-b border-slate-200" />
            </div>
          ))}
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
            <TopTabs active="Interventions" />
            <div className="ml-4 flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm text-slate-700">
              <span>Adoptable</span>
              <span className="relative inline-flex h-4 w-7 items-center rounded-full bg-slate-300">
                <span className="inline-block h-3 w-3 translate-x-3.5 rounded-full bg-slate-800" />
              </span>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setShowSort(true)}
              className="rounded-full bg-amber-100 px-4 py-1 text-sm text-slate-700"
            >
              Sort by <span className="ml-1">&#9662;</span>
            </button>
            <button
              type="button"
              onClick={() => setShowIntervention(true)}
              className="rounded-full bg-amber-100 px-4 py-1 text-sm text-slate-700"
            >
              Create New <span className="ml-1">+</span>
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {INTERVENTIONS.map((item) => (
              <div
                key={`desktop-${item.id}`}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    Intervention No. __
                  </p>
                  <p className="mt-1 text-2xl text-slate-600">
                    Requested at MM/DD/YYYY
                  </p>
                </div>
                <button
                  type="button"
                  className="flex h-10 min-w-42 items-center justify-between rounded-xl border border-lime-300 bg-white px-4 text-3.5 text-slate-700"
                >
                  <span>Status</span>
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
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

      <SortByDialog open={showSort} onClose={() => setShowSort(false)} />

      <DialogShell
        open={showIntervention}
        onClose={() => setShowIntervention(false)}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Create Intervention
          </h2>
          <button
            type="button"
            onClick={() => setShowIntervention(false)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-sm text-slate-500"
            aria-label="Close"
          >
            &#10005;
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-700">Title</label>
            <input className="mt-1 h-8 w-full rounded-md border border-lime-300 px-3 text-sm outline-none focus:ring-1 focus:ring-lime-300" />
          </div>
          <div>
            <label className="text-xs text-slate-700">Type</label>
            <div className="relative mt-1 rounded-md border border-lime-300 bg-white">
              <select className="h-8 w-full appearance-none rounded-md bg-white px-3 pr-10 text-sm text-slate-900">
                <option value="">&mdash;</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                &#9660;
              </span>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-700">Notes</label>
            <textarea className="mt-1 h-8 w-full resize-none rounded-md border border-lime-300 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-lime-300" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowIntervention(false)}
            className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-slate-700"
          >
            Cancel
            <span className="ml-1">&#10005;</span>
          </button>
          <button
            type="button"
            onClick={() => setShowIntervention(false)}
            className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-slate-700"
          >
            Create
            <span className="ml-1">&#10003;</span>
          </button>
        </div>
      </DialogShell>
    </>
  );
}
