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

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-xs font-medium text-white/70">{label}</span>
      <span className="text-xs font-medium tabular-nums text-white/80">
        {value || "—"}
      </span>
    </div>
  );
}

export function CatalogDetailScreen({ catId }: CatalogDetailScreenProps) {
  const [cat, setCat] = useState<SelectCat | null>(null);
  const [healthRecord, setHealthRecord] =
    useState<SelectCatHealthRecord | null>(null);
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

  const sexColor = (s: string | null | undefined): string => {
    if (s === "Male") return "text-blue-500";
    if (s === "Female") return "text-pink-500";
    return "text-slate-400";
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
      <div className="space-y-4 px-4 py-5">
        <Link
          href="/catalog"
          className="flex items-center gap-0.5 text-sm font-medium text-white/70 transition-opacity hover:opacity-90"
        >
          <span className="text-base leading-none">&lsaquo;</span> Back
        </Link>
        <div className="py-8 text-center text-sm text-white/50">
          Cat not found.
        </div>
      </div>
    );
  }

  const latestIntervention = interventions[0] ?? null;

  const detailFields = [
    { label: "Size/Age", value: cat.age ?? "" },
    { label: "Sex", value: cat.sex ?? "" },
    {
      label: "Neutered",
      value: healthRecord?.neuter_date ? "Yes" : "No",
    },
    { label: "Sociability", value: cat.sociability ?? "" },
    {
      label: "Sick",
      value: healthRecord?.condition?.includes("Sick") ? "Yes" : "No",
    },
    {
      label: "Injured",
      value: healthRecord?.condition?.includes("Injured") ? "Yes" : "No",
    },
    { label: "Adoptable", value: cat.is_adoptable ? "Yes" : "No" },
    { label: "Status", value: cat.cat_status ?? "" },
    {
      label: "Intervention",
      value: latestIntervention
        ? `${latestIntervention.type ?? "—"} (${latestIntervention.status ?? "Pending"})`
        : "",
    },
    { label: "Caretaker", value: cat.caretaker ?? "" },
  ];

  const noteFields = [
    {
      label: "Date Last Seen",
      value: formatDate(cat.last_updated_at),
    },
    { label: "Place Last Seen", value: cat.spot_last_seen ?? "" },
    {
      label: "Date of Kapon",
      value: formatDate(healthRecord?.neuter_date),
    },
    {
      label: "Date of Vaccination",
      value: formatDate(healthRecord?.vaccination_date),
    },
    {
      label: "Intervention Date",
      value: formatDate(latestIntervention?.requested_at),
    },
    { label: "Notes", value: cat.notes ?? "" },
  ];

  return (
    <div className="space-y-5 px-4 py-5">
      {/* Back */}
      <Link
        href="/catalog"
        className="flex items-center gap-0.5 text-sm font-medium text-white/70 transition-opacity hover:opacity-90"
      >
        <span className="text-base leading-none">&lsaquo;</span> Back
      </Link>

      {/* Header */}
      <div className="flex gap-3 overflow-hidden rounded-2xl bg-brand-green">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <ImagePlaceholderIcon className="h-11 w-11 text-white/50" />
        </div>
        <div className="flex flex-col justify-center py-3 pr-3">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold tracking-tight text-white">
              {cat.name || "Unnamed"}
            </span>
            {sexSymbol(cat.sex) ? (
              <span className={`text-base ${sexColor(cat.sex)}`}>
                {sexSymbol(cat.sex)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-white/70">{cat.color || "—"}</p>
          <p className="text-xs text-white/70">{cat.age || "—"}</p>
        </div>
      </div>

      {/* Details */}
      <div>
        <p className="mb-2.5 text-sm font-bold tracking-tight text-white">
          Details
        </p>
        <div className="overflow-hidden rounded-2xl bg-brand-green px-4">
          {detailFields.map((field, i) => (
            <div key={field.label}>
              <FieldRow label={field.label} value={field.value} />
              {i < detailFields.length - 1 ? (
                <div className="border-b border-white/10" />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="mb-2.5 text-sm font-bold tracking-tight text-white">
          Notes
        </p>
        <div className="overflow-hidden rounded-2xl bg-brand-green px-4">
          {noteFields.map((field, i) => (
            <div key={field.label}>
              <FieldRow label={field.label} value={field.value} />
              {i < noteFields.length - 1 ? (
                <div className="border-b border-white/10" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
