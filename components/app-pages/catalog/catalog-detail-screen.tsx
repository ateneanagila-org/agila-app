"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { displayCatField } from "@/lib/utils";
import { CatPhoto } from "@/components/app-pages/shared/cat-photo";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
} from "@/components/app-pages/shared/icons";
import { ADOPT_FOSTER_APPLICATION_URL } from "@/lib/constants";
import {
  getAdoptableCats,
  getAdoptableCatHealthRecord,
} from "@/app/actions/cats";

import type { SelectCatHealthRecord } from "@/lib/validation/cats";
import type { CatWithRegion } from "@/lib/repo/cats.repo";

type CatalogDetailScreenProps = {
  catId: string;
};

function sexGlyph(s: string | null | undefined): string | null {
  if (s === "Male") return "♂";
  if (s === "Female") return "♀";
  return null;
}

function YesNoBadge({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-bold tracking-wide ${
        value
          ? "bg-brand-green/12 text-brand-green"
          : "bg-brand-dark/8 text-brand-dark/50"
      }`}
    >
      {value ? "Yes" : "No"}
    </span>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-dark/50">
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-brand-dark">
        {value || "—"}
      </span>
    </div>
  );
}

export function CatalogDetailScreen({ catId }: CatalogDetailScreenProps) {
  const [cat, setCat] = useState<CatWithRegion | null>(null);
  const [healthRecord, setHealthRecord] =
    useState<SelectCatHealthRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catResult, hrResult] = await Promise.all([
        getAdoptableCats({ id: catId }),
        getAdoptableCatHealthRecord({ cat_id: catId }),
      ]);
      if (catResult?.data && catResult.data.length > 0) {
        setCat(catResult.data[0]);
      }
      if (hrResult?.data && hrResult.data.length > 0) {
        setHealthRecord(hrResult.data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch cat detail:", err);
    } finally {
      setLoading(false);
    }
  }, [catId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
      </div>
    );
  }

  if (!cat) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col px-5 pt-6 pb-12 tablet:px-8 tablet:pt-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-dark/60 transition-colors hover:text-brand-dark"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to catalog
        </Link>
        <div className="mt-12 rounded-3xl bg-white px-6 py-16 text-center ring-1 ring-brand-dark/10">
          <p className="font-heading text-2xl font-bold tracking-tight text-brand-dark">
            Cat not found
          </p>
          <p className="mt-2 text-sm text-brand-dark/60">
            This cat could not be found in our catalog.
          </p>
        </div>
      </div>
    );
  }

  const sex = sexGlyph(cat.sex);
  const isNeutered = !!healthRecord?.neuter_date;
  const isVaccinated = !!healthRecord?.vaccination_date;
  const isSick = !!healthRecord?.condition?.includes("Sick");
  const isInjured = !!healthRecord?.condition?.includes("Injured");

  const profileFields: { label: string; value: React.ReactNode }[] = [
    {
      label: "Sex",
      value: cat.sex ? (sex ? `${cat.sex} ${sex}` : cat.sex) : "Unknown",
    },
    { label: "Size / Age", value: displayCatField(cat.age) },
    { label: "Color", value: displayCatField(cat.color) },
    { label: "Sociability", value: displayCatField(cat.sociability) },
    { label: "Region", value: cat.region_name ?? "—" },
  ];

  const healthFields: { label: string; value: React.ReactNode }[] = [
    { label: "Neutered", value: <YesNoBadge value={isNeutered} /> },
    { label: "Vaccinated", value: <YesNoBadge value={isVaccinated} /> },
    { label: "Sick", value: <YesNoBadge value={isSick} /> },
    { label: "Injured", value: <YesNoBadge value={isInjured} /> },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-14 tablet:px-8 tablet:pt-8 tablet:pb-20">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-dark/60 transition-colors hover:text-brand-dark"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back
        </Link>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-orange">
          Adopt &middot; Foster
        </span>
      </div>

      {/* Hero — photo + meta + apply CTA */}
      <div className="grid gap-6 tablet:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] tablet:items-start tablet:gap-10">
        <div className="relative">
          <CatPhoto
            photoUrl={cat.photo_url}
            name={cat.name}
            className="aspect-square w-full overflow-hidden rounded-3xl ring-1 ring-brand-dark/10"
            iconClassName="h-16 w-16 text-brand-green/30"
            sizes="(min-width: 768px) 50vw, 100vw"
          />
        </div>

        <div className="flex flex-col">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange">
            Meet
          </p>
          <h1 className="mt-1 font-heading text-4xl font-bold leading-[1.05] tracking-tight text-brand-dark tablet:text-5xl">
            {cat.name || "Unnamed"}
            {sex ? (
              <span className="ml-2 align-middle text-2xl font-bold text-brand-green tablet:text-3xl">
                {sex}
              </span>
            ) : null}
          </h1>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {cat.color ? (
              <span className="inline-flex h-7 items-center rounded-full bg-brand-cream-dark/60 px-3 text-xs font-semibold text-brand-dark/80">
                {cat.color}
              </span>
            ) : null}
            {cat.age ? (
              <span className="inline-flex h-7 items-center rounded-full bg-brand-cream-dark/60 px-3 text-xs font-semibold text-brand-dark/80">
                {cat.age}
              </span>
            ) : null}
            {cat.sociability ? (
              <span className="inline-flex h-7 items-center rounded-full bg-brand-cream-dark/60 px-3 text-xs font-semibold text-brand-dark/80">
                {cat.sociability}
              </span>
            ) : null}
          </div>

          {cat.spot_last_seen || cat.last_updated_at ? (
            <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-brand-dark/65">
              {cat.spot_last_seen ? (
                <>
                  <span className="font-bold uppercase tracking-wider text-brand-green/80 text-[11px]">
                    Last seen
                  </span>
                  <span className="font-semibold text-brand-dark/80">
                    {cat.spot_last_seen}
                  </span>
                </>
              ) : null}
              {cat.last_updated_at ? (
                <span className="text-xs tabular-nums text-brand-dark/50">
                  · updated{" "}
                  {new Date(cat.last_updated_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              ) : null}
            </p>
          ) : null}

          <a
            href={ADOPT_FOSTER_APPLICATION_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex items-center justify-center gap-2 self-start rounded-full bg-brand-orange px-7 py-3 text-sm font-bold tracking-wide text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            Apply to Adopt/Foster
            <ExternalLinkIcon className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Detail sections */}
      <div className="mt-12 grid gap-5 tablet:grid-cols-2 tablet:gap-6">
        <section className="rounded-3xl bg-white p-5 ring-1 ring-brand-dark/8 tablet:p-6">
          <h2 className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">
            Profile
          </h2>
          <div className="mt-3 divide-y divide-brand-dark/8">
            {profileFields.map((f) => (
              <DetailRow key={f.label} label={f.label} value={f.value} />
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 ring-1 ring-brand-dark/8 tablet:p-6">
          <h2 className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">
            Health
          </h2>
          <div className="mt-3 divide-y divide-brand-dark/8">
            {healthFields.map((f) => (
              <DetailRow key={f.label} label={f.label} value={f.value} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
