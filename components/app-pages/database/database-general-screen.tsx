"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import {
} from "@/components/app-pages/shared/page-frame";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  DateInputRow,
  parseDateParts,
  buildDate,
} from "@/components/ui/date-input";
import { editCat } from "@/app/actions/cats";
import { useAuth } from "@/contexts/auth-context";
import { useCatDetail } from "@/contexts/cat-detail-context";
import { useRegions } from "@/lib/hooks/use-regions";
import { normalizeCatField } from "@/lib/utils";
import {
  DiscardChangesDialog,
  SaveChangesDialog,
} from "@/components/app-pages/database/database-dialogs";
import type { CatWithRegion } from "@/lib/repo/cats.repo";
import {
  CAT_COLOR_VALUES,
  CAT_AGE_VALUES,
  CAT_SEX_VALUES,
  CAT_SOCIABILITY_VALUES,
  CAT_STATUS_VALUES,
} from "@/lib/db/enums";
import type {
  CatColor,
  CatAge,
  CatSex,
  CatSociability,
  CatStatus,
} from "@/lib/db/enums";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-orange">
      {children}
    </label>
  );
}

function FormSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-1.5">
        <CustomSelect
          options={options}
          value={value}
          onChange={onChange}
          variant="white"
        />
      </div>
    </div>
  );
}

export function DatabaseGeneralScreen() {
  const { canManage } = useAuth();
  const { catId, cat, loading, error: ctxError, refresh } = useCatDetail();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [sociability, setSociability] = useState("");
  const [catStatus, setCatStatus] = useState("");
  const [caretaker, setCaretaker] = useState("");
  const [notes, setNotes] = useState("");
  const [spotLastSeen, setSpotLastSeen] = useState("");
  const [dlsMonth, setDlsMonth] = useState("");
  const [dlsDay, setDlsDay] = useState("");
  const [dlsYear, setDlsYear] = useState("");
  const [regionId, setRegionId] = useState<string | null>(null);
  const [regionFallbackName, setRegionFallbackName] = useState("");

  const regions = useRegions();

  const populateForm = useCallback((catData: CatWithRegion) => {
    setName(catData.name ?? "");
    setColor(catData.color ?? "Unknown");
    setAge(catData.age ?? "Unknown");
    setSex(catData.sex ?? "Unknown");
    setSociability(catData.sociability ?? "Unknown");
    setCatStatus(catData.cat_status ?? "Unknown");
    setCaretaker(catData.caretaker ?? "");
    setNotes(catData.notes ?? "");
    setSpotLastSeen(catData.spot_last_seen ?? "");
    const dls = parseDateParts(catData.date_last_seen);
    setDlsMonth(dls.month);
    setDlsDay(dls.day);
    setDlsYear(dls.year);
    setRegionId(catData.region_id ?? null);
    setRegionFallbackName(catData.region_name ?? "");
  }, []);

  // Hydrate form when cat from context resolves/changes
  useEffect(() => {
    if (cat) populateForm(cat);
  }, [cat, populateForm]);

  const displayError = error ?? ctxError;

  const handleSave = useCallback(async () => {
    if (!catId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await editCat({
        id: catId,
        // Empty text → null (not undefined) so cleared fields actually persist;
        // Drizzle .set() skips undefined keys, leaving the old value in place.
        name: name || null,
        color: normalizeCatField<CatColor>(color),
        age: normalizeCatField<CatAge>(age),
        sex: normalizeCatField<CatSex>(sex),
        sociability: normalizeCatField<CatSociability>(sociability),
        cat_status: normalizeCatField<CatStatus>(catStatus),
        caretaker: caretaker || null,
        notes: notes || null,
        spot_last_seen: spotLastSeen || null,
        date_last_seen: buildDate(dlsMonth, dlsDay, dlsYear),
        region_id: regionId,
      });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, [
    catId,
    name,
    color,
    age,
    sex,
    sociability,
    catStatus,
    caretaker,
    notes,
    spotLastSeen,
    dlsMonth,
    dlsDay,
    dlsYear,
    regionId,
    refresh,
  ]);

  const handleCancel = useCallback(() => {
    if (cat) populateForm(cat);
  }, [cat, populateForm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
      </div>
    );
  }

  return (
    <>
      {displayError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {displayError}
        </div>
      ) : null}


        {/* Form card */}
        <div className="rounded-3xl bg-white p-5 ring-1 ring-brand-dark/8 tablet:p-6">
          <div className={`grid grid-cols-1 gap-5 tablet:grid-cols-2 tablet:gap-x-6${!canManage ? " pointer-events-none opacity-60" : ""}`}>
            <div className="tablet:col-span-2">
              <FieldLabel>Name</FieldLabel>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Unnamed"
                className="mt-1.5 h-11 w-full rounded-full border border-brand-dark/15 bg-white px-4 text-sm text-brand-dark outline-none transition-colors placeholder:text-brand-dark/30 focus:border-brand-orange"
              />
            </div>
            <FormSelect
              label="Color"
              options={["Unknown", ...CAT_COLOR_VALUES]}
              value={color}
              onChange={setColor}
            />
            <FormSelect
              label="Size / Age"
              options={["Unknown", ...CAT_AGE_VALUES]}
              value={age}
              onChange={setAge}
            />
            <FormSelect
              label="Sex"
              options={["Unknown", ...CAT_SEX_VALUES]}
              value={sex}
              onChange={setSex}
            />
            <FormSelect
              label="Sociability"
              options={["Unknown", ...CAT_SOCIABILITY_VALUES]}
              value={sociability}
              onChange={setSociability}
            />
            <FormSelect
              label="Status"
              options={["Unknown", ...CAT_STATUS_VALUES]}
              value={catStatus}
              onChange={setCatStatus}
            />
            <FormSelect
              label="Region (override)"
              options={regions.map((r) => r.name)}
              value={
                regions.find((r) => r.id === regionId)?.name ??
                regionFallbackName
              }
              onChange={(name) =>
                setRegionId(regions.find((r) => r.name === name)?.id ?? null)
              }
            />
            <div>
              <FieldLabel>Caretaker</FieldLabel>
              <input
                value={caretaker}
                onChange={(e) => setCaretaker(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-full border border-brand-dark/15 bg-white px-4 text-sm text-brand-dark outline-none transition-colors placeholder:text-brand-dark/30 focus:border-brand-orange"
              />
            </div>
            <div>
              <FieldLabel>Spot Last Seen</FieldLabel>
              <input
                value={spotLastSeen}
                onChange={(e) => setSpotLastSeen(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-full border border-brand-dark/15 bg-white px-4 text-sm text-brand-dark outline-none transition-colors placeholder:text-brand-dark/30 focus:border-brand-orange"
              />
            </div>
            <div>
              <FieldLabel>Date Last Seen</FieldLabel>
              <DateInputRow
                month={dlsMonth}
                day={dlsDay}
                year={dlsYear}
                onMonthChange={setDlsMonth}
                onDayChange={setDlsDay}
                onYearChange={setDlsYear}
              />
            </div>
            <div className="tablet:col-span-2">
              <FieldLabel>Notes</FieldLabel>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="mt-1.5 w-full resize-none rounded-2xl border border-brand-dark/15 bg-white px-4 py-3 text-sm text-brand-dark outline-none transition-colors placeholder:text-brand-dark/30 focus:border-brand-orange"
              />
            </div>
          </div>

          {canManage ? (
            <div className="mt-6 flex items-center justify-end gap-2 border-t border-brand-dark/8 pt-4">
              <button
                type="button"
                onClick={() => setShowDiscardDialog(true)}
                className="rounded-full border-2 border-brand-dark/15 px-5 py-2 text-sm font-bold text-brand-dark/70 transition-colors hover:border-brand-dark/40 hover:text-brand-dark"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowSaveDialog(true)}
                className="rounded-full bg-brand-orange px-6 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          ) : null}
        </div>

      <DiscardChangesDialog
        open={showDiscardDialog}
        onClose={() => setShowDiscardDialog(false)}
        onConfirm={() => {
          handleCancel();
          setShowDiscardDialog(false);
        }}
      />
      <SaveChangesDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onConfirm={() => {
          handleSave();
          setShowSaveDialog(false);
        }}
        isLoading={saving}
      />

    </>
  );
}
