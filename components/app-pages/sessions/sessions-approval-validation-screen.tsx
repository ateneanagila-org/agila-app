"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DetailHeader,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import { ChangeConfirmDialog } from "@/components/app-pages/shared/dialogs";
import { CloseIcon } from "@/components/app-pages/shared/icons";
import { CatPhotoButton } from "@/components/app-pages/shared/photo-lightbox";
import { positionFromCat } from "@/lib/photo-position";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  DateInputRow,
  parseDateParts,
  buildDate,
} from "@/components/ui/date-input";
import {
  getCats,
  editCat,
  removeCat,
  getCatHealthRecords,
} from "@/app/actions/cats";
import { normalizeCatField } from "@/lib/utils";
import { neuteredState, triStateLabel, triStateToValue } from "@/lib/health-display";
import type { CatWithRegion } from "@/lib/repo/cats.repo";
import type { SelectCatHealthRecord } from "@/lib/validation/cats";
import type { RegionOption } from "@/lib/repo/regions.repo";
import { useRegions } from "@/lib/hooks/use-regions";
import {
  CAT_COLOR_VALUES,
  CAT_AGE_VALUES,
  CAT_SEX_VALUES,
  CAT_SOCIABILITY_VALUES,
  CAT_STATUS_VALUES,
  CATHEALTHRECORD_CONDITION_VALUES,
} from "@/lib/db/enums";
import type {
  CatColor,
  CatAge,
  CatSex,
  CatSociability,
  CatStatus,
  CatEntryStatus,
  CatHealthRecordCondition,
} from "@/lib/db/enums";

const NEUTERED_OPTIONS = ["Unknown", "Yes", "No"] as const;

/**
 * The cat row as this form holds it. Shared by the server-seeded initial state
 * and by populateForm, so a refetch and a first paint can't disagree about how
 * a null field renders.
 */
function formFromCat(catData: CatWithRegion | null) {
  const dls = parseDateParts(catData?.date_last_seen ?? null);
  return {
    name: catData?.name ?? "",
    color: catData?.color ?? "Unknown",
    age: catData?.age ?? "Unknown",
    sex: catData?.sex ?? "Unknown",
    sociability: catData?.sociability ?? "Unknown",
    catStatus: catData?.cat_status ?? "Unknown",
    caretaker: catData?.caretaker ?? "",
    notes: catData?.notes ?? "",
    spotLastSeen: catData?.spot_last_seen ?? "",
    dlsMonth: dls.month,
    dlsDay: dls.day,
    dlsYear: dls.year,
    regionId: catData?.region_id ?? null,
    regionFallbackName: catData?.region_name ?? "",
  };
}

type SessionsApprovalValidationScreenProps = {
  initialCat: CatWithRegion | null;
  initialHealthRecord: SelectCatHealthRecord | null;
  initialRegions: RegionOption[];
};

export function SessionsApprovalValidationScreen({
  initialCat,
  initialHealthRecord,
  initialRegions,
}: SessionsApprovalValidationScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const catId = searchParams.get("catId");
  const sessionId = searchParams.get("sessionId");
  const sessionCatId = searchParams.get("sessionCatId");

  const [cat, setCat] = useState<CatWithRegion | null>(initialCat);
  // Seeded from the server: nothing to wait for, so no spinner on first paint.
  const [loading, setLoading] = useState(initialCat === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // Form state, seeded from the server render so the fields are filled on first
  // paint rather than after a fetch resolves. Derived once: these values are only
  // read by the useState initializers below, so recomputing them per render would
  // be pure waste.
  const [seed] = useState(() => formFromCat(initialCat));
  const [name, setName] = useState(seed.name);
  const [condition, setCondition] = useState(
    initialHealthRecord?.condition ?? "Unknown",
  );
  const [neutered, setNeutered] = useState(
    triStateLabel(neuteredState(initialHealthRecord?.is_neutered)),
  );
  // Original health-record values (condition/is_neutered live off the cat row) so
  // isDirty can tell an untouched Unknown from a real edit and not skip the save.
  // These must mirror the seeded values above, or an untouched entry reads as
  // dirty and every Next click writes a pointless row to the GSheet sync queue.
  const [origCondition, setOrigCondition] =
    useState<CatHealthRecordCondition | null>(
      initialHealthRecord?.condition ?? null,
    );
  const [origNeutered, setOrigNeutered] = useState<boolean | null>(
    initialHealthRecord?.is_neutered ?? null,
  );
  const [color, setColor] = useState(seed.color);
  const [age, setAge] = useState(seed.age);
  const [sex, setSex] = useState(seed.sex);
  const [sociability, setSociability] = useState(seed.sociability);
  const [catStatus, setCatStatus] = useState(seed.catStatus);
  const [caretaker, setCaretaker] = useState(seed.caretaker);
  const [notes, setNotes] = useState(seed.notes);
  const [spotLastSeen, setSpotLastSeen] = useState(seed.spotLastSeen);
  const [dlsMonth, setDlsMonth] = useState(seed.dlsMonth);
  const [dlsDay, setDlsDay] = useState(seed.dlsDay);
  const [dlsYear, setDlsYear] = useState(seed.dlsYear);
  const [regionId, setRegionId] = useState<string | null>(seed.regionId);
  const [regionFallbackName, setRegionFallbackName] = useState(
    seed.regionFallbackName,
  );

  const regions = useRegions(initialRegions);

  const crossRefHref = catId
    ? `/dashboard/sessions/approval/cross-ref?catId=${catId}${sessionId ? `&sessionId=${sessionId}` : ""}${sessionCatId ? `&sessionCatId=${sessionCatId}` : ""}`
    : "/dashboard/sessions/approval/cross-ref";
  const backHref = "/dashboard/sessions/manager";

  const populateForm = useCallback((catData: CatWithRegion) => {
    const next = formFromCat(catData);
    setName(next.name);
    setColor(next.color);
    setAge(next.age);
    setSex(next.sex);
    setSociability(next.sociability);
    setCatStatus(next.catStatus);
    setCaretaker(next.caretaker);
    setNotes(next.notes);
    setSpotLastSeen(next.spotLastSeen);
    setDlsMonth(next.dlsMonth);
    setDlsDay(next.dlsDay);
    setDlsYear(next.dlsYear);
    setRegionId(next.regionId);
    setRegionFallbackName(next.regionFallbackName);
  }, []);

  const fetchCat = useCallback(async () => {
    if (!catId) {
      setError("Missing cat ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [result, hrResult] = await Promise.all([
        getCats({ id: catId }),
        getCatHealthRecords({ cat_id: catId }),
      ]);
      if (result?.data && result.data.length > 0) {
        const catData = result.data[0];
        setCat(catData);
        populateForm(catData);
        const rec = hrResult?.data?.[0];
        setCondition(rec?.condition ?? "Unknown");
        setNeutered(triStateLabel(neuteredState(rec?.is_neutered)));
        setOrigCondition(rec?.condition ?? null);
        setOrigNeutered(rec?.is_neutered ?? null);
      } else {
        setError("Cat not found.");
      }
    } catch (err) {
      console.error("Failed to fetch cat:", err);
      setError("Failed to load cat data.");
    } finally {
      setLoading(false);
    }
  }, [catId, populateForm]);

  // Seeded-ness is a mount-time fact, same idiom as useRegions: the server
  // already resolved this cat, so re-running the query would only re-render an
  // answer that is on screen. An unseeded mount still fetches, which is what
  // recovers a DB failure that loadData swallowed on the server.
  const seeded = useRef(initialCat !== null);

  useEffect(() => {
    if (seeded.current) return;
    fetchCat();
  }, [fetchCat]);

  /** Approve: save form edits + set entry_status to "Original" */
  const handleApprove = useCallback(async () => {
    if (!catId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await editCat({
        id: catId,
        // Empty text → null (not undefined) so cleared fields persist;
        // Drizzle .set() skips undefined keys, keeping the old value.
        name: name || null,
        condition: normalizeCatField<CatHealthRecordCondition>(condition),
        is_neutered: triStateToValue(neutered),
        color: normalizeCatField<CatColor>(color),
        age: normalizeCatField<CatAge>(age),
        sex: normalizeCatField<CatSex>(sex),
        sociability: normalizeCatField<CatSociability>(sociability),
        cat_status: normalizeCatField<CatStatus>(catStatus),
        caretaker: caretaker || null,
        notes: notes || null,
        spot_last_seen: spotLastSeen || null,
        date_last_seen: buildDate(dlsMonth, dlsDay, dlsYear),
        entry_status: "Original" as CatEntryStatus,
        region_id: regionId,
      });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      setShowSaveConfirm(false);
      router.push("/dashboard/sessions/manager");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve.");
    } finally {
      setSaving(false);
    }
  }, [
    catId,
    name,
    condition,
    neutered,
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
    router,
  ]);

  /**
   * Has the manager changed anything vs the loaded cat? Gates the save-on-Next
   * so clicking through an untouched entry doesn't churn the GSheet sync queue.
   */
  const isDirty = useCallback(() => {
    if (!cat) return false;
    const od = parseDateParts(cat.date_last_seen);
    return (
      (name || "") !== (cat.name ?? "") ||
      normalizeCatField<CatHealthRecordCondition>(condition) !== origCondition ||
      triStateToValue(neutered) !== origNeutered ||
      dlsMonth !== od.month ||
      dlsDay !== od.day ||
      dlsYear !== od.year ||
      normalizeCatField<CatColor>(color) !== (cat.color ?? null) ||
      normalizeCatField<CatAge>(age) !== (cat.age ?? null) ||
      normalizeCatField<CatSex>(sex) !== (cat.sex ?? null) ||
      normalizeCatField<CatSociability>(sociability) !==
        (cat.sociability ?? null) ||
      normalizeCatField<CatStatus>(catStatus) !== (cat.cat_status ?? null) ||
      (caretaker || "") !== (cat.caretaker ?? "") ||
      (notes || "") !== (cat.notes ?? "") ||
      (spotLastSeen || "") !== (cat.spot_last_seen ?? "") ||
      (regionId ?? null) !== (cat.region_id ?? null)
    );
  }, [
    cat,
    name,
    condition,
    neutered,
    origCondition,
    origNeutered,
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
  ]);

  /**
   * Next: persist the validation edits (keeping entry_status unchanged so the
   * cat stays in the review queue), then go to cross-ref. Without this, edits
   * live only in local state and the cross-ref screen re-fetches stale data —
   * breaking the region badge, region filter, and merge diff.
   */
  const handleNext = useCallback(async () => {
    if (!catId) return;
    if (!isDirty()) {
      router.push(crossRefHref);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await editCat({
        id: catId,
        // Empty text → null (not undefined) so cleared fields persist;
        // Drizzle .set() skips undefined keys, keeping the old value.
        name: name || null,
        condition: normalizeCatField<CatHealthRecordCondition>(condition),
        is_neutered: triStateToValue(neutered),
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
      router.push(crossRefHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, [
    catId,
    isDirty,
    crossRefHref,
    name,
    condition,
    neutered,
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
    router,
  ]);

  /** Discard: delete the cat entry entirely (cascade removes session_cats link) */
  const handleDiscard = useCallback(async () => {
    if (!catId) return;
    try {
      const result = await removeCat({ id: catId });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      setShowDiscardConfirm(false);
      router.push("/dashboard/sessions/manager");
    } catch (err) {
      console.error("Failed to discard:", err);
      setError("Failed to discard this entry.");
    }
  }, [catId, router]);

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "—";
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
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
        <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
      </div>
    );
  }

  return (
    <>
      <div className="tablet:hidden">
        <PageContent>
          <DetailHeader
            name={cat?.name || "Unnamed"}
            lastUpdated={formatDate(cat?.last_updated_at)}
            backHref={backHref}
          />

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowDiscardConfirm(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Discard <span>✕</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setShowSaveConfirm(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Approve Instantly <span>✓</span>
            </button>
          </div>

          {/* Separator */}
          <div className="h-px bg-pink-200" />

          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          ) : null}

          {/* Section header */}
          <div className="flex items-center justify-between">
            <p className="font-heading text-xl font-bold text-brand-green">
              Info Validation
            </p>
            <button
              type="button"
              onClick={handleNext}
              disabled={saving}
              className="flex items-center gap-1 rounded-xl bg-brand-dark px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              Next ›
            </button>
          </div>

          {/* Green form card */}
          <div className="overflow-hidden rounded-2xl bg-brand-green p-4">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CatPhotoButton
                  catId={catId ?? ""}
                  photoUrl={cat?.photo_url}
                  name={cat?.name}
                  position={cat ? positionFromCat(cat) : null}
                  canEdit
                  onChanged={fetchCat}
                  className="h-16 w-16 shrink-0 rounded-2xl ring-1 ring-white/20"
                  iconClassName="h-7 w-7 text-white/50"
                  sizes="64px"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-brand-yellow">
                    Last seen at:
                  </p>
                  <p className="mt-1 text-[15px] font-semibold text-white">
                    {formatDate(cat?.date_last_seen)} /{" "}
                    {cat?.spot_last_seen || "—"}
                  </p>
                  {cat?.region_name ? (
                    <span className="mt-2 inline-block rounded-full bg-brand-dark/60 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                      {cat.region_name}
                    </span>
                  ) : null}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-yellow">
                  Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Unnamed"
                  className="mt-1.5 w-full rounded-xl border border-pink-200 bg-brand-cream px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>

              {(
                [
                  {
                    label: "Color",
                    options: ["Unknown", ...CAT_COLOR_VALUES],
                    value: color,
                    onChange: setColor,
                  },
                  {
                    label: "Size/Age",
                    options: ["Unknown", ...CAT_AGE_VALUES],
                    value: age,
                    onChange: setAge,
                  },
                  {
                    label: "Sex",
                    options: ["Unknown", ...CAT_SEX_VALUES],
                    value: sex,
                    onChange: setSex,
                  },
                  {
                    label: "Sociability",
                    options: ["Unknown", ...CAT_SOCIABILITY_VALUES],
                    value: sociability,
                    onChange: setSociability,
                  },
                  {
                    label: "Status",
                    options: ["Unknown", ...CAT_STATUS_VALUES],
                    value: catStatus,
                    onChange: setCatStatus,
                  },
                  {
                    label: "Condition",
                    options: ["Unknown", ...CATHEALTHRECORD_CONDITION_VALUES],
                    value: condition,
                    onChange: setCondition,
                  },
                  {
                    label: "Neutered",
                    options: [...NEUTERED_OPTIONS],
                    value: neutered,
                    onChange: setNeutered,
                  },
                ] as const
              ).map(({ label, options, value, onChange }) => (
                <div key={label}>
                  <label className="text-xs font-bold text-brand-yellow">
                    {label}
                  </label>
                  <div className="mt-1.5">
                    <CustomSelect
                      options={options}
                      value={value}
                      onChange={onChange}
                      variant="cream"
                    />
                  </div>
                </div>
              ))}

              <div>
                <label className="text-xs font-bold text-brand-yellow">
                  Region (override)
                </label>
                <div className="mt-1.5">
                  <CustomSelect
                    options={regions.map((r) => r.name)}
                    value={
                      regions.find((r) => r.id === regionId)?.name ??
                      regionFallbackName
                    }
                    onChange={(name) =>
                      setRegionId(
                        regions.find((r) => r.name === name)?.id ?? null,
                      )
                    }
                    variant="cream"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-yellow">
                  Caretaker
                </label>
                <input
                  value={caretaker}
                  onChange={(e) => setCaretaker(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-pink-200 bg-brand-cream px-3 py-2.5 text-sm text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-brand-yellow">
                  Specific Location
                </label>
                <input
                  value={spotLastSeen}
                  onChange={(e) => setSpotLastSeen(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-pink-200 bg-brand-cream px-3 py-2.5 text-sm text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-brand-yellow">
                  Date Last Seen
                </label>
                <div className="mt-1.5">
                  <DateInputRow
                    month={dlsMonth}
                    day={dlsDay}
                    year={dlsYear}
                    onMonthChange={setDlsMonth}
                    onDayChange={setDlsDay}
                    onYearChange={setDlsYear}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-yellow">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1.5 h-20 w-full resize-none rounded-xl border border-pink-200 bg-brand-cream px-3 py-2.5 text-sm text-slate-900 outline-none"
                />
              </div>
            </div>
          </div>
        </PageContent>
      </div>

      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Sessions
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNext}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-full bg-brand-dark px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              Next <span>&#8250;</span>
            </button>
            <Link
              href={backHref}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-dark/15 bg-white text-brand-dark transition-colors hover:border-brand-dark/40 hover:bg-brand-cream-dark/40"
              aria-label="Back"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        ) : null}

        <section className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-border">
          <div className="flex items-start gap-4">
            <div className="h-20 w-20 shrink-0 rounded-2xl bg-brand-cream-dark">
              <CatPhotoButton
                catId={catId ?? ""}
                photoUrl={cat?.photo_url}
                name={cat?.name}
                position={cat ? positionFromCat(cat) : null}
                canEdit
                onChanged={fetchCat}
                className="h-full w-full rounded-2xl"
                iconClassName="h-9 w-9 text-brand-dark/30"
                sizes="80px"
              />
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-xl font-bold tracking-tight text-foreground">
                      {cat?.name || "Unnamed"}
                    </h3>
                    {sexSymbol(cat?.sex) ? (
                      <span className={`text-xl ${sexColor(cat?.sex)}`}>
                        {sexSymbol(cat?.sex)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cat?.color ? (
                      <span className="rounded-full bg-brand-cream-dark px-2.5 py-0.5 text-xs font-semibold text-brand-dark/70">
                        {cat.color}
                      </span>
                    ) : null}
                    {cat?.age ? (
                      <span className="rounded-full bg-brand-cream-dark px-2.5 py-0.5 text-xs font-semibold text-brand-dark/70">
                        {cat.age}
                      </span>
                    ) : null}
                    {cat?.region_name ? (
                      <span className="rounded-full bg-brand-dark/10 px-2.5 py-0.5 text-xs font-semibold text-brand-dark/70">
                        {cat.region_name}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-brand-dark/60">
                    Last seen: {cat?.spot_last_seen || "—"}
                    {cat?.date_last_seen
                      ? ` · ${formatDate(cat.date_last_seen)}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="font-heading text-xl font-bold text-brand-green">
                  Info Validation
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setShowSaveConfirm(true)}
                    className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    New cat, Approve <span className="ml-1">&#10003;</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDiscardConfirm(true)}
                    className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  >
                    Discard <span className="ml-1">&#10005;</span>
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-brand-dark/50">
                  Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Unnamed"
                  className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-brand-dark outline-none focus:border-gray-300"
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                {(
                  [
                    {
                      label: "Color",
                      options: ["Unknown", ...CAT_COLOR_VALUES],
                      value: color,
                      onChange: setColor,
                    },
                    {
                      label: "Size/Age",
                      options: ["Unknown", ...CAT_AGE_VALUES],
                      value: age,
                      onChange: setAge,
                    },
                    {
                      label: "Sex",
                      options: ["Unknown", ...CAT_SEX_VALUES],
                      value: sex,
                      onChange: setSex,
                    },
                    {
                      label: "Sociability",
                      options: ["Unknown", ...CAT_SOCIABILITY_VALUES],
                      value: sociability,
                      onChange: setSociability,
                    },
                    {
                      label: "Status",
                      options: ["Unknown", ...CAT_STATUS_VALUES],
                      value: catStatus,
                      onChange: setCatStatus,
                    },
                    {
                      label: "Condition",
                      options: ["Unknown", ...CATHEALTHRECORD_CONDITION_VALUES],
                      value: condition,
                      onChange: setCondition,
                    },
                    {
                      label: "Neutered",
                      options: [...NEUTERED_OPTIONS],
                      value: neutered,
                      onChange: setNeutered,
                    },
                    {
                      label: "Region (override)",
                      options: regions.map((r) => r.name),
                      value:
                        regions.find((r) => r.id === regionId)?.name ??
                        regionFallbackName,
                      onChange: (name: string) =>
                        setRegionId(
                          regions.find((r) => r.name === name)?.id ?? null,
                        ),
                    },
                  ] as const
                ).map(({ label, options, value, onChange }) => (
                  <div key={label}>
                    <label className="text-xs font-medium text-brand-dark/50">
                      {label}
                    </label>
                    <div className="mt-1">
                      <CustomSelect
                        options={options}
                        value={value}
                        onChange={onChange}
                        variant="white"
                      />
                    </div>
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-brand-dark/50">
                    Caretaker
                  </label>
                  <input
                    value={caretaker}
                    onChange={(e) => setCaretaker(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-brand-dark outline-none focus:border-gray-300"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-brand-dark/50">
                  Specific Location
                </label>
                <input
                  value={spotLastSeen}
                  onChange={(e) => setSpotLastSeen(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-brand-dark outline-none focus:border-gray-300"
                />
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-brand-dark/50">
                  Date Last Seen
                </label>
                <DateInputRow
                  month={dlsMonth}
                  day={dlsDay}
                  year={dlsYear}
                  onMonthChange={setDlsMonth}
                  onDayChange={setDlsDay}
                  onYearChange={setDlsYear}
                />
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-brand-dark/50">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 h-24 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-brand-dark outline-none focus:border-gray-300"
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      <ChangeConfirmDialog
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard changes?"
        description="This cat entry will be permanently deleted."
        confirmLabel="Discard Entry"
        onConfirm={handleDiscard}
      />

      <ChangeConfirmDialog
        open={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        title="Approve this entry?"
        description="This will approve the cat and mark it as an original entry."
        confirmLabel="Approve"
        onConfirm={handleApprove}
      />
    </>
  );
}
