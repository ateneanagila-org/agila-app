"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ImagePlaceholderIcon } from "@/components/app-pages/shared/icons";
import { getCats, getCatHealthRecords } from "@/app/actions/cats";

import type { SelectCat, SelectCatHealthRecord } from "@/lib/validation/cats";

type CatalogDetailScreenProps = {
  catId: string;
};

/** Scalloped bottom edge — green bumps into cream below */
function ScallopEdge() {
  return (
    <svg
      viewBox="0 0 400 28"
      preserveAspectRatio="none"
      className="block h-7 w-full"
      aria-hidden="true"
    >
      <path
        d="M0 0 H400 V6 Q380 28 360 6 Q340 28 320 6 Q300 28 280 6 Q260 28 240 6 Q220 28 200 6 Q180 28 160 6 Q140 28 120 6 Q100 28 80 6 Q60 28 40 6 Q20 28 0 6 Z"
        className="fill-brand-green"
      />
    </svg>
  );
}

function GreenField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-brand-yellow">
        {label}
      </p>
      <div className="mt-0.5 text-xs font-bold text-white">{value || "—"}</div>
    </div>
  );
}

export function CatalogDetailScreen({ catId }: CatalogDetailScreenProps) {
  const [cat, setCat] = useState<SelectCat | null>(null);
  const [healthRecord, setHealthRecord] =
    useState<SelectCatHealthRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catResult, hrResult] = await Promise.all([
        getCats({ id: catId }),
        getCatHealthRecords({ cat_id: catId }),
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



  const sexSymbol = (s: string | null | undefined): string | null => {
    if (s === "Male") return "♂";
    if (s === "Female") return "♀";
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
      </div>
    );
  }

  if (!cat) {
    return (
      <div className="flex flex-col">
        <div className="bg-brand-green px-5 pt-5 pb-0">
          <Link
            href="/"
            className="mb-3 flex items-center gap-0.5 text-sm font-medium text-white/70"
          >
            <span className="text-base leading-none">&lsaquo;</span> Back
          </Link>
          <p className="pb-5 text-center font-heading text-2xl font-bold leading-tight tracking-tight text-yellow-200">
            Cat Not Found
          </p>
        </div>
        <ScallopEdge />
        <div className="px-4 py-8 text-center text-sm text-foreground/50">
          This cat could not be found in our catalog.
        </div>
      </div>
    );
  }



  const detailFields = [
    { label: "Size/Age", value: cat.age ?? "—" },
    { label: "Neutered", value: healthRecord?.neuter_date ? "Yes" : "No" },
    {
      label: "Sex",
      value: (
        <span className="flex items-center gap-1">
          {cat.sex || "—"}
          {sexSymbol(cat.sex) && <span>{sexSymbol(cat.sex)}</span>}
        </span>
      ),
    },
    { label: "Vaccinated", value: healthRecord?.vaccination_date ? "Yes" : "No" },
    { label: "Color", value: cat.color || "—" },
    {
      label: "Sick",
      value: healthRecord?.condition?.includes("Sick") ? "Yes" : "No",
    },
    { label: "Sociability", value: cat.sociability || "—" },
    {
      label: "Injured",
      value: healthRecord?.condition?.includes("Injured") ? "Yes" : "No",
    },
  ];



  return (
    <div className="flex flex-col">
      {/* Green hero band */}
      <div className="bg-brand-green">
        <div className="mx-auto w-full max-w-5xl px-5 pt-5 pb-0 tablet:px-8 tablet:pt-8 tablet:pb-2">
          <Link
            href="/"
            className="mb-3 flex items-center gap-0.5 text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            <span className="text-base leading-none">&lsaquo;</span> Back
          </Link>
          <p className="text-center font-heading text-2xl font-bold leading-tight tracking-tight text-brand-yellow tablet:text-4xl">
            ADOPT/FOSTER{cat.name ? ` ${cat.name.toUpperCase()}` : " A CAT"}?
          </p>
          <div className="mt-3 flex justify-center pb-5 tablet:mt-5 tablet:pb-8">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-brand-orange bg-brand-cream px-5 py-2 text-sm font-bold text-brand-orange shadow-sm transition-opacity hover:opacity-90 tablet:px-6 tablet:py-2.5"
            >
              Apply <span className="text-base leading-none">→</span>
            </button>
          </div>
        </div>
      </div>
      <ScallopEdge />

      {/* Content on cream */}
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pt-3 pb-8 tablet:px-8 tablet:pt-6 tablet:pb-12">
        {/* Cat info — green card matching catalog list style */}
        <div className="flex items-stretch gap-0 overflow-hidden rounded-2xl bg-brand-green">
          <div className="flex w-32 shrink-0 items-center justify-center bg-white/10">
            <ImagePlaceholderIcon className="h-12 w-12 text-white/40" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between px-4 py-4 min-h-30">
            <div>
              <div className="flex items-center gap-1">
                <span className="font-heading text-3xl font-bold leading-tight text-brand-yellow truncate">
                  {cat.name || "Unnamed"}
                </span>
                {sexSymbol(cat.sex) ? (
                  <span className="text-white text-2xl leading-none ml-1">{sexSymbol(cat.sex)}</span>
                ) : null}
              </div>
              <p className="mt-1 text-sm font-bold text-white truncate">
                {cat.color || "—"} {cat.age ? ` ${cat.age}` : ""}
              </p>
            </div>
            {/* Arrow indicator */}
            <div className="mt-3 flex w-full items-end justify-end">
              <div className="flex h-8 w-10 items-center justify-center rounded-lg bg-brand-dark text-white shadow-sm">
                <span className="text-lg font-bold leading-none -mt-1">...</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details — green card, 2-col grid */}
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-pink-200" />
            <p className="text-lg font-bold tracking-tight text-brand-orange">
              Details
            </p>
            <div className="h-px flex-1 bg-pink-200" />
          </div>
          <div className="overflow-hidden rounded-2xl bg-brand-green">
            <div className="grid grid-cols-2">
              {detailFields.map((field, i) => {
                const isLastRow = i >= detailFields.length - 2;
                const isLeftCol = i % 2 === 0;
                return (
                  <div
                    key={field.label}
                    className={[
                      "px-4",
                      !isLastRow ? "border-b border-white/10" : "",
                      isLeftCol ? "border-r border-white/10" : "",
                    ].join(" ")}
                  >
                    <GreenField label={field.label} value={field.value} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

