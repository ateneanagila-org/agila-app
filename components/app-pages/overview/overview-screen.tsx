"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageContent } from "@/components/app-pages/shared/page-frame";
import { LOCATIONS } from "@/components/app-pages/shared/constants";
import { getCats, getCatHealthRecords } from "@/app/actions/cats";
import type { SelectCat, SelectCatHealthRecord } from "@/lib/validation/cats";

const DASHBOARD_MODE_OPTIONS = ["Overall", ...LOCATIONS];
const OVERALL_PERIODS = ["Current", "Month", "Year"];
const LOCATION_PERIODS = ["Current", "2025", "2024", "2023"];

/** Compute all stats from cats + health records, given an optional location filter */
function computeStats(
  cats: SelectCat[],
  healthRecords: SelectCatHealthRecord[],
) {
  const hrByCatId = new Map<string, SelectCatHealthRecord>();
  for (const hr of healthRecords) {
    hrByCatId.set(hr.cat_id, hr);
  }

  // Only count cats with entry_status "Original" or "Unreviewed" as active census cats
  const activeCats = cats.filter(
    (c) => c.entry_status === "Original" || c.entry_status === "Unreviewed",
  );

  const total = activeCats.length;
  let neutered = 0;
  let domesticated = 0;
  let tame = 0;
  let feral = 0;
  let sick = 0;
  let injured = 0;
  let adoptable = 0;
  let unnamed = 0;
  let fostered = 0;
  let adopted = 0;
  let mia = 0;
  let deceased = 0;

  for (const cat of activeCats) {
    const hr = hrByCatId.get(cat.id);

    // Neutered = has neuter_date
    if (hr?.neuter_date) neutered++;

    // Sociability
    if (cat.sociability === "Domesticated") domesticated++;
    else if (cat.sociability === "Tame") tame++;
    else if (cat.sociability === "Feral") feral++;

    // Health (from health record condition)
    if (hr?.condition === "Sick" || hr?.condition === "Sick and Injured") sick++;
    if (hr?.condition === "Injured" || hr?.condition === "Sick and Injured")
      injured++;

    // Adoptable
    if (cat.is_adoptable) adoptable++;

    // Unnamed
    if (!cat.name || cat.name.trim() === "") unnamed++;

    // Status counts (off-census)
    if (cat.cat_status === "Fostered") fostered++;
    if (cat.cat_status === "Adopted") adopted++;
    if (cat.cat_status === "MIA") mia++;
    if (cat.cat_status === "Deceased") deceased++;
  }

  const unneutered = total - neutered;
  const tnvrPct = total > 0 ? Math.round((neutered / total) * 100) : 0;
  const offCensusTotal = fostered + adopted + mia + deceased;
  const overallTotal = total + offCensusTotal;

  return {
    total,
    neutered,
    unneutered,
    tnvrPct,
    domesticated,
    tame,
    feral,
    sick,
    injured,
    adoptable,
    unnamed,
    fostered,
    adopted,
    mia,
    deceased,
    offCensusTotal,
    overallTotal,
  };
}

export function OverviewScreen() {
  const [dashboardMode, setDashboardMode] = useState(DASHBOARD_MODE_OPTIONS[0]);
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [location, setLocation] = useState("All Locations");
  const [allCats, setAllCats] = useState<SelectCat[]>([]);
  const [allHealthRecords, setAllHealthRecords] = useState<
    SelectCatHealthRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("—");

  const isOverall = dashboardMode === "Overall";
  const activePeriods = useMemo(
    () => (isOverall ? OVERALL_PERIODS : LOCATION_PERIODS),
    [isOverall],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catResult, hrResult] = await Promise.all([
        getCats({}),
        getCatHealthRecords({}),
      ]);
      if (catResult?.data) {
        setAllCats(catResult.data);
        // Find the most recent last_updated_at
        const dates = catResult.data
          .map((c) => c.last_updated_at)
          .filter(Boolean)
          .map((d) => new Date(d as string | Date).getTime());
        if (dates.length > 0) {
          const latest = new Date(Math.max(...dates));
          setLastUpdated(
            `${String(latest.getMonth() + 1).padStart(2, "0")}/${String(latest.getDate()).padStart(2, "0")}/${latest.getFullYear()}`,
          );
        }
      }
      if (hrResult?.data) {
        setAllHealthRecords(hrResult.data);
      }
    } catch (err) {
      console.error("Failed to fetch overview data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter cats by location (spot_last_seen)
  const filteredCats = useMemo(() => {
    if (location === "All Locations") return allCats;
    return allCats.filter(
      (c) =>
        c.spot_last_seen &&
        c.spot_last_seen.toUpperCase().includes(location.toUpperCase()),
    );
  }, [allCats, location]);

  const stats = useMemo(
    () => computeStats(filteredCats, allHealthRecords),
    [filteredCats, allHealthRecords],
  );

  // Desktop-specific view: use dashboardMode for filtering
  const desktopCats = useMemo(() => {
    if (dashboardMode === "Overall") return allCats;
    return allCats.filter(
      (c) =>
        c.spot_last_seen &&
        c.spot_last_seen.toUpperCase().includes(dashboardMode.toUpperCase()),
    );
  }, [allCats, dashboardMode]);

  const desktopStats = useMemo(
    () => computeStats(desktopCats, allHealthRecords),
    [desktopCats, allHealthRecords],
  );

  const locationStats = useMemo(
    () => [
      { label: "Cat Count", value: String(stats.total) },
      { label: "Neutered", value: String(stats.neutered) },
      { label: "Unneutered", value: String(stats.unneutered) },
      { label: "% TNVR", value: `${stats.tnvrPct}%` },
      { label: "Domesticated", value: String(stats.domesticated) },
      { label: "Tame", value: String(stats.tame) },
      { label: "Feral", value: String(stats.feral) },
      { label: "Sick", value: String(stats.sick) },
      { label: "Injured", value: String(stats.injured) },
      { label: "Adoptable", value: String(stats.adoptable) },
      { label: "Unnamed", value: String(stats.unnamed) },
    ],
    [stats],
  );

  const additionalStats = useMemo(
    () => [
      { label: "# of Fostered", value: String(stats.fostered), bold: false },
      { label: "# of Adopted", value: String(stats.adopted), bold: false },
      { label: "# of MIA", value: String(stats.mia), bold: false },
      { label: "# of Deceased", value: String(stats.deceased), bold: false },
      {
        label: "TOTAL",
        value: String(stats.offCensusTotal),
        bold: true,
      },
      {
        label: "OVERALL TOTAL",
        value: String(stats.overallTotal),
        bold: true,
      },
    ],
    [stats],
  );

  const desktopPrimaryStats = useMemo(
    () => [
      { label: "Total Count", value: String(desktopStats.total) },
      { label: "Neutered", value: String(desktopStats.neutered) },
      { label: "Unneutered", value: String(desktopStats.unneutered) },
      { label: "TNVR %", value: `${desktopStats.tnvrPct}%` },
    ],
    [desktopStats],
  );

  const desktopStatusStats = useMemo(
    () => [
      { label: "Tame", value: String(desktopStats.tame) },
      { label: "Feral", value: String(desktopStats.feral) },
      { label: "Sick", value: String(desktopStats.sick) },
      { label: "Adoptable", value: String(desktopStats.adoptable) },
      { label: "Unnamed", value: String(desktopStats.unnamed) },
      { label: "Injured", value: String(desktopStats.injured) },
    ],
    [desktopStats],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
    );
  }

  return (
    <>
      <div className="tablet:hidden">
        <PageContent>
          <div className="space-y-3 tablet:space-y-4">
            {/* Page Header */}
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                Overview
              </h1>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                A summary of the cat population in Ateneo de Manila
                University. Updates come from AGILA&apos;s cat census sheets.
              </p>
            </div>

            {/* Dates */}
            <div className="flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2.5">
              <p className="text-xs text-slate-500">
                Last PAW Update:{" "}
                <span className="font-semibold text-slate-700">
                  {lastUpdated}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                Last Update:{" "}
                <span className="font-semibold text-slate-700">
                  {lastUpdated}
                </span>
              </p>
            </div>

            {/* Hero Card */}
            <div className="rounded-xl bg-white px-4 py-4 ring-1 ring-slate-200">
              <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500">
                Colony Snapshot
              </p>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <p className="text-3xl font-bold tracking-tight text-slate-900">
                    {stats.total}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Total Cats
                  </p>
                </div>
                <div className="h-10 w-px bg-slate-200" />
                <div className="text-center">
                  <p className="text-3xl font-bold tracking-tight text-slate-900">
                    {stats.tnvrPct}%
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    TNVR Score
                  </p>
                </div>
              </div>
            </div>

            {/* Location Dropdown */}
            <label className="flex w-full flex-col gap-1.5">
              <span className="text-xs font-semibold tracking-wide text-slate-700">
                Location
              </span>
              <div className="relative rounded-lg bg-white ring-1 ring-slate-200">
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="h-10 w-full appearance-none rounded-lg bg-white px-3 pr-10 text-sm font-medium text-slate-900"
                  aria-label="Location"
                >
                  {LOCATIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-600">
                  ▼
                </span>
              </div>
            </label>

            {/* Location Details */}
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <div className="border-b border-slate-100 bg-white px-4 py-2.5">
                <p className="text-xs font-semibold tracking-wide text-slate-700">
                  Location Details
                </p>
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-100">
                {locationStats.map((stat) => (
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
                  Population Trend
                </p>
              </div>
              <div className="flex h-40 items-center justify-center bg-slate-50">
                <p className="text-xs font-medium text-slate-400">
                  Graph — coming soon
                </p>
              </div>
            </div>

            {/* Not Included in Total Count */}
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <div className="border-b border-slate-100 bg-white px-4 py-2.5">
                <p className="text-xs font-semibold tracking-wide text-slate-700">
                  Not Included in Total Cat Count
                </p>
              </div>
              <div className="divide-y divide-slate-100 bg-white">
                {additionalStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <p
                      className={`text-xs ${stat.bold ? "font-semibold text-slate-800" : "font-medium text-slate-600"}`}
                    >
                      {stat.label}
                    </p>
                    <p
                      className={`tabular-nums text-sm ${stat.bold ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}
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

      <div className="hidden min-h-full w-full bg-slate-100 p-6 tablet:block tablet:p-7">
        <div className="mb-5 flex items-start justify-between gap-6">
          <label className="w-full max-w-92">
            <span className="mb-1.5 block text-sm font-semibold text-slate-900">
              Location:
            </span>
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
            Last updated: {lastUpdated}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {desktopPrimaryStats.map((stat) => (
            <article
              key={stat.label}
              className="rounded-2xl bg-white px-4 py-4 text-center ring-1 ring-slate-100"
            >
              <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-slate-600">{stat.label}</p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-[1fr_8rem] gap-3">
          <section className="relative rounded-2xl bg-white p-5 ring-1 ring-slate-100">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  Graph title
                </p>
                <button
                  type="button"
                  className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
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

            {showPeriodMenu ? (
              <div className="absolute right-4 top-12 z-10 w-24 rounded-2xl bg-slate-100 p-2 shadow-sm">
                {activePeriods.map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setShowPeriodMenu(false)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm text-slate-800 hover:bg-slate-200"
                  >
                    <span>{period}</span>
                    <span className="text-base leading-none">&#8250;</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex h-75 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
              {isOverall
                ? "horizontal bar chart"
                : "line chart (display all months in a year)"}
            </div>
          </section>

          <section className="space-y-2">
            {desktopStatusStats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-100"
              >
                <span className="text-xs font-medium text-slate-600">
                  {stat.label}
                </span>
                <span className="text-sm font-bold tabular-nums text-slate-900">
                  {stat.value}
                </span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
