"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DetailHeader,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import {
  ApproveCatDialog,
  DeleteSessionDialog,
  MergeDetailsDialog,
} from "@/components/app-pages/sessions/session-dialogs";
import type { MergeFieldDef } from "@/components/app-pages/sessions/session-dialogs";
import { CatPhoto } from "@/components/app-pages/shared/cat-photo";
import {
  positionFromCat,
  DEFAULT_PHOTO_POSITION,
} from "@/lib/photo-position";
import { CloseIcon } from "@/components/app-pages/shared/icons";
import { CatFilterToolbar } from "@/components/app-pages/shared/cat-filter-toolbar";
import {
  getCats,
  editCat,
  approveCat,
  removeCat,
  getCatHealthRecords,
} from "@/app/actions/cats";
import type { SelectCat } from "@/lib/validation/cats";
import type { CatWithRegion } from "@/lib/repo/cats.repo";
import type { CatEntryStatus } from "@/lib/db/enums";
import { CROSSREF_LIST_CONFIG } from "@/lib/hooks/filter-sort-configs";
import { useRegions } from "@/lib/hooks/use-regions";

function neuteredLabel(v: boolean | null | undefined): string {
  return v === true ? "Yes" : v === false ? "No" : "Unknown";
}

/** The later of two sighting dates (non-null wins; both null → null). Used so a
 *  merge advances the survivor's date_last_seen to the most recent sighting. */
function newerDate(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined,
): Date | null {
  const da = a ? new Date(a) : null;
  const db = b ? new Date(b) : null;
  const va = da && !isNaN(da.getTime()) ? da : null;
  const vb = db && !isNaN(db.getTime()) ? db : null;
  if (!va) return vb;
  if (!vb) return va;
  return va.getTime() >= vb.getTime() ? va : vb;
}

function buildMergeDiff(
  newCat: CatWithRegion,
  targetCat: CatWithRegion,
  newCondition: string | null,
  targetCondition: string | null,
  newNeutered: boolean | null | undefined,
  targetNeutered: boolean | null | undefined,
): { diffFields: MergeFieldDef[]; autoMergedCount: number } {
  const candidates: MergeFieldDef[] = [
    {
      label: "Name",
      fieldKey: "name",
      currentValue: targetCat.name ?? null,
      newValue: newCat.name ?? null,
      inputType: "pill",
    },
    {
      label: "Color",
      fieldKey: "color",
      currentValue: targetCat.color ?? null,
      newValue: newCat.color ?? null,
      inputType: "pill",
    },
    {
      label: "Size/Age",
      fieldKey: "age",
      currentValue: targetCat.age ?? null,
      newValue: newCat.age ?? null,
      inputType: "pill",
    },
    {
      label: "Sex",
      fieldKey: "sex",
      currentValue: targetCat.sex ?? null,
      newValue: newCat.sex ?? null,
      inputType: "pill",
    },
    {
      label: "Sociability",
      fieldKey: "sociability",
      currentValue: targetCat.sociability ?? null,
      newValue: newCat.sociability ?? null,
      inputType: "pill",
    },
    {
      label: "Status",
      fieldKey: "cat_status",
      currentValue: targetCat.cat_status ?? null,
      newValue: newCat.cat_status ?? null,
      inputType: "pill",
    },
    {
      label: "Condition",
      fieldKey: "condition",
      currentValue: targetCondition,
      newValue: newCondition,
      inputType: "pill",
    },
    {
      label: "Neutered",
      fieldKey: "is_neutered",
      currentValue: neuteredLabel(targetNeutered),
      newValue: neuteredLabel(newNeutered),
      inputType: "pill",
    },
    {
      label: "Specific Location",
      fieldKey: "spot_last_seen",
      currentValue: targetCat.spot_last_seen ?? null,
      newValue: newCat.spot_last_seen ?? null,
      inputType: "pill",
    },
    {
      label: "Caretaker",
      fieldKey: "caretaker",
      currentValue: targetCat.caretaker ?? null,
      newValue: newCat.caretaker ?? null,
      inputType: "pill",
    },
    {
      label: "Photo",
      fieldKey: "photo_url",
      currentValue: targetCat.photo_url ?? null,
      newValue: newCat.photo_url ?? null,
      currentPosition: positionFromCat(targetCat),
      newPosition: positionFromCat(newCat),
      inputType: "image",
    },
    {
      label: "Notes",
      fieldKey: "notes",
      currentValue: targetCat.notes ?? null,
      newValue: newCat.notes ?? null,
      inputType: "notes",
    },
  ];

  if (newCat.region_name !== targetCat.region_name) {
    candidates.unshift({
      label: "Region",
      fieldKey: "region_name",
      currentValue: targetCat.region_name ?? null,
      newValue: newCat.region_name ?? null,
      inputType: "pill",
    });
  }

  // A field is a real decision only when the values differ AND the new entry
  // actually contributes a value. When the new side is empty we keep the
  // target's existing value (no-wipe matches handleMerge's `?? undefined`), so
  // it never surfaces as a misleading "New = —" choice. Deliberate clears happen
  // later on the cat's edit screen. Fields that match are auto-merged.
  // "Unknown" counts as empty too: pills store it as null, but neuteredLabel
  // renders null as the literal "Unknown" — without this it would slip through
  // and let a new "Unknown" wipe the target's neutered flag (inconsistent leak).
  const isEmpty = (v: string | null) =>
    v === null || v === "" || v === "Unknown";
  const choiceCandidates = candidates.filter(
    (f) =>
      f.inputType === "pill" ||
      f.inputType === "image" ||
      f.inputType === "notes",
  );
  const diffFields = choiceCandidates.filter(
    (f) => f.currentValue !== f.newValue && !isEmpty(f.newValue),
  );
  const autoMergedCount = choiceCandidates.filter(
    (f) => f.currentValue === f.newValue,
  ).length;

  return { diffFields, autoMergedCount };
}

/** Placeholder cards shown while the (slow) merge-target catalog loads, so the
 *  cross-ref shell + focused-cat header render instantly instead of a blank spinner. */
function MergeListSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-36 animate-pulse rounded-2xl bg-stone-200" />
      ))}
    </div>
  );
}

export function SessionsApprovalCrossRefScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const catId = searchParams.get("catId");
  const sessionId = searchParams.get("sessionId");
  const sessionCatId = searchParams.get("sessionCatId");

  const [cat, setCat] = useState<CatWithRegion | null>(null);
  const [allCats, setAllCats] = useState<CatWithRegion[]>([]);
  const [loading, setLoading] = useState(true);
  // Separate from `loading`: the focused cat (fast) unblocks the shell, while the
  // merge-target catalog (slow — whole Original list + per-row region subquery)
  // streams in behind a skeleton.
  const [listLoading, setListLoading] = useState(true);
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [mergeDiffFields, setMergeDiffFields] = useState<MergeFieldDef[]>([]);
  const [mergeAutoMergedCount, setMergeAutoMergedCount] = useState(0);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regions = useRegions();
  const backHref = "/dashboard/sessions/manager";

  const fetchData = useCallback(async () => {
    if (!catId) {
      setError("Missing cat ID.");
      setLoading(false);
      setListLoading(false);
      return;
    }

    setLoading(true);
    setListLoading(true);
    setError(null);

    // Focused cat — fast (1 row). Resolves on its own so the page shell + header
    // appear immediately instead of waiting on the slow catalog below.
    const catPromise = getCats({ id: catId })
      .then((catResult) => {
        if (catResult?.data && catResult.data.length > 0) {
          setCat(catResult.data[0]);
        } else {
          setError("Cat not found.");
        }
      })
      .catch((err) => {
        console.error("Failed to fetch cat:", err);
        setError("Failed to load cat data.");
      })
      .finally(() => setLoading(false));

    // Merge targets — only reviewed-original cats are valid. Slow (whole catalog
    // + per-row region subquery), so it loads independently behind a skeleton.
    const listPromise = getCats({ entry_status: "Original" })
      .then((allCatsResult) => {
        if (allCatsResult?.data) setAllCats(allCatsResult.data);
      })
      .catch((err) => {
        console.error("Failed to fetch merge targets:", err);
      })
      .finally(() => setListLoading(false));

    await Promise.allSettled([catPromise, listPromise]);
  }, [catId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const mergeTargetCat = useMemo(
    () =>
      mergeTargetId
        ? (allCats.find((c) => c.id === mergeTargetId) ?? null)
        : null,
    [mergeTargetId, allCats],
  );

  const defaultRegionFilter = useMemo(
    () =>
      cat?.region_name
        ? { region_name: new Set([cat.region_name]) }
        : undefined,
    [cat?.region_name],
  );

  const handleSelectTarget = useCallback(
    async (targetId: string) => {
      if (!catId || !cat) return;
      setMergeTargetId(targetId);
      const target = allCats.find((c) => c.id === targetId);
      if (!target) return;
      const [newHRResult, targetHRResult] = await Promise.all([
        getCatHealthRecords({ cat_id: catId }),
        getCatHealthRecords({ cat_id: targetId }),
      ]);
      const newHR = newHRResult?.data?.[0];
      const targetHR = targetHRResult?.data?.[0];
      const newCondition = newHR?.condition ?? null;
      const targetCondition = targetHR?.condition ?? null;
      const { diffFields, autoMergedCount } = buildMergeDiff(
        cat,
        target,
        newCondition,
        targetCondition,
        newHR?.is_neutered,
        targetHR?.is_neutered,
      );
      setMergeDiffFields(diffFields);
      setMergeAutoMergedCount(autoMergedCount);
      setShowMergeConfirm(true);
    },
    [catId, cat, allCats],
  );

  const handleMerge = useCallback(
    async (resolved: Record<string, string | null>) => {
      if (!catId || !mergeTargetId) return;
      setSaving(true);
      setError(null);
      try {
        // Step 1: update original with manager-selected field values
        const updatePayload: Parameters<typeof editCat>[0] = {
          id: mergeTargetId,
        };
        if (resolved.color !== undefined)
          updatePayload.color =
            (resolved.color as SelectCat["color"]) ?? undefined;
        if (resolved.age !== undefined)
          updatePayload.age = (resolved.age as SelectCat["age"]) ?? undefined;
        if (resolved.sex !== undefined)
          updatePayload.sex = (resolved.sex as SelectCat["sex"]) ?? undefined;
        if (resolved.sociability !== undefined)
          updatePayload.sociability =
            (resolved.sociability as SelectCat["sociability"]) ?? undefined;
        if (resolved.cat_status !== undefined)
          updatePayload.cat_status =
            (resolved.cat_status as SelectCat["cat_status"]) ?? undefined;
        if (resolved.condition !== null && resolved.condition !== undefined)
          updatePayload.condition = resolved.condition as
            | "Healthy"
            | "Sick"
            | "Injured"
            | "Sick and Injured";
        if (resolved.name !== undefined)
          updatePayload.name =
            (resolved.name as SelectCat["name"]) ?? undefined;
        if (resolved.photo_url !== undefined) {
          const chosenUrl =
            (resolved.photo_url as SelectCat["photo_url"]) ?? undefined;
          updatePayload.photo_url = chosenUrl;
          // Carry the chosen photo's crop so the survivor frames it the same way.
          const src =
            chosenUrl && cat?.photo_url === chosenUrl
              ? cat
              : chosenUrl && mergeTargetCat?.photo_url === chosenUrl
                ? mergeTargetCat
                : null;
          const pos = src ? positionFromCat(src) : DEFAULT_PHOTO_POSITION;
          updatePayload.photo_zoom = pos.zoom;
          updatePayload.photo_offset_x = pos.offsetX;
          updatePayload.photo_offset_y = pos.offsetY;
        }
        if (resolved.notes !== undefined)
          updatePayload.notes = resolved.notes ?? undefined;
        if (resolved.spot_last_seen !== undefined)
          updatePayload.spot_last_seen = resolved.spot_last_seen ?? undefined;
        if (resolved.caretaker !== undefined)
          updatePayload.caretaker = resolved.caretaker ?? undefined;
        if (resolved.is_neutered !== undefined) {
          updatePayload.is_neutered =
            resolved.is_neutered === "Yes"
              ? true
              : resolved.is_neutered === "No"
                ? false
                : null;
        }
        if (resolved.region_name !== undefined) {
          updatePayload.region_id =
            regions.find((r) => r.name === resolved.region_name)?.id ?? null;
        }
        // Last seen advances to the most recent sighting across both records —
        // not a manager choice; "last seen" is just the latest known date.
        // Advance-only: never set (and so never clear) when neither has a date.
        const advancedLastSeen = newerDate(
          mergeTargetCat?.date_last_seen,
          cat?.date_last_seen,
        );
        if (advancedLastSeen) updatePayload.date_last_seen = advancedLastSeen;
        const step1 = await editCat(updatePayload);
        if (step1?.serverError) {
          setError(step1.serverError);
          return;
        }
        // Step 2: mark duplicate as merged
        const step2 = await editCat({
          id: catId,
          merged_into_id: mergeTargetId,
          entry_status: "Merged" as CatEntryStatus,
        });
        if (step2?.serverError) {
          setError(step2.serverError);
          return;
        }
        setShowMergeConfirm(false);
        router.push("/dashboard/sessions/manager");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to merge.");
      } finally {
        setSaving(false);
      }
    },
    [catId, mergeTargetId, regions, router, cat, mergeTargetCat],
  );

  const handleApprove = useCallback(async () => {
    if (!catId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await approveCat({ id: catId });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      setShowApproveConfirm(false);
      router.push("/dashboard/sessions/manager");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve.");
    } finally {
      setSaving(false);
    }
  }, [catId, router]);

  const handleDiscard = useCallback(async () => {
    if (!catId || !cat) return;
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
  }, [catId, cat, router]);

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

  const validationHref = catId
    ? `/dashboard/sessions/approval/validation?catId=${catId}${sessionId ? `&sessionId=${sessionId}` : ""}${sessionCatId ? `&sessionCatId=${sessionCatId}` : ""}`
    : "/dashboard/sessions/approval/validation";

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
            backHref={validationHref}
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
              onClick={() => setShowApproveConfirm(true)}
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
              Cross-Reference
            </p>
            <Link
              href={validationHref}
              className="flex items-center gap-1 rounded-xl bg-brand-dark px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-80"
            >
              ‹ Previous
            </Link>
          </div>

          <p className="text-xs text-slate-500">
            Check if this is a duplicate and merge accordingly.
          </p>

          {listLoading ? (
            <MergeListSkeleton />
          ) : (
            <CatFilterToolbar
              cats={allCats}
              config={CROSSREF_LIST_CONFIG}
              initialFilters={defaultRegionFilter}
            >
            {(filteredCats) =>
              filteredCats.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">
                  No matches.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCats.map((c) => (
                    <div
                      key={c.id}
                      className="overflow-hidden rounded-2xl bg-brand-green"
                    >
                      <div className="flex h-36 gap-0">
                        <div className="relative aspect-square h-full shrink-0 overflow-hidden bg-white/10">
                          <CatPhoto
                            photoUrl={c.photo_url}
                            name={c.name}
                            position={positionFromCat(c)}
                            fit="cover"
                            className="absolute inset-0 h-full w-full"
                            iconClassName="h-8 w-8 text-white/40"
                          />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col px-3.5 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1">
                              <span className="font-heading text-2xl font-bold leading-tight text-brand-yellow truncate">
                                {c.name || "Unnamed"}
                              </span>
                              {sexSymbol(c.sex) ? (
                                <span className="text-white text-lg leading-none">
                                  {sexSymbol(c.sex)}
                                </span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectTarget(c.id)}
                              className="shrink-0 rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                            >
                              Merge ›
                            </button>
                          </div>
                          <p className="mt-1 text-sm font-bold text-white truncate">
                            {c.color || "—"}
                            {c.age ? ` ${c.age}` : ""}
                          </p>
                          {c.region_name ? (
                            <span className="mt-1 w-fit rounded-full bg-brand-dark/60 px-2 py-0.5 text-xs font-semibold text-white/80">
                              {c.region_name}
                            </span>
                          ) : null}
                          <p className="mt-2 text-sm font-bold text-white truncate">
                            {c.spot_last_seen || "—"} ·{" "}
                            {formatDate(c.date_last_seen)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
            </CatFilterToolbar>
          )}
        </PageContent>
      </div>

      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Sessions
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href={validationHref}
              className="flex items-center gap-1.5 rounded-full bg-brand-dark px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-80"
            >
              <span>&#8249;</span> Previous
            </Link>
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
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-cream-dark">
              <CatPhoto
                photoUrl={cat?.photo_url}
                name={cat?.name}
                position={cat ? positionFromCat(cat) : null}
                className="h-28 w-28 shrink-0"
                iconClassName="h-10 w-10 text-brand-dark/30"
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
                  Cross-Reference
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setShowApproveConfirm(true)}
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

              <p className="mt-3 text-sm text-brand-dark/60">
                Does this cat match an existing entry? If so, merge.
              </p>

              <div className="mt-3">
                {listLoading ? (
                  <MergeListSkeleton />
                ) : (
                  <CatFilterToolbar
                    cats={allCats}
                    config={CROSSREF_LIST_CONFIG}
                    initialFilters={defaultRegionFilter}
                  >
                  {(filteredCats) =>
                    filteredCats.length === 0 ? (
                      <div className="py-6 mt-2 text-center text-sm text-brand-dark/40">
                        No matches.
                      </div>
                    ) : (
                      <div className="space-y-2 mt-2">
                        {filteredCats.map((c) => (
                          <div
                            key={`desktop-${c.id}`}
                            className="overflow-hidden rounded-2xl bg-brand-green"
                          >
                            <div className="flex h-36 gap-0">
                              <div className="relative aspect-square h-full shrink-0 overflow-hidden bg-white/10">
                                <CatPhoto
                                  photoUrl={c.photo_url}
                                  name={c.name}
                                  position={positionFromCat(c)}
                                  fit="cover"
                                  className="absolute inset-0 h-full w-full"
                                  iconClassName="h-7 w-7 text-white/40"
                                />
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col px-3.5 py-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-1">
                                    <span className="truncate font-heading text-lg font-bold leading-tight text-brand-yellow">
                                      {c.name || "Unnamed"}
                                    </span>
                                    {sexSymbol(c.sex) ? (
                                      <span className="text-base leading-none text-white">
                                        {sexSymbol(c.sex)}
                                      </span>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectTarget(c.id)}
                                    className="shrink-0 rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                                  >
                                    Merge ›
                                  </button>
                                </div>
                                <p className="mt-0.5 text-sm font-bold text-white truncate">
                                  {c.color || "—"}
                                  {c.age ? ` ${c.age}` : ""}
                                </p>
                                {c.region_name ? (
                                  <span className="mt-1 w-fit rounded-full bg-brand-dark/60 px-2 py-0.5 text-xs font-semibold text-white/80">
                                    {c.region_name}
                                  </span>
                                ) : null}
                                <p className="mt-2 text-sm font-bold text-white truncate">
                                  {c.spot_last_seen || "—"} ·{" "}
                                  {formatDate(c.date_last_seen)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  }
                  </CatFilterToolbar>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <MergeDetailsDialog
        open={showMergeConfirm}
        onClose={() => setShowMergeConfirm(false)}
        targetName={mergeTargetCat?.name ?? null}
        newName={cat?.name ?? null}
        diffFields={mergeDiffFields}
        autoMergedCount={mergeAutoMergedCount}
        onMerge={handleMerge}
        isLoading={saving}
      />

      <ApproveCatDialog
        open={showApproveConfirm}
        onClose={() => setShowApproveConfirm(false)}
        onConfirm={handleApprove}
        isLoading={saving}
      />

      <DeleteSessionDialog
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleDiscard}
        isLoading={saving}
      />
    </>
  );
}
