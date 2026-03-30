"use client";

import { PageContent } from "@/components/app-pages/shared/page-frame";
import { FilterDropdown } from "@/components/app-pages/shared/filter-dropdown";
import { LOCATIONS } from "@/components/app-pages/shared/constants";

const TNVR_STATS = [
  { label: "Neutered Male", value: "9" },
  { label: "Spayed Female", value: "7" },
  { label: "Neutered Unknown Sex", value: "3" },
  { label: "Unneutered Male", value: "6" },
  { label: "Unneutered Female", value: "5" },
  { label: "Unneutered Unknown Sex", value: "2" },
];

const TOTALS = [
  { label: "Total Neutered / Spayed", value: "19", bold: false },
  { label: "Total Unneutered", value: "13", bold: false },
  { label: "Overall Total", value: "32", bold: true },
];

const TNVR_DESKTOP_CARDS = [
  { value: "99%", label: "Overall TNVR %" },
  { value: "99%", label: "Male TNVR %" },
  { value: "99%", label: "Female TNVR %" },
  { value: "99%", label: "Unknown TNVR %" },
  { value: "999", label: "Total Count" },
  { value: "999", label: "Male" },
  { value: "999", label: "Female" },
  { value: "999", label: "Unknown" },
  { value: "999", label: "Neutered" },
  { value: "999", label: "Male" },
  { value: "999", label: "Female" },
  { value: "999", label: "Unknown" },
  { value: "999", label: "Unneutered" },
  { value: "999", label: "Male" },
  { value: "999", label: "Female" },
  { value: "999", label: "Unknown" },
];

export function TnvrScreen() {
  return (
    <>
      <div className="tablet:hidden">
        <PageContent>
          <div className="space-y-3 tablet:space-y-4">
            {/* Page Header */}
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                TNVR
              </h1>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                A summary of TNVR statistics for the Catenean population.
                Updates come from AGILA&apos;s cat census sheets and ACCaP Cat
                Census GForms.
              </p>
            </div>

            {/* Totals Hero Card */}
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <div className="border-b border-slate-100 bg-white px-4 py-2.5">
                <p className="text-xs font-semibold tracking-wide text-slate-700">
                  Totals
                </p>
              </div>
              <div className="divide-y divide-slate-100 bg-white">
                {TOTALS.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <p
                      className={`text-xs ${item.bold ? "font-semibold text-slate-800" : "font-medium text-slate-600"}`}
                    >
                      {item.label}
                    </p>
                    <p
                      className={`tabular-nums text-sm ${item.bold ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Location Dropdown */}
            <FilterDropdown
              label="Location"
              options={LOCATIONS}
              defaultValue="All Locations"
            />

            {/* Location Stats */}
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <div className="border-b border-slate-100 bg-white px-4 py-2.5">
                <p className="text-xs font-semibold tracking-wide text-slate-700">
                  Location Details
                </p>
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-100">
                {TNVR_STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-white px-3.5 py-3"
                  >
                    <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Graph Placeholder */}
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <div className="border-b border-slate-100 bg-white px-4 py-2.5">
                <p className="text-xs font-semibold tracking-wide text-slate-700">
                  TNVR Trend
                </p>
              </div>
              <div className="flex h-40 items-center justify-center bg-slate-50">
                <p className="text-xs font-medium text-slate-400">
                  Graph — coming soon
                </p>
              </div>
            </div>
          </div>
        </PageContent>
      </div>

      <div className="hidden min-h-full w-full bg-slate-100 p-6 tablet:block tablet:p-7">
        <div className="mb-4 flex items-center justify-between gap-5">
          <label className="w-full max-w-52">
            <span className="mb-1.5 block text-sm font-semibold text-slate-900">
              Location:
            </span>
            <div className="relative rounded-full bg-white ring-1 ring-slate-100">
              <select
                defaultValue="Overall"
                className="h-9 w-full appearance-none rounded-full bg-white px-4 pr-10 text-sm text-slate-800"
                aria-label="TNVR Location"
              >
                <option value="Overall">Overall</option>
                {LOCATIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                &#9662;
              </span>
            </div>
          </label>

          <p className="whitespace-nowrap pt-5 text-xs font-medium text-slate-500">
            Last updated: XX/XX/XXXX
          </p>
        </div>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">Graph title</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
              >
                Status
                <span className="ml-1">&#9662;</span>
              </button>
              <button
                type="button"
                className="rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
              >
                Gender
                <span className="ml-1">&#9662;</span>
              </button>
            </div>
          </div>

          <div className="flex h-48 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
            pie chart / bar chart
          </div>
        </section>

        <div className="mt-4 grid grid-cols-4 gap-3">
          {TNVR_DESKTOP_CARDS.map((card, index) => (
            <article
              key={`${card.label}-${index}`}
              className="rounded-2xl bg-white px-4 py-3.5 ring-1 ring-slate-100"
            >
              <p className="text-center text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                {card.value}
              </p>
              <p className="mt-1 text-center text-xs text-slate-600">
                {card.label}
              </p>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
