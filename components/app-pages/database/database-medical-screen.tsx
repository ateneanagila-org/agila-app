"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import {
  DetailHeader,
  TopTabs,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import { CatPhotoButton } from "@/components/app-pages/shared/photo-lightbox";
import { positionFromCat } from "@/lib/photo-position";
import { CustomSelect } from "@/components/ui/custom-select";
import { DateInputRow, parseDateParts, buildDate } from "@/components/ui/date-input";
import { editCat } from "@/app/actions/cats";
import { useAuth } from "@/contexts/auth-context";
import { useCatDetail } from "@/contexts/cat-detail-context";
import type { SelectCatHealthRecord } from "@/lib/validation/cats";
import { CATHEALTHRECORD_CONDITION_VALUES } from "@/lib/db/enums";
import type { CatHealthRecordCondition } from "@/lib/db/enums";
import { normalizeCatField, formatMonthsAgo } from "@/lib/utils";
import { neuteredState, triStateLabel, triStateToValue } from "@/lib/health-display";

function sexGlyph(s: string | null | undefined): string | null {
  if (s === "Male") return "♂";
  if (s === "Female") return "♀";
  return null;
}

const NEUTERED_OPTIONS = ["Unknown", "Yes", "No"] as const;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-orange">
      {children}
    </label>
  );
}

export function DatabaseMedicalScreen() {
  const { canManage } = useAuth();
  const { catId, cat, healthRecord, loading, error: ctxError, refresh } = useCatDetail();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [condition, setCondition] = useState("");
  const [neutered, setNeutered] = useState("Unknown");
  const [neuterMonth, setNeuterMonth] = useState("");
  const [neuterDay, setNeuterDay] = useState("");
  const [neuterYear, setNeuterYear] = useState("");
  const [vaccMonth, setVaccMonth] = useState("");
  const [vaccDay, setVaccDay] = useState("");
  const [vaccYear, setVaccYear] = useState("");

  const populateForm = useCallback((hr: SelectCatHealthRecord) => {
    setCondition(hr.condition ?? "Unknown");
    setNeutered(triStateLabel(neuteredState(hr.is_neutered)));
    const neuter = parseDateParts(hr.neuter_date);
    setNeuterMonth(neuter.month);
    setNeuterDay(neuter.day);
    setNeuterYear(neuter.year);
    const vacc = parseDateParts(hr.vaccination_date);
    setVaccMonth(vacc.month);
    setVaccDay(vacc.day);
    setVaccYear(vacc.year);
  }, []);

  // Hydrate when context healthRecord arrives/changes
  useEffect(() => {
    if (healthRecord) populateForm(healthRecord);
  }, [healthRecord, populateForm]);

  const displayError = error ?? ctxError;

  const handleSave = useCallback(async () => {
    if (!catId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await editCat({
        id: catId,
        condition: normalizeCatField<CatHealthRecordCondition>(condition),
        is_neutered: triStateToValue(neutered),
        neuter_date: buildDate(neuterMonth, neuterDay, neuterYear),
        vaccination_date: buildDate(vaccMonth, vaccDay, vaccYear),
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
    condition,
    neutered,
    neuterMonth,
    neuterDay,
    neuterYear,
    vaccMonth,
    vaccDay,
    vaccYear,
    refresh,
  ]);

  const handleCancel = useCallback(() => {
    if (healthRecord) populateForm(healthRecord);
  }, [healthRecord, populateForm]);

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "—";
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
      </div>
    );
  }

  const sex_glyph = sexGlyph(cat?.sex);

  return (
    <PageContent>
      <DetailHeader
        name={cat?.name || "Unnamed"}
        lastUpdated={formatDate(cat?.last_updated_at)}
        backHref="/dashboard/database"
      />

      {displayError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {displayError}
        </div>
      ) : null}

      {/* Identity card */}
      <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-brand-dark/8">
        <div className="flex flex-col gap-5 p-5 tablet:flex-row tablet:items-center tablet:gap-6 tablet:p-6">
          <div className="h-32 w-32 shrink-0 self-center tablet:h-28 tablet:w-28 tablet:self-auto">
            <CatPhotoButton
              catId={catId ?? ""}
              photoUrl={cat?.photo_url}
              name={cat?.name}
              position={cat ? positionFromCat(cat) : null}
              canEdit={canManage}
              onChanged={refresh}
              className="h-full w-full rounded-2xl ring-1 ring-brand-dark/10"
              iconClassName="h-12 w-12 text-brand-green/30"
              sizes="128px"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-2xl font-bold leading-tight tracking-tight text-brand-dark truncate tablet:text-3xl">
                {cat?.name || "Unnamed"}
              </h2>
              {sex_glyph ? (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-green/12 px-1.5 text-sm font-bold text-brand-green">
                  {sex_glyph}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {cat?.color ? (
                <span className="inline-flex h-6 items-center rounded-full bg-brand-cream-dark/60 px-2.5 text-[11px] font-semibold text-brand-dark/75">
                  {cat.color}
                </span>
              ) : null}
              {cat?.age ? (
                <span className="inline-flex h-6 items-center rounded-full bg-brand-cream-dark/60 px-2.5 text-[11px] font-semibold text-brand-dark/75">
                  {cat.age}
                </span>
              ) : null}
            </div>

            <p className="mt-3 flex items-baseline gap-1.5 text-xs text-brand-dark/60">
              <span className="font-bold uppercase tracking-wider text-brand-green/80 text-[10px]">
                Last seen
              </span>
              <span className="font-semibold text-brand-dark/80">
                {cat?.spot_last_seen || "Unknown"}
              </span>
              {cat?.date_last_seen ? (
                <>
                  <span className="text-brand-dark/30">·</span>
                  <span className="tabular-nums">
                    {formatDate(cat.date_last_seen)}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="border-t border-brand-dark/8 px-5 pt-2 tablet:px-6">
          <TopTabs active="Medical" />
        </div>
      </div>

      {/* Form card */}
      <div className="rounded-3xl bg-white p-5 ring-1 ring-brand-dark/8 tablet:p-6">
        <div className={`grid grid-cols-1 gap-5 tablet:grid-cols-2 tablet:gap-x-6${!canManage ? " pointer-events-none opacity-60" : ""}`}>
          <div className="tablet:col-span-2">
            <FieldLabel>Condition</FieldLabel>
            <div className="mt-1.5">
              <CustomSelect
                options={["Unknown", ...CATHEALTHRECORD_CONDITION_VALUES]}
                value={condition}
                onChange={setCondition}
                variant="white"
              />
            </div>
          </div>

          <div>
            <FieldLabel>Neutered</FieldLabel>
            <div className="mt-1.5">
              <CustomSelect
                options={[...NEUTERED_OPTIONS]}
                value={neutered}
                onChange={setNeutered}
                variant="white"
              />
            </div>
          </div>

          <div>
            <FieldLabel>Neuter Date</FieldLabel>
            <DateInputRow
              month={neuterMonth}
              day={neuterDay}
              year={neuterYear}
              onMonthChange={setNeuterMonth}
              onDayChange={setNeuterDay}
              onYearChange={setNeuterYear}
            />
          </div>

          <div>
            <FieldLabel>Vaccination Date</FieldLabel>
            <DateInputRow
              month={vaccMonth}
              day={vaccDay}
              year={vaccYear}
              onMonthChange={setVaccMonth}
              onDayChange={setVaccDay}
              onYearChange={setVaccYear}
            />
            {healthRecord?.vaccination_date ? (
              <p className="mt-1.5 text-xs text-brand-dark/50">
                Recorded {formatMonthsAgo(healthRecord.vaccination_date)}
              </p>
            ) : null}
          </div>
        </div>

        {canManage ? (
          <div className="mt-6 flex items-center justify-end gap-2 border-t border-brand-dark/8 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border-2 border-brand-dark/15 px-5 py-2 text-sm font-bold text-brand-dark/70 transition-colors hover:border-brand-dark/40 hover:text-brand-dark"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-full bg-brand-orange px-6 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        ) : null}
      </div>
    </PageContent>
  );
}
