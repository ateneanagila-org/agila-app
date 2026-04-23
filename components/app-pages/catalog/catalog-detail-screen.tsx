"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ImagePlaceholderIcon } from "@/components/app-pages/shared/icons";
import { getCats, getCatHealthRecords } from "@/app/actions/cats";
import { getInterventions } from "@/app/actions/interventions";
import type { SelectCat, SelectCatHealthRecord } from "@/lib/validation/cats";
import type { SelectIntervention } from "@/lib/validation/interventions";

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

function GreenField({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-white">{value || "—"}</p>
    </div>
  );
}


export function CatalogDetailScreen({ catId }: CatalogDetailScreenProps) {
  const [cat, setCat] = useState<SelectCat | null>(null);
  const [healthRecord, setHealthRecord] = useState<SelectCatHealthRecord | null>(null);
  const [interventions, setInterventions] = useState<SelectIntervention[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catResult, hrResult, interventionsResult] = await Promise.all([
        getCats({ id: catId }),
        getCatHealthRecords({ cat_id: catId }),
        getInterventions({ cat_id: catId }),
      ]);
      if (catResult?.data && catResult.data.length > 0) {
        setCat(catResult.data[0]);
      }
      if (hrResult?.data && hrResult.data.length > 0) {
        setHealthRecord(hrResult.data[0]);
      }
      if (interventionsResult?.data) {
        const sorted = [...interventionsResult.data].sort((a, b) => {
          const aTime = a.requested_at ? new Date(a.requested_at).getTime() : 0;
          const bTime = b.requested_at ? new Date(b.requested_at).getTime() : 0;
          return bTime - aTime;
        });
        setInterventions(sorted);
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

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "—";
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  };

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
          <Link href="/" className="mb-3 flex items-center gap-0.5 text-sm font-medium text-white/70">
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

  const latestIntervention = interventions[0] ?? null;

  // 10 fields → 5 rows × 2 cols
  const detailFields = [
    { label: "Size/Age",    value: cat.age ?? "" },
    { label: "Injured",     value: healthRecord?.condition?.includes("Injured") ? "Yes" : "No" },
    { label: "Neutered",    value: healthRecord?.neuter_date ? "Yes" : "No" },
    { label: "Adoptable",   value: cat.is_adoptable ? "Yes" : "No" },
    { label: "Tame",        value: cat.sociability ?? "" },
    { label: "Status",      value: cat.cat_status ?? "" },
    { label: "Sick",        value: healthRecord?.condition?.includes("Sick") ? "Yes" : "No" },
    { label: "Caretaker",   value: cat.caretaker ?? "" },
    { label: "Sex",         value: cat.sex ?? "" },
    { label: "Intervention",value: latestIntervention ? `${latestIntervention.type ?? "—"}` : "" },
  ];

  // 6 fields → 3 rows × 2 cols (notes spans right col)
  const noteColLeft = [
    { label: "Date Last Seen",       value: formatDate(cat.last_updated_at) },
    { label: "Place Last Seen",      value: cat.spot_last_seen ?? "" },
    { label: "Date of Kapon",        value: formatDate(healthRecord?.neuter_date) },
    { label: "Date of Vaccination",  value: formatDate(healthRecord?.vaccination_date) },
  ];

  return (
    <div className="flex flex-col">
      {/* Green hero band */}
      <div className="bg-brand-green px-5 pt-5 pb-0">
        <Link href="/" className="mb-3 flex items-center gap-0.5 text-sm font-medium text-white/70">
          <span className="text-base leading-none">&lsaquo;</span> Back
        </Link>
        <p className="text-center font-heading text-2xl font-bold leading-tight tracking-tight text-yellow-200">
          ADOPT/FOSTER{cat.name ? ` ${cat.name.toUpperCase()}` : " A CAT"}?
        </p>
        <div className="mt-3 flex justify-center pb-5">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full bg-brand-orange px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Apply <span className="text-base leading-none">🔗</span>
          </button>
        </div>
      </div>
      <ScallopEdge />

      {/* Content on cream */}
      <div className="flex flex-col gap-5 px-4 pt-3 pb-8">

        {/* Cat info — green card matching catalog list style */}
        <div className="flex items-center gap-0 overflow-hidden rounded-2xl bg-brand-green">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center bg-white/10">
            <ImagePlaceholderIcon className="h-8 w-8 text-white/40" />
          </div>
          <div className="px-3 py-2">
            <div className="flex items-center gap-1">
              <span className="text-base font-bold tracking-tight text-white">
                {cat.name || "Unnamed"}
              </span>
              {sexSymbol(cat.sex) ? (
                <span className="text-base font-bold text-white/70">
                  {sexSymbol(cat.sex)}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-white/70">{cat.color || "—"}</p>
            <p className="text-xs text-white/60">{cat.age || "—"}</p>
          </div>
        </div>

        {/* Details — green card, 2-col grid */}
        <div>
          <p className="mb-2 text-base font-bold tracking-tight text-brand-orange">Details</p>
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

        {/* Notes — green card matching Details */}
        <div>
          <p className="mb-2 text-base font-bold tracking-tight text-brand-orange">Notes</p>
          <div className="overflow-hidden rounded-2xl bg-brand-green">
            <div className="grid grid-cols-2">
              {/* Left col: date fields */}
              <div className="divide-y divide-white/10 border-r border-white/10">
                {noteColLeft.map((field) => (
                  <div key={field.label} className="px-4">
                    <GreenField label={field.label} value={field.value} />
                  </div>
                ))}
              </div>
              {/* Right col: notes text */}
              <div className="px-4 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Notes</p>
                <p className="mt-0.5 text-xs text-white/80 leading-relaxed">
                  {cat.notes || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
