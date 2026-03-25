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
          <h1 className="text-base font-bold text-slate-900 tablet:text-lg">TNVR</h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 tablet:text-sm">
            This is a summary of the TNVR statistics of the Catenean population.
            Updates come from AGILA&apos;s cat census sheets and responses from the
            ACCaP Cat Census GForms.
          </p>
        </div>

        {/* Totals Hero Card */}
        <div className="overflow-hidden rounded-lg ring-1 ring-slate-200 tablet:rounded-xl">
          <div className="border-b border-slate-100 bg-white px-3 py-2 tablet:px-4 tablet:py-3">
            <p className="text-xs font-semibold text-slate-700 tablet:text-sm">
              Totals
            </p>
          </div>
          <div className="divide-y divide-slate-100 bg-white">
            {TOTALS.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between px-3 py-2.5 tablet:px-4 tablet:py-3"
              >
                <p
                  className={`text-xs tablet:text-sm ${item.bold ? "font-semibold text-slate-800" : "font-medium text-slate-600"}`}
                >
                  {item.label}
                </p>
                <p
                  className={`text-sm tablet:text-base ${item.bold ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}
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
        <div className="overflow-hidden rounded-lg ring-1 ring-slate-200 tablet:rounded-xl">
          <div className="border-b border-slate-100 bg-white px-3 py-2 tablet:px-4 tablet:py-3">
            <p className="text-xs font-semibold text-slate-700 tablet:text-sm">
              Location Details
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-100 tablet:grid-cols-3">
            {TNVR_STATS.map((stat) => (
              <div
                key={stat.label}
                className="bg-white px-3 py-2.5 tablet:px-4 tablet:py-3"
              >
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className="mt-0.5 text-base font-bold text-slate-900 tablet:text-lg">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Graph Placeholder */}
        <div className="overflow-hidden rounded-lg ring-1 ring-slate-200 tablet:rounded-xl">
          <div className="border-b border-slate-200 bg-white px-3 py-2 tablet:px-4 tablet:py-3">
            <p className="text-xs font-semibold text-slate-700 tablet:text-sm">
              TNVR Trend
            </p>
          </div>
          <div className="flex h-40 items-center justify-center bg-slate-100 tablet:h-52">
            <p className="text-xs font-medium text-slate-400 tablet:text-sm">
              Graph — coming soon
            </p>
          </div>
        </div>

          </div>
        </PageContent>
      </div>

      <div className="hidden min-h-full w-full bg-amber-100 p-6 tablet:block tablet:p-7">
        <div className="mb-3 flex items-center justify-between gap-5">
          <label className="w-full max-w-52">
            <span className="mb-1 block text-sm font-semibold text-slate-900">Location:</span>
            <div className="relative rounded-full bg-white">
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
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                &#9662;
              </span>
            </div>
          </label>

          <p className="whitespace-nowrap pt-5 text-sm font-semibold text-slate-900">
            Last updated: XX/XX/XXXX
          </p>
        </div>

        <section className="rounded-3xl bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">Graph title</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full bg-amber-100 px-4 py-1 text-sm text-slate-700"
              >
                Status
                <span className="ml-1">&#9662;</span>
              </button>
              <button
                type="button"
                className="rounded-full bg-amber-100 px-4 py-1 text-sm text-slate-700"
              >
                Gender
                <span className="ml-1">&#9662;</span>
              </button>
            </div>
          </div>

          <div className="flex h-50 items-center justify-center rounded-2xl bg-slate-50 text-lg text-slate-700">
            pie chart bar chart
          </div>
        </section>

        <div className="mt-4 grid grid-cols-4 gap-3">
          {TNVR_DESKTOP_CARDS.map((card, index) => (
            <article key={`${card.label}-${index}`} className="rounded-3xl bg-slate-50 px-4 py-3">
              <p className="text-center text-5xl font-bold leading-none text-slate-900">
                {card.value}
              </p>
              <p className="mt-1 text-center text-base text-slate-700">{card.label}</p>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
