"use client";

import { useMemo, useState } from "react";
import { PageContent } from "@/components/app-pages/shared/page-frame";
import { LOCATIONS } from "@/components/app-pages/shared/constants";
import type { SelectCat, SelectCatHealthRecord } from "@/lib/validation/cats";
import { ChevronDownIcon } from "@/components/app-pages/shared/icons";
import { PieChart } from "@/components/app-pages/shared/charts";
import { LocationPicker } from "@/components/app-pages/shared/location-picker";

type TnvrScreenProps = {
  initialCats: SelectCat[];
  initialHealthRecords: SelectCatHealthRecord[];
};

function formatLatestUpdate(cats: SelectCat[]) {
  const dates = cats
    .map((cat) => cat.last_updated_at)
    .filter(Boolean)
    .map((date) => new Date(date as string | Date).getTime())
    .filter((time) => !Number.isNaN(time));

  if (dates.length === 0) return "—";

  const latest = new Date(Math.max(...dates));
  return `${String(latest.getMonth() + 1).padStart(2, "0")}/${String(latest.getDate()).padStart(2, "0")}/${latest.getFullYear()}`;
}

/** Compute TNVR stats from cats + health records */
function computeTnvrStats(
  cats: SelectCat[],
  healthRecords: SelectCatHealthRecord[],
) {
  const hrByCatId = new Map<string, SelectCatHealthRecord>();
  for (const hr of healthRecords) {
    hrByCatId.set(hr.cat_id, hr);
  }

  const originalCats = cats.filter((c) => c.entry_status === "Original");

  let neuteredMale = 0;
  let spayedFemale = 0;
  let neuteredUnknown = 0;
  let unneuteredMale = 0;
  let unneuteredFemale = 0;
  let unneuteredUnknown = 0;
  let totalMale = 0;
  let totalFemale = 0;
  let totalUnknown = 0;

  for (const cat of originalCats) {
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
  const total = originalCats.length;

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

// ── Shared sub-components ─────────────────────────────────────────────────────

function GreenStatRow({
  label,
  value,
  labelClass = "text-brand-yellow",
  valueClass = "text-white font-semibold",
}: {
  label: string;
  value: string;
  labelClass?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <p className={`text-xs font-medium ${labelClass}`}>{label}</p>
      <p className={`tabular-nums text-sm ${valueClass}`}>{value}</p>
    </div>
  );
}

function SexSection({
  title,
  total,
  tnvr,
  neuteredLabel,
  neuteredCount,
  unneuteredLabel,
  unneuteredCount,
}: {
  title: string;
  total: number;
  tnvr: string;
  neuteredLabel: string;
  neuteredCount: number;
  unneuteredLabel: string;
  unneuteredCount: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-brand-green">
      {/* Header */}
      <div className="grid grid-cols-2 divide-x divide-white/20 px-0">
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-yellow">
            {title}
          </p>
          <p className="mt-0.5 font-heading text-3xl font-bold leading-none tabular-nums text-white">
            {total}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-yellow">
            TNVR Score
          </p>
          <p className="mt-0.5 font-heading text-3xl font-bold leading-none tabular-nums text-white">
            {tnvr}
          </p>
        </div>
      </div>
      {/* Rows */}
      <div className="divide-y divide-white/10 border-t border-white/10">
        <GreenStatRow label={neuteredLabel} value={String(neuteredCount)} />
        <GreenStatRow label={unneuteredLabel} value={String(unneuteredCount)} />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function TnvrScreen({
  initialCats,
  initialHealthRecords,
}: TnvrScreenProps) {
  const allCats = initialCats;
  const allHealthRecords = initialHealthRecords;
  const [location, setLocation] = useState("All Locations");
  const [desktopLocation, setDesktopLocation] = useState("Overall");
  const lastUpdated = useMemo(() => formatLatestUpdate(allCats), [allCats]);

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

  const isOverall = location === "All Locations";

  // Green family = neutered, warm family = unneutered
  const buildPieData = (s: ReturnType<typeof computeTnvrStats>) => [
    { label: "Neutered Male", value: s.neuteredMale, color: "#1f7d3d" },
    { label: "Spayed Female", value: s.spayedFemale, color: "#4fa86a" },
    { label: "Neutered Unknown", value: s.neuteredUnknown, color: "#a8d4a5" },
    { label: "Unneutered Male", value: s.unneuteredMale, color: "#c94f1f" },
    { label: "Unneutered Female", value: s.unneuteredFemale, color: "#eb8a4e" },
    { label: "Unneutered Unknown", value: s.unneuteredUnknown, color: "#f5c17e" },
  ];
  const mobilePieData = buildPieData(mobileStats);
  const desktopPieData = buildPieData(desktopStats);

  return (
    <>
      {/* ── Mobile ─────────────────────────────────────────────────────── */}
      <div className="tablet:hidden">
        <PageContent>
          <div className="space-y-3">
            {/* Date + title */}
            <div>
              <p className="text-[11px] font-medium text-brand-green">
                Updated {lastUpdated}
              </p>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-brand-green">
                TNVR
              </h1>
            </div>

            {/* Location picker */}
            <LocationPicker
              value={location}
              options={LOCATIONS}
              onChange={setLocation}
              variant="pill"
            />

            {/* Category dropdown — outlined */}
            <div className="relative">
              <select
                className="h-10 w-full appearance-none rounded-xl border border-brand-pink bg-white px-3.5 pr-9 text-sm font-medium text-foreground"
                aria-label="Category"
                defaultValue="all"
              >
                <option value="all">All Categories</option>
                <option value="neutered">Neutered / Spayed</option>
                <option value="unneutered">Unneutered</option>
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-orange" />
            </div>

            {/* TNVR Pie chart */}
            <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-border">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-green">
                  TNVR Statistics
                </p>
              </div>
              <div className="h-72 px-3 pb-4">
                <PieChart data={mobilePieData} />
              </div>
            </div>

            {/* ── Overall mode ──────────────────────────────────────── */}
            {isOverall ? (
              <>
                {/* Hero stat card — Total + TNVR Score */}
                <div className="overflow-hidden rounded-2xl bg-brand-green">
                  <div className="grid grid-cols-2 divide-x divide-white/20">
                    <div className="px-4 py-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-yellow">
                        Total Overall
                      </p>
                      <p className="mt-0.5 font-heading text-4xl font-bold leading-none tabular-nums text-white">
                        {mobileStats.total}
                      </p>
                    </div>
                    <div className="px-4 py-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-yellow">
                        TNVR Score
                      </p>
                      <p className="mt-0.5 font-heading text-4xl font-bold leading-none tabular-nums text-white">
                        {mobileStats.overallTnvr}
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-white/10 border-t border-white/10">
                    <GreenStatRow
                      label="Neutered / Spayed"
                      value={String(mobileStats.totalNeutered)}
                    />
                    <GreenStatRow
                      label="Unneutered"
                      value={String(mobileStats.totalUnneutered)}
                    />
                    <GreenStatRow
                      label="Male"
                      value={String(mobileStats.totalMale)}
                    />
                    <GreenStatRow
                      label="Female"
                      value={String(mobileStats.totalFemale)}
                    />
                    <GreenStatRow
                      label="Unknown Sex"
                      value={String(mobileStats.totalUnknown)}
                    />
                  </div>
                </div>
              </>
            ) : (
              /* ── Location-specific mode ──────────────────────────── */
              <div className="space-y-3">
                <SexSection
                  title="Total Overall"
                  total={mobileStats.total}
                  tnvr={mobileStats.overallTnvr}
                  neuteredLabel="Neutered / Spayed"
                  neuteredCount={mobileStats.totalNeutered}
                  unneuteredLabel="Unneutered"
                  unneuteredCount={mobileStats.totalUnneutered}
                />
                <SexSection
                  title="Total Male"
                  total={mobileStats.totalMale}
                  tnvr={mobileStats.maleTnvr}
                  neuteredLabel="Neutered Male"
                  neuteredCount={mobileStats.neuteredMale}
                  unneuteredLabel="Unneutered Male"
                  unneuteredCount={mobileStats.unneuteredMale}
                />
                <SexSection
                  title="Total Female"
                  total={mobileStats.totalFemale}
                  tnvr={mobileStats.femaleTnvr}
                  neuteredLabel="Spayed Female"
                  neuteredCount={mobileStats.spayedFemale}
                  unneuteredLabel="Unneutered Female"
                  unneuteredCount={mobileStats.unneuteredFemale}
                />
                <SexSection
                  title="Total Unknown Sex"
                  total={mobileStats.totalUnknown}
                  tnvr={mobileStats.unknownTnvr}
                  neuteredLabel="Neutered Unknown"
                  neuteredCount={mobileStats.neuteredUnknown}
                  unneuteredLabel="Unneutered Unknown"
                  unneuteredCount={mobileStats.unneuteredUnknown}
                />
              </div>
            )}
          </div>
        </PageContent>
      </div>

      {/* ── Desktop HI-FI ────────────────────────────────────────────── */}
      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-8">
        <div className="mb-6 flex items-end justify-between gap-5">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-brand-dark">
              TNVR
            </h1>
            <p className="mt-1 text-xs font-semibold text-brand-green">
              Updated{" "}
              <span className="font-medium text-brand-dark/70">{lastUpdated}</span>
            </p>
          </div>
          <div className="w-full max-w-72">
            <LocationPicker
              value={desktopLocation}
              options={["Overall", ...LOCATIONS.filter((l) => l !== "All Locations")]}
              onChange={setDesktopLocation}
              label="Location"
            />
          </div>
        </div>

        {/* Hero TNVR score */}
        <section className="mb-4 overflow-hidden rounded-2xl bg-brand-green">
          <div className="grid grid-cols-4 divide-x divide-white/15">
            {[
              { label: "Overall TNVR %", value: desktopStats.overallTnvr },
              { label: "Male TNVR %", value: desktopStats.maleTnvr },
              { label: "Female TNVR %", value: desktopStats.femaleTnvr },
              { label: "Unknown TNVR %", value: desktopStats.unknownTnvr },
            ].map((card) => (
              <div key={card.label} className="px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-yellow">
                  {card.label}
                </p>
                <p className="mt-1 font-heading text-4xl font-bold leading-none tabular-nums text-white">
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Chart */}
        <section className="rounded-2xl bg-white p-5 ring-1 ring-border">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-heading text-lg font-bold text-brand-dark">
              TNVR Statistics
            </p>
          </div>
          <div className="h-80">
            <PieChart data={desktopPieData} />
          </div>
        </section>

        {/* Sex breakdown — matches mobile SexSection pattern */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          {[
            {
              title: "Total Overall",
              total: desktopStats.total,
              neuteredLabel: "Neutered / Spayed",
              neuteredCount: desktopStats.totalNeutered,
              unneuteredCount: desktopStats.totalUnneutered,
            },
            {
              title: "Male",
              total: desktopStats.totalMale,
              neuteredLabel: "Neutered",
              neuteredCount: desktopStats.neuteredMale,
              unneuteredCount: desktopStats.unneuteredMale,
            },
            {
              title: "Female",
              total: desktopStats.totalFemale,
              neuteredLabel: "Spayed",
              neuteredCount: desktopStats.spayedFemale,
              unneuteredCount: desktopStats.unneuteredFemale,
            },
            {
              title: "Unknown",
              total: desktopStats.totalUnknown,
              neuteredLabel: "Neutered",
              neuteredCount: desktopStats.neuteredUnknown,
              unneuteredCount: desktopStats.unneuteredUnknown,
            },
          ].map((section) => (
            <article
              key={section.title}
              className="overflow-hidden rounded-2xl bg-brand-green"
            >
              <div className="px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-yellow">
                  {section.title}
                </p>
                <p className="mt-1 font-heading text-3xl font-bold leading-none tabular-nums text-white">
                  {section.total}
                </p>
              </div>
              <div className="divide-y divide-white/10 border-t border-white/10">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs font-medium text-brand-yellow">
                    {section.neuteredLabel}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-white">
                    {section.neuteredCount}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs font-medium text-brand-yellow">
                    Unneutered
                  </span>
                  <span className="text-sm font-bold tabular-nums text-white">
                    {section.unneuteredCount}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
