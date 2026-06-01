"use client";

import { useMemo, useState } from "react";
import { LOCATIONS } from "@/components/app-pages/shared/constants";
import type { SelectCat, SelectCatHealthRecord } from "@/lib/validation/cats";
import { ChevronDownIcon } from "@/components/app-pages/shared/icons";
import {
  HorizontalBarChart,
  VerticalBarChart,
} from "@/components/app-pages/shared/charts";
import { LocationPicker } from "@/components/app-pages/shared/location-picker";

const DASHBOARD_MODE_OPTIONS = ["Overall", ...LOCATIONS];
const OVERALL_PERIODS = ["Current", "Month", "Year"];
const LOCATION_PERIODS = ["Current", "2025", "2024", "2023"];

type OverviewScreenProps = {
  initialCats: SelectCat[];
  initialHealthRecords: SelectCatHealthRecord[];
};

function formatLatestUpdate(cats: SelectCat[]) {
  const dates = cats
    .map((cat) => cat.last_updated_at)
    .filter(Boolean)
    .map((date) => new Date(date as string | Date).getTime())
    .filter((time) => !Number.isNaN(time));

  if (dates.length === 0) return "MM/DD/YY";

  const latest = new Date(Math.max(...dates));
  return `${String(latest.getMonth() + 1).padStart(2, "0")}/${String(latest.getDate()).padStart(2, "0")}/${latest.getFullYear()}`;
}

function computeStats(
  cats: SelectCat[],
  healthRecords: SelectCatHealthRecord[],
) {
  const hrByCatId = new Map<string, SelectCatHealthRecord>();
  for (const hr of healthRecords) {
    hrByCatId.set(hr.cat_id, hr);
  }

  const originalCats = cats.filter((c) => c.entry_status === "Original");

  const total = originalCats.length;
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

  for (const cat of originalCats) {
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

export function OverviewScreen({
  initialCats,
  initialHealthRecords,
}: OverviewScreenProps) {
  const [dashboardMode, setDashboardMode] = useState(DASHBOARD_MODE_OPTIONS[0]);
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [location, setLocation] = useState("Overall");
  const allCats = initialCats;
  const allHealthRecords = initialHealthRecords;
  const lastUpdated = useMemo(() => formatLatestUpdate(allCats), [allCats]);

  const isOverall = dashboardMode === "Overall";
  const activePeriods = useMemo(
    () => (isOverall ? OVERALL_PERIODS : LOCATION_PERIODS),
    [isOverall],
  );

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

  const populationByLocation = useMemo(() => {
    const counts = new Map<string, number>();
    for (const loc of LOCATIONS) {
      if (loc === "All Locations") continue;
      counts.set(loc, 0);
    }
    for (const cat of allCats) {
      const spot = (cat.spot_last_seen ?? "").toUpperCase();
      if (!spot) continue;
      let matched = false;
      for (const loc of counts.keys()) {
        if (spot.includes(loc.toUpperCase())) {
          counts.set(loc, (counts.get(loc) ?? 0) + 1);
          matched = true;
          break;
        }
      }
      if (!matched) {
        counts.set("UNKNOWN", (counts.get("UNKNOWN") ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).map(([label, value]) => ({
      label,
      value,
    }));
  }, [allCats]);

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

  return (
    <>
      {/* ── MOBILE HI-FI ── */}
      <div className="tablet:hidden">
        <div className="space-y-3 px-4 py-4">
          {/* Dates */}
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-brand-green">
              Last update:{" "}
              <span className="font-medium text-foreground">
                {lastUpdated}
              </span>
            </p>
            <p className="text-xs font-semibold text-brand-green">
              Last PAWS update:{" "}
              <span className="font-medium text-foreground">
                {lastUpdated}
              </span>
            </p>
          </div>

          {/* Location picker */}
          <LocationPicker
            value={location}
            options={["Overall", ...LOCATIONS.filter((l) => l !== "All Locations")]}
            onChange={setLocation}
            variant="pill"
          />

          {/* Main stats */}
          <div className="overflow-hidden rounded-xl bg-brand-green">
            <div className="grid grid-cols-2 divide-x divide-white/20">
              <div className="px-4 py-3">
                <p className="text-[11px] font-medium text-brand-yellow">
                  Total Count
                </p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">
                  {stats.total}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] font-medium text-brand-yellow">
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
                <p className="text-[11px] font-medium text-brand-yellow">
                  Neutered
                </p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-white">
                  {stats.neutered}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] font-medium text-brand-yellow">
                  Unneutered
                </p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-white">
                  {stats.unneutered}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl font-bold text-brand-green">
              Population
            </h2>
            <button
              type="button"
              className="flex items-center gap-1 rounded-full bg-brand-orange px-3 py-1.5 text-xs font-bold text-white"
            >
              Sort By <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Population bar chart */}
          <div className="relative rounded-xl bg-white p-3 ring-1 ring-border">
            <button
              type="button"
              onClick={() => setShowPeriodMenu((v) => !v)}
              className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-brand-dark text-xs font-bold text-white"
              aria-label="Chart options"
            >
              <span className="-mt-1 leading-none">...</span>
            </button>
            {showPeriodMenu && (
              <div className="absolute right-3 top-12 z-20 min-w-28 overflow-hidden rounded-xl bg-brand-dark p-1.5 shadow-lg">
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
            <div className="h-80">
              <HorizontalBarChart
                data={populationByLocation}
                title="Catenean Population Summary"
              />
            </div>
          </div>

          {/* Sociability stats */}
          <div className="space-y-2">
            {/* Wide single row */}
            <div className="flex items-center justify-between rounded-xl bg-brand-green px-4 py-2.5">
              <span className="text-sm font-semibold text-brand-yellow">
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
                    <span className="text-xs font-medium text-brand-yellow">
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
                  <p className="text-sm font-semibold text-brand-yellow">Untracked</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-white">
                    {stats.offCensusTotal}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm font-semibold text-brand-yellow">
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
                    <span className="text-xs font-medium text-brand-yellow">
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

      {/* ── DESKTOP HI-FI ── */}
      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-8">
        <div className="mb-6 flex items-end justify-between gap-6">
          <div className="flex items-end gap-4">
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-brand-dark">
                Overview
              </h1>
              <p className="mt-1 text-xs font-semibold text-brand-green">
                Last update:{" "}
                <span className="font-medium text-brand-dark/70">
                  {lastUpdated}
                </span>
              </p>
            </div>
          </div>

          <div className="w-full max-w-80">
            <LocationPicker
              value={dashboardMode}
              options={DASHBOARD_MODE_OPTIONS}
              onChange={(v) => {
                setDashboardMode(v);
                setShowPeriodMenu(false);
              }}
              label="Location"
            />
          </div>
        </div>

        {/* Primary stats — green hero row */}
        <div className="grid grid-cols-4 gap-3">
          {desktopPrimaryStats.map((stat) => (
            <article
              key={stat.label}
              className="rounded-2xl bg-brand-green px-5 py-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-yellow">
                {stat.label}
              </p>
              <p className="mt-1 font-heading text-4xl font-bold leading-none tabular-nums text-white">
                {stat.value}
              </p>
            </article>
          ))}
        </div>

        {/* Status stat strip */}
        <div className="mt-4 grid grid-cols-6 gap-3">
          {desktopStatusStats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-border"
            >
              <span className="text-xs font-semibold text-brand-dark/70">
                {stat.label}
              </span>
              <span className="font-heading text-base font-bold tabular-nums text-brand-dark">
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        {/* Full-width population chart */}
        <section className="relative mt-4 rounded-2xl bg-white p-5 ring-1 ring-border">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="font-heading text-lg font-bold text-brand-dark">
                Population
              </p>
              <button
                type="button"
                className="flex items-center gap-1 rounded-full bg-brand-orange px-3 py-1 text-xs font-bold text-white transition-opacity hover:opacity-90"
              >
                Sort by <ChevronDownIcon className="h-3 w-3" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowPeriodMenu((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-dark text-white transition-opacity hover:opacity-90"
              aria-label="Open period menu"
              aria-expanded={showPeriodMenu}
            >
              <span className="-mt-1 text-base font-bold leading-none">...</span>
            </button>
          </div>

          {showPeriodMenu && (
            <div className="absolute right-5 top-14 z-10 w-32 overflow-hidden rounded-xl bg-brand-dark p-1.5 shadow-lg ring-1 ring-brand-dark/10">
              {activePeriods.map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setShowPeriodMenu(false)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10"
                >
                  <span>{period}</span>
                  <span className="text-sm leading-none text-white/70">&#8250;</span>
                </button>
              ))}
            </div>
          )}

          <div className="h-96 rounded-xl bg-brand-cream p-4">
            <VerticalBarChart
              data={populationByLocation}
              title="Catenean Population Summary"
            />
          </div>
        </section>

        {/* Off-census parity row */}
        <div className="mt-6">
          <h2 className="mb-3 font-heading text-lg font-bold text-brand-dark">
            Off-Census
          </h2>
          <div className="grid grid-cols-6 gap-3">
            <article className="col-span-2 rounded-2xl bg-brand-dark px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-yellow">
                Untracked / Overall Total
              </p>
              <p className="mt-1 font-heading text-3xl font-bold leading-none tabular-nums text-white">
                {desktopStats.offCensusTotal}
                <span className="ml-2 text-xl font-semibold text-white/60">
                  / {desktopStats.overallTotal}
                </span>
              </p>
            </article>
            {[
              { label: "Fostered", value: desktopStats.fostered },
              { label: "Adopted", value: desktopStats.adopted },
              { label: "MIA", value: desktopStats.mia },
              { label: "Deceased", value: desktopStats.deceased },
            ].map((item) => (
              <article
                key={item.label}
                className="rounded-2xl bg-white px-4 py-3.5 ring-1 ring-border"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark/60">
                  {item.label}
                </p>
                <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-brand-dark">
                  {item.value}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
