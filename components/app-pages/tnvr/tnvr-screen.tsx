"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageContent } from "@/components/app-pages/shared/page-frame";
import { LOCATIONS } from "@/components/app-pages/shared/constants";
import { getCats, getCatHealthRecords } from "@/app/actions/cats";
import type { SelectCat, SelectCatHealthRecord } from "@/lib/validation/cats";

/** Compute TNVR stats from cats + health records */
function computeTnvrStats(
  cats: SelectCat[],
  healthRecords: SelectCatHealthRecord[],
) {
  const hrByCatId = new Map<string, SelectCatHealthRecord>();
  for (const hr of healthRecords) {
    hrByCatId.set(hr.cat_id, hr);
  }

  // Only count cats with entry_status "Original" or "Unreviewed"
  const activeCats = cats.filter(
    (c) => c.entry_status === "Original" || c.entry_status === "Unreviewed",
  );

  let neuteredMale = 0;
  let spayedFemale = 0;
  let neuteredUnknown = 0;
  let unneuteredMale = 0;
  let unneuteredFemale = 0;
  let unneuteredUnknown = 0;
  let totalMale = 0;
  let totalFemale = 0;
  let totalUnknown = 0;

  for (const cat of activeCats) {
    const hr = hrByCatId.get(cat.id);
    const isNeutered = !!hr?.neuter_date;

    if (cat.sex === "Male") {
      totalMale++;
      if (isNeutered) neuteredMale++;
      else unneuteredMale++;
    } else if (cat.sex === "Female") {
      totalFemale++;
      if (isNeutered) spayedFemale++;
      else unneuteredFemale++;
    } else {
      totalUnknown++;
      if (isNeutered) neuteredUnknown++;
      else unneuteredUnknown++;
    }
  }

  const totalNeutered = neuteredMale + spayedFemale + neuteredUnknown;
  const totalUnneutered = unneuteredMale + unneuteredFemale + unneuteredUnknown;
  const total = activeCats.length;

  const pct = (n: number, d: number) =>
    d > 0 ? `${Math.round((n / d) * 100)}%` : "0%";

  return {
    neuteredMale,
    spayedFemale,
    neuteredUnknown,
    unneuteredMale,
    unneuteredFemale,
    unneuteredUnknown,
    totalNeutered,
    totalUnneutered,
    total,
    totalMale,
    totalFemale,
    totalUnknown,
    overallTnvr: pct(totalNeutered, total),
    maleTnvr: pct(neuteredMale, totalMale),
    femaleTnvr: pct(spayedFemale, totalFemale),
    unknownTnvr: pct(neuteredUnknown, totalUnknown),
  };
}

export function TnvrScreen() {
  const [allCats, setAllCats] = useState<SelectCat[]>([]);
  const [allHealthRecords, setAllHealthRecords] = useState<
    SelectCatHealthRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState("All Locations");
  const [desktopLocation, setDesktopLocation] = useState("Overall");
  const [lastUpdated, setLastUpdated] = useState("—");

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
      if (hrResult?.data) {
        setAllHealthRecords(hrResult.data);
      }
    } catch (err) {
      console.error("Failed to fetch TNVR data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Mobile: filter by location
  const mobileCats = useMemo(() => {
    if (location === "All Locations") return allCats;
    return allCats.filter(
      (c) =>
        c.spot_last_seen &&
        c.spot_last_seen.toUpperCase().includes(location.toUpperCase()),
    );
  }, [allCats, location]);

  const mobileStats = useMemo(
    () => computeTnvrStats(mobileCats, allHealthRecords),
    [mobileCats, allHealthRecords],
  );

  // Desktop: filter by location
  const desktopCats = useMemo(() => {
    if (desktopLocation === "Overall") return allCats;
    return allCats.filter(
      (c) =>
        c.spot_last_seen &&
        c.spot_last_seen
          .toUpperCase()
          .includes(desktopLocation.toUpperCase()),
    );
  }, [allCats, desktopLocation]);

  const desktopStats = useMemo(
    () => computeTnvrStats(desktopCats, allHealthRecords),
    [desktopCats, allHealthRecords],
  );

  const tnvrMobileStats = useMemo(
    () => [
      { label: "Neutered Male", value: String(mobileStats.neuteredMale) },
      { label: "Spayed Female", value: String(mobileStats.spayedFemale) },
      {
        label: "Neutered Unknown Sex",
        value: String(mobileStats.neuteredUnknown),
      },
      { label: "Unneutered Male", value: String(mobileStats.unneuteredMale) },
      {
        label: "Unneutered Female",
        value: String(mobileStats.unneuteredFemale),
      },
      {
        label: "Unneutered Unknown Sex",
        value: String(mobileStats.unneuteredUnknown),
      },
    ],
    [mobileStats],
  );

  const mobileTotals = useMemo(
    () => [
      {
        label: "Total Neutered / Spayed",
        value: String(mobileStats.totalNeutered),
        bold: false,
      },
      {
        label: "Total Unneutered",
        value: String(mobileStats.totalUnneutered),
        bold: false,
      },
      {
        label: "Overall Total",
        value: String(mobileStats.total),
        bold: true,
      },
    ],
    [mobileStats],
  );

  const desktopCards = useMemo(
    () => [
      { value: desktopStats.overallTnvr, label: "Overall TNVR %" },
      { value: desktopStats.maleTnvr, label: "Male TNVR %" },
      { value: desktopStats.femaleTnvr, label: "Female TNVR %" },
      { value: desktopStats.unknownTnvr, label: "Unknown TNVR %" },
      { value: String(desktopStats.total), label: "Total Count" },
      { value: String(desktopStats.totalMale), label: "Male" },
      { value: String(desktopStats.totalFemale), label: "Female" },
      { value: String(desktopStats.totalUnknown), label: "Unknown" },
      { value: String(desktopStats.totalNeutered), label: "Neutered" },
      { value: String(desktopStats.neuteredMale), label: "Male" },
      { value: String(desktopStats.spayedFemale), label: "Female" },
      { value: String(desktopStats.neuteredUnknown), label: "Unknown" },
      { value: String(desktopStats.totalUnneutered), label: "Unneutered" },
      { value: String(desktopStats.unneuteredMale), label: "Male" },
      { value: String(desktopStats.unneuteredFemale), label: "Female" },
      { value: String(desktopStats.unneuteredUnknown), label: "Unknown" },
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
                {mobileTotals.map((item) => (
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

            {/* Location Stats */}
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <div className="border-b border-slate-100 bg-white px-4 py-2.5">
                <p className="text-xs font-semibold tracking-wide text-slate-700">
                  Location Details
                </p>
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-100">
                {tnvrMobileStats.map((stat) => (
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
                value={desktopLocation}
                onChange={(e) => setDesktopLocation(e.target.value)}
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
            Last updated: {lastUpdated}
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
          {desktopCards.map((card, index) => (
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
