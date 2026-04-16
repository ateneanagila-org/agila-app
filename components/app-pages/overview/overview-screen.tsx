"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LOCATIONS } from "@/components/app-pages/shared/constants";
import { getCats, getCatHealthRecords } from "@/app/actions/cats";
import type { SelectCat, SelectCatHealthRecord } from "@/lib/validation/cats";
import {
  SearchIcon,
  ChevronDownIcon,
} from "@/components/app-pages/shared/icons";

const DASHBOARD_MODE_OPTIONS = ["Overall", ...LOCATIONS];
const OVERALL_PERIODS = ["Current", "Month", "Year"];
const LOCATION_PERIODS = ["Current", "2025", "2024", "2023"];

function computeStats(
  cats: SelectCat[],
  healthRecords: SelectCatHealthRecord[],
) {
  const hrByCatId = new Map<string, SelectCatHealthRecord>();
  for (const hr of healthRecords) {
    hrByCatId.set(hr.cat_id, hr);
  }

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
    if (hr?.neuter_date) neutered++;
    if (cat.sociability === "Domesticated") domesticated++;
    else if (cat.sociability === "Tame") tame++;
    else if (cat.sociability === "Feral") feral++;
    if (hr?.condition === "Sick" || hr?.condition === "Sick and Injured")
      sick++;
    if (hr?.condition === "Injured" || hr?.condition === "Sick and Injured")
      injured++;
    if (cat.is_adoptable) adoptable++;
    if (!cat.name || cat.name.trim() === "") unnamed++;
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
  const [location, setLocation] = useState("Overall");
  const [allCats, setAllCats] = useState<SelectCat[]>([]);
  const [allHealthRecords, setAllHealthRecords] = useState<
    SelectCatHealthRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("MM/DD/YY");

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
      if (hrResult?.data) setAllHealthRecords(hrResult.data);
    } catch (err) {
      console.error("Failed to fetch overview data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredCats = useMemo(() => {
    if (location === "Overall") return allCats;
    return allCats.filter((c) =>
      c.spot_last_seen?.toUpperCase().includes(location.toUpperCase()),
    );
  }, [allCats, location]);

  const stats = useMemo(
    () => computeStats(filteredCats, allHealthRecords),
    [filteredCats, allHealthRecords],
  );

  const desktopCats = useMemo(() => {
    if (dashboardMode === "Overall") return allCats;
    return allCats.filter((c) =>
      c.spot_last_seen?.toUpperCase().includes(dashboardMode.toUpperCase()),
    );
  }, [allCats, dashboardMode]);

  const desktopStats = useMemo(
    () => computeStats(desktopCats, allHealthRecords),
    [desktopCats, allHealthRecords],
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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green-light border-t-brand-green" />
      </div>
    );
  }

  return (
    <>
      {/* ── MOBILE HI-FI ── */}
      <div className="tablet:hidden">
        <div className="space-y-3 px-4 py-4">
          {/* Dates */}
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">
              Last update:{" "}
              <span className="font-semibold text-foreground">
                {lastUpdated}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Last PAWS update:{" "}
              <span className="font-semibold text-foreground">
                {lastUpdated}
              </span>
            </p>
          </div>

          {/* Location search bar */}
          <div className="relative">
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-11 w-full appearance-none rounded-xl bg-brand-orange px-4 pr-10 text-sm font-semibold text-white"
              aria-label="Location"
            >
              <option value="Overall">Overall (type to search)</option>
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
            <SearchIcon className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white" />
          </div>

          {/* Main stats */}
          <div className="overflow-hidden rounded-xl bg-brand-green">
            <div className="grid grid-cols-2 divide-x divide-white/20">
              <div className="px-4 py-3">
                <p className="text-[11px] font-medium text-white/70">
                  Total Count
                </p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">
                  {stats.total}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] font-medium text-white/70">
                  TNVR Score
                </p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">
                  {stats.tnvrPct}%
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl bg-brand-green">
            <div className="grid grid-cols-2 divide-x divide-white/20">
              <div className="px-4 py-3">
                <p className="text-[11px] font-medium text-white/70">
                  Neutered
                </p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-white">
                  {stats.neutered}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] font-medium text-white/70">
                  Unneutered
                </p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-white">
                  {stats.unneutered}
                </p>
              </div>
            </div>
          </div>

          {/* Population section */}
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold text-foreground">
              Population
            </h2>
            <button
              type="button"
              className="flex items-center gap-1 rounded-full bg-brand-orange px-3 py-1.5 text-xs font-semibold text-white"
            >
              Sort By <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Chart placeholder */}
          <div className="relative flex h-48 items-center justify-center rounded-xl bg-brand-green">
            <p className="text-sm text-white/50">Horizontal Bar Chart</p>
            <button
              type="button"
              onClick={() => setShowPeriodMenu((v) => !v)}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-brand-orange text-xs font-bold text-white"
              aria-label="Chart options"
            >
              •••
            </button>
            {showPeriodMenu && (
              <div className="absolute right-3 top-12 z-10 min-w-24 rounded-xl bg-brand-dark p-2 shadow-lg">
                {activePeriods.map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setShowPeriodMenu(false)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs text-white hover:bg-white/10"
                  >
                    {period}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sociability stats */}
          <div className="space-y-2">
            {/* Wide single row */}
            <div className="flex items-center justify-between rounded-xl bg-brand-green px-4 py-2.5">
              <span className="text-sm font-semibold text-white">
                Domesticated
              </span>
              <span className="text-sm font-bold tabular-nums text-white">
                {stats.domesticated}
              </span>
            </div>

            {/* Paired rows */}
            {[
              [
                { label: "Adoptable", value: stats.adoptable },
                { label: "Unnamed", value: stats.unnamed },
              ],
              [
                { label: "Tame", value: stats.tame },
                { label: "Feral", value: stats.feral },
              ],
              [
                { label: "Sick", value: stats.sick },
                { label: "Injured", value: stats.injured },
              ],
            ].map((pair, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                {pair.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-xl bg-brand-green px-3 py-2.5"
                  >
                    <span className="text-xs font-medium text-white/80">
                      {item.label}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-white">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Off-census section */}
          <div className="space-y-2">
            {/* Header card */}
            <div className="overflow-hidden rounded-xl bg-brand-green">
              <div className="grid grid-cols-2 divide-x divide-white/20">
                <div className="px-4 py-3">
                  <p className="text-sm font-semibold text-white">Untracked</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-white">
                    {stats.offCensusTotal}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm font-semibold text-white">
                    Overall Total
                  </p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-white">
                    {stats.overallTotal}
                  </p>
                </div>
              </div>
            </div>

            {/* Paired off-census rows */}
            {[
              [
                { label: "Fostered", value: stats.fostered },
                { label: "Adopted", value: stats.adopted },
              ],
              [
                { label: "MIA", value: stats.mia },
                { label: "Deceased", value: stats.deceased },
              ],
            ].map((pair, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                {pair.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-xl bg-brand-green px-3 py-2.5"
                  >
                    <span className="text-xs font-medium text-white/80">
                      {item.label}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-white">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── DESKTOP: colors updated, structure unchanged ── */}
      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-7">
        <div className="mb-5 flex items-start justify-between gap-6">
          <label className="w-full max-w-92">
            <span className="mb-1.5 block text-sm font-semibold text-foreground">
              Location:
            </span>
            <div className="relative rounded-full bg-white ring-1 ring-border">
              <select
                value={dashboardMode}
                onChange={(e) => {
                  setDashboardMode(e.target.value);
                  setShowPeriodMenu(false);
                }}
                className="h-10 w-full appearance-none rounded-full bg-white px-4 pr-10 text-sm text-foreground"
                aria-label="Overview Dashboard Mode"
              >
                {DASHBOARD_MODE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "Overall" ? "Overall (type to search)" : option}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                &#9662;
              </span>
            </div>
          </label>

          <p className="mt-1 whitespace-nowrap text-sm font-semibold text-foreground">
            Last updated: {lastUpdated}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {desktopPrimaryStats.map((stat) => (
            <article
              key={stat.label}
              className="rounded-2xl bg-white px-4 py-4 text-center ring-1 ring-border"
            >
              <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-[1fr_8rem] gap-3">
          <section className="relative rounded-2xl bg-white p-5 ring-1 ring-border">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-foreground">
                  Graph title
                </p>
                <button
                  type="button"
                  className="rounded-full bg-brand-cream-dark px-3 py-1 text-sm text-foreground"
                >
                  Sort by <span className="ml-1">&#9662;</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowPeriodMenu((v) => !v)}
                className="text-xl leading-none text-muted-foreground"
                aria-label="Open period menu"
                aria-expanded={showPeriodMenu}
              >
                ...
              </button>
            </div>

            {showPeriodMenu && (
              <div className="absolute right-4 top-12 z-10 w-24 rounded-2xl bg-brand-cream-dark p-2 shadow-sm">
                {activePeriods.map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setShowPeriodMenu(false)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-brand-cream"
                  >
                    <span>{period}</span>
                    <span className="text-base leading-none">&#8250;</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex h-75 items-center justify-center rounded-xl bg-brand-cream text-sm text-muted-foreground">
              {isOverall
                ? "horizontal bar chart"
                : "line chart (display all months in a year)"}
            </div>
          </section>

          <section className="space-y-2">
            {desktopStatusStats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 ring-1 ring-border"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {stat.label}
                </span>
                <span className="text-sm font-bold tabular-nums text-foreground">
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
