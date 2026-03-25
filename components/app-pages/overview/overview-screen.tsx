"use client";

import { useMemo, useState } from "react";
import { PageContent } from "@/components/app-pages/shared/page-frame";
import { FilterDropdown } from "@/components/app-pages/shared/filter-dropdown";
import { LOCATIONS } from "@/components/app-pages/shared/constants";

const LOCATION_STATS = [
  { label: "Cat Count", value: "24" },
  { label: "Neutered", value: "14" },
  { label: "Unneutered", value: "10" },
  { label: "% TNVR", value: "58%" },
  { label: "Domesticated", value: "8" },
  { label: "Tame", value: "10" },
  { label: "Feral", value: "6" },
  { label: "Sick", value: "2" },
  { label: "Injured", value: "1" },
  { label: "Adoptable", value: "3" },
  { label: "Unnamed", value: "7" },
];

const ADDITIONAL_STATS = [
  { label: "# of Fostered", value: "5", bold: false },
  { label: "# of Adopted", value: "12", bold: false },
  { label: "# of MIA", value: "3", bold: false },
  { label: "# of Deceased", value: "8", bold: false },
  { label: "TOTAL", value: "28", bold: true },
  { label: "OVERALL TOTAL", value: "123", bold: true },
];

const DASHBOARD_MODE_OPTIONS = ["Overall", ...LOCATIONS];

const DESKTOP_PRIMARY_STATS = [
  { label: "Total Count", value: "999" },
  { label: "Neutered", value: "999" },
  { label: "Unneutered", value: "999" },
  { label: "TNVR %", value: "99%" },
];

const DESKTOP_STATUS_STATS = [
  { label: "Tame", value: "999" },
  { label: "Feral", value: "999" },
  { label: "Sick", value: "999" },
  { label: "Adoptable", value: "999" },
  { label: "Unnamed", value: "999" },
  { label: "Injured", value: "999" },
];

const OVERALL_PERIODS = ["Current", "Month", "Year"];
const LOCATION_PERIODS = ["Current", "2025", "2024", "2023"];

export function OverviewScreen() {
  const [dashboardMode, setDashboardMode] = useState(DASHBOARD_MODE_OPTIONS[0]);
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const isOverall = dashboardMode === "Overall";
  const activePeriods = useMemo(
    () => (isOverall ? OVERALL_PERIODS : LOCATION_PERIODS),
    [isOverall],
  );

  return (
    <>
      <div className="tablet:hidden">
        <PageContent>
          <div className="space-y-3 tablet:space-y-4">

        {/* Page Header */}
        <div>
          <h1 className="text-base font-bold text-slate-900 tablet:text-lg">Overview</h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 tablet:text-sm">
            This is a summary of the cat population in the Ateneo de Manila
            University. Updates come from AGILA&apos;s cat census sheets.
          </p>
        </div>

        {/* Dates */}
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-slate-500">
            Last PAW Update:{" "}
            <span className="font-semibold text-slate-700">Jan 1, 2026</span>
          </p>
          <p className="text-xs text-slate-500">
            Last Update:{" "}
            <span className="font-semibold text-slate-700">Jan 1, 2026</span>
          </p>
        </div>

        {/* Hero Card */}
        <div className="rounded-lg bg-white px-4 py-3 ring-1 ring-slate-200 tablet:rounded-xl tablet:px-5 tablet:py-4">
          <p className="mb-3 text-xs font-semibold text-slate-500 tablet:text-sm">
            Colony Snapshot
          </p>
          <div className="flex items-center justify-around">
            <div className="text-center">
              <p className="text-4xl font-bold text-slate-900">123</p>
              <p className="mt-1 text-xs font-medium text-slate-500 tablet:text-sm">
                Total Cats
              </p>
            </div>
            <div className="h-12 w-px bg-slate-200" />
            <div className="text-center">
              <p className="text-4xl font-bold text-slate-900">58%</p>
              <p className="mt-1 text-xs font-medium text-slate-500 tablet:text-sm">
                TNVR Score
              </p>
            </div>
          </div>
        </div>

        {/* Location Dropdown */}
        <FilterDropdown
          label="Location"
          options={LOCATIONS}
          defaultValue="All Locations"
        />

        {/* Location Details */}
        <div className="overflow-hidden rounded-lg ring-1 ring-slate-200 tablet:rounded-xl">
          <div className="border-b border-slate-100 bg-white px-3 py-2 tablet:px-4 tablet:py-3">
            <p className="text-xs font-semibold text-slate-700 tablet:text-sm">
              Location Details
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-100 tablet:grid-cols-3">
            {LOCATION_STATS.map((stat) => (
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
              Population Trend
            </p>
          </div>
          <div className="flex h-40 items-center justify-center bg-slate-100 tablet:h-52">
            <p className="text-xs font-medium text-slate-400 tablet:text-sm">
              Graph — coming soon
            </p>
          </div>
        </div>

        {/* Not Included in Total Count */}
        <div className="overflow-hidden rounded-lg ring-1 ring-slate-200 tablet:rounded-xl">
          <div className="border-b border-slate-100 bg-white px-3 py-2 tablet:px-4 tablet:py-3">
            <p className="text-xs font-semibold text-slate-700 tablet:text-sm">
              Not Included in Total Cat Count
            </p>
          </div>
          <div className="divide-y divide-slate-100 bg-white">
            {ADDITIONAL_STATS.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between px-3 py-2.5 tablet:px-4 tablet:py-3"
              >
                <p
                  className={`text-xs tablet:text-sm ${stat.bold ? "font-semibold text-slate-800" : "font-medium text-slate-600"}`}
                >
                  {stat.label}
                </p>
                <p
                  className={`text-sm tablet:text-base ${stat.bold ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

          </div>
        </PageContent>
      </div>

      <div className="hidden min-h-full w-full bg-amber-100 p-6 tablet:block tablet:p-7">
        <div className="mb-5 flex items-start justify-between gap-6">
          <label className="w-full max-w-92">
            <span className="mb-1 block text-sm font-semibold text-slate-900">Location:</span>
            <div className="relative rounded-full bg-white">
              <select
                value={dashboardMode}
                onChange={(e) => {
                  setDashboardMode(e.target.value);
                  setShowPeriodMenu(false);
                }}
                className="h-10 w-full appearance-none rounded-full bg-white px-4 pr-10 text-sm text-slate-800"
                aria-label="Overview Dashboard Mode"
              >
                {DASHBOARD_MODE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "Overall" ? "Overall (type to search)" : option}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                &#9662;
              </span>
            </div>
          </label>

          <p className="mt-1 whitespace-nowrap text-sm font-semibold text-slate-900">
            Last updated: XX/XX/XXXX
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {DESKTOP_PRIMARY_STATS.map((stat) => (
            <article key={stat.label} className="rounded-3xl bg-slate-50 px-4 py-3 text-center">
              <p className="text-6.5 font-bold leading-none text-slate-900">{stat.value}</p>
              <p className="mt-1 text-base text-slate-700">{stat.label}</p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-[1fr_7.5rem] gap-3">
          <section className="relative rounded-3xl bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-base font-semibold text-slate-900">Graph title</p>
                <button
                  type="button"
                  className="rounded-full bg-amber-100 px-3 py-1 text-sm text-slate-700"
                >
                  Sort by
                  <span className="ml-1">&#9662;</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowPeriodMenu((v) => !v)}
                className="text-xl leading-none text-slate-500"
                aria-label="Open period menu"
                aria-expanded={showPeriodMenu}
              >
                ...
              </button>
            </div>

            {showPeriodMenu && (
              <div className="absolute right-4 top-12 z-10 w-24 rounded-2xl bg-amber-100 p-2 shadow-sm">
                {activePeriods.map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setShowPeriodMenu(false)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm text-slate-800 hover:bg-amber-200"
                  >
                    <span>{period}</span>
                    <span className="text-base leading-none">&#8250;</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex h-75 items-center justify-center rounded-2xl bg-slate-50 text-lg text-slate-700">
              {isOverall ? "horizontal bar chart" : "line chart (display all months in a year)"}
            </div>
          </section>

          <section className="space-y-2">
            {DESKTOP_STATUS_STATS.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between rounded-3xl bg-slate-50 px-3 py-2"
              >
                <span className="text-sm font-semibold text-slate-900">{stat.label}</span>
                <span className="text-sm font-semibold text-slate-900">{stat.value}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
