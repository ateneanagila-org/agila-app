"use client";

import { useMemo, useState } from "react";
import type { SelectCatHealthRecord } from "@/lib/validation/cats";
import type { CatWithRegion } from "@/lib/repo/cats.repo";
import { HorizontalBarChart } from "@/components/app-pages/shared/charts";
import { LocationPicker } from "@/components/app-pages/shared/location-picker";
import { useRegions } from "@/lib/hooks/use-regions";
import { computeCensusStats } from "@/lib/stats/census-stats";

type OverviewScreenProps = {
  initialCats: CatWithRegion[];
  initialHealthRecords: SelectCatHealthRecord[];
};

function formatLatestUpdate(cats: CatWithRegion[]) {
  const dates = cats
    .map((cat) => cat.last_updated_at)
    .filter(Boolean)
    .map((date) => new Date(date as string | Date).getTime())
    .filter((time) => !Number.isNaN(time));

  if (dates.length === 0) return "MM/DD/YY";

  const latest = new Date(Math.max(...dates));
  return `${String(latest.getMonth() + 1).padStart(2, "0")}/${String(latest.getDate()).padStart(2, "0")}/${latest.getFullYear()}`;
}

export function OverviewScreen({
  initialCats,
  initialHealthRecords,
}: OverviewScreenProps) {
  const regions = useRegions();
  const regionNames = useMemo(
    () => regions.map((r) => r.name).sort((a, b) => a.localeCompare(b)),
    [regions],
  );
  const [dashboardMode, setDashboardMode] = useState("Overall");
  const [location, setLocation] = useState("Overall");
  const allCats = initialCats;
  const allHealthRecords = initialHealthRecords;
  const lastUpdated = useMemo(() => formatLatestUpdate(allCats), [allCats]);

  const filteredCats = useMemo(() => {
    if (location === "Overall") return allCats;
    return allCats.filter((c) => c.region_name === location);
  }, [allCats, location]);

  const stats = useMemo(
    () => computeCensusStats(filteredCats, allHealthRecords),
    [filteredCats, allHealthRecords],
  );

  const desktopCats = useMemo(() => {
    if (dashboardMode === "Overall") return allCats;
    return allCats.filter((c) => c.region_name === dashboardMode);
  }, [allCats, dashboardMode]);

  const desktopStats = useMemo(
    () => computeCensusStats(desktopCats, allHealthRecords),
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
    for (const name of regionNames) {
      counts.set(name, 0);
    }
    for (const cat of allCats) {
      const key = cat.region_name ?? "UNKNOWN";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([label, value]) => ({
      label,
      value,
    }));
  }, [allCats, regionNames]);

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
              <span className="font-medium text-foreground">{lastUpdated}</span>
            </p>
          </div>

          {/* Location picker */}
          <LocationPicker
            value={location}
            options={["Overall", ...regionNames]}
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

          {location === "Overall" ? (
            <>
              {/* Population bar chart */}
              <div className="rounded-xl bg-white p-3 ring-1 ring-border">
                <div className="h-80">
                  <HorizontalBarChart
                    data={populationByLocation}
                    title="Catenean Population Summary"
                  />
                </div>
              </div>
            </>
          ) : null}

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
                  <p className="text-sm font-semibold text-brand-yellow">
                    Untracked
                  </p>
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
              options={["Overall", ...regionNames]}
              onChange={setDashboardMode}
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
              <p className="mt-1 font-heading text-2xl font-bold leading-none tabular-nums text-white lg:text-3xl xl:text-4xl">
                {stat.value}
              </p>
            </article>
          ))}
        </div>

        {/* Status stat strip */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {desktopStatusStats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-border"
            >
              <span className="whitespace-nowrap text-xs font-semibold text-brand-dark/70">
                {stat.label}
              </span>
              <span className="shrink-0 font-heading text-base font-bold tabular-nums text-brand-dark">
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        {/* Full-width population chart — only shown for Overall */}
        {dashboardMode === "Overall" ? (
          <section className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-border">
            <div className="h-[900px] rounded-xl bg-white p-4">
              <HorizontalBarChart
                data={populationByLocation}
                title="Catenean Population Summary"
              />
            </div>
          </section>
        ) : null}

        {/* Off-census parity row */}
        <div className="mt-6">
          <h2 className="mb-3 font-heading text-lg font-bold text-brand-dark">
            Off-Census
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <article className="col-span-2 rounded-2xl bg-brand-dark px-5 py-4 xl:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-yellow">
                Untracked / Overall Total
              </p>
              <p className="mt-1 font-heading text-2xl font-bold leading-none tabular-nums text-white lg:text-3xl">
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
