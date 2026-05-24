"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DetailHeader,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import {
  ApproveSessionDialog,
  DeleteSessionDialog,
  MergeDetailsDialog,
} from "@/components/app-pages/sessions/session-dialogs";
import type { MergeFieldDef } from "@/components/app-pages/sessions/session-dialogs";
import { CatPhoto } from "@/components/app-pages/shared/cat-photo";
import { CatFilterToolbar } from "@/components/app-pages/shared/cat-filter-toolbar";
import {
  getCats,
  editCat,
  removeCat,
  getCatHealthRecords,
} from "@/app/actions/cats";
import type { SelectCat } from "@/lib/validation/cats";
import type { CatWithRegion } from "@/lib/repo/cats.repo";
import type { CatEntryStatus } from "@/lib/db/enums";
import { DATABASE_LIST_CONFIG } from "@/lib/hooks/filter-sort-configs";
import { CENSUS_REPORT_URL } from "@/lib/constants";
import { FileText } from "lucide-react";

function buildMergeDiff(
  newCat: SelectCat,
  targetCat: SelectCat,
  newCondition: string | null,
  targetCondition: string | null,
): { diffFields: MergeFieldDef[]; autoMergedCount: number } {
  const candidates: MergeFieldDef[] = [
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
      label: "Notes",
      fieldKey: "notes",
      currentValue: targetCat.notes ?? null,
      newValue: newCat.notes ?? null,
      inputType: "textarea",
    },
  ];

  const pillCandidates = candidates.filter((f) => f.inputType === "pill");
  const diffFields = [
    ...pillCandidates.filter((f) => f.currentValue !== f.newValue),
    ...candidates.filter((f) => f.inputType === "textarea"),
  ];
  const autoMergedCount = pillCandidates.filter(
    (f) => f.currentValue === f.newValue,
  ).length;

  return { diffFields, autoMergedCount };
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
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [mergeDiffFields, setMergeDiffFields] = useState<MergeFieldDef[]>([]);
  const [mergeAutoMergedCount, setMergeAutoMergedCount] = useState(0);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!catId) {
      setError("Missing cat ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Only reviewed-original cats are valid merge targets; this also
      // keeps payload small as the catalog grows.
      const [catResult, allCatsResult] = await Promise.all([
        getCats({ id: catId }),
        getCats({ entry_status: "Original" }),
      ]);

      if (catResult?.data && catResult.data.length > 0) {
        setCat(catResult.data[0]);
      } else {
        setError("Cat not found.");
      }

      if (allCatsResult?.data) {
        setAllCats(allCatsResult.data);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Failed to load cross-reference data.");
    } finally {
      setLoading(false);
    }
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
      const newCondition = newHRResult?.data?.[0]?.condition ?? null;
      const targetCondition = targetHRResult?.data?.[0]?.condition ?? null;
      const { diffFields, autoMergedCount } = buildMergeDiff(
        cat,
        target,
        newCondition,
        targetCondition,
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
        if (resolved.notes !== undefined)
          updatePayload.notes = resolved.notes ?? undefined;
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
    [catId, mergeTargetId, router],
  );

  const handleApprove = useCallback(async () => {
    if (!catId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await editCat({
        id: catId,
        entry_status: "Original" as CatEntryStatus,
      });

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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
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
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-brand-orange px-4 py-2.5 text-sm font-bold text-brand-orange transition-colors hover:bg-brand-orange hover:text-white"
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

          <CatFilterToolbar cats={allCats} config={DATABASE_LIST_CONFIG}>
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
                      <div className="flex items-stretch gap-0">
                        {/* Full-height image column */}
                        <div className="flex w-28 shrink-0 items-center justify-center bg-white/10">
                          <CatPhoto
                            photoUrl={c.photo_url}
                            name={c.name}
                            className="h-full w-full object-cover"
                            iconClassName="h-8 w-8 text-white/40"
                          />
                        </div>
                        {/* Info */}
                        <div className="flex min-w-0 flex-1 flex-col justify-between px-3.5 py-3 min-h-25">
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="font-heading text-2xl font-bold leading-tight text-brand-yellow truncate">
                                {c.name || "Unnamed"}
                              </span>
                              {sexSymbol(c.sex) ? (
                                <span className="text-white text-lg leading-none ml-1">
                                  {sexSymbol(c.sex)}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm font-bold text-white truncate">
                              {c.color || "—"}
                              {c.age ? ` ${c.age}` : ""}
                            </p>
                          </div>

                          <div>
                            <p className="mt-3 text-sm font-bold text-white truncate">
                              {c.spot_last_seen || "—"} -{" "}
                              {formatDate(c.last_updated_at)}
                            </p>
                            <div className="mt-2 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => handleSelectTarget(c.id)}
                                className="rounded-full bg-brand-orange px-3 py-1 text-xs font-bold text-white transition-opacity hover:opacity-90"
                              >
                                Merge ›
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </CatFilterToolbar>
        </PageContent>
      </div>

      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Sessions
          </h1>
          <div className="flex items-center gap-2">
            <a
              href={CENSUS_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-dark px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Census Report <FileText className="h-4 w-4" />
            </a>
            <Link
              href={validationHref}
              className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Back <span className="ml-1">&#8249;</span>
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        ) : null}

        <section className="mt-4 rounded-2xl bg-brand-green p-5 ring-1 ring-brand-green">
          <div className="flex items-start gap-4">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/15">
              <CatPhoto
                photoUrl={cat?.photo_url}
                name={cat?.name}
                className="h-28 w-28 shrink-0 object-cover"
                iconClassName="h-10 w-10 text-white/40"
              />
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-xl font-bold tracking-tight text-white">
                      {cat?.name || "Unnamed"}
                    </h3>
                    {sexSymbol(cat?.sex) ? (
                      <span className={`text-xl ${sexColor(cat?.sex)}`}>
                        {sexSymbol(cat?.sex)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    {cat?.color ? (
                      <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                        {cat.color}
                      </span>
                    ) : null}
                    {cat?.age ? (
                      <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                        {cat.age}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-white/70">
                    Last seen: {cat?.spot_last_seen || "—"} &middot;{" "}
                    {formatDate(cat?.last_updated_at)}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="inline-block border-b border-white/30 pb-1 text-base font-semibold text-white">
                  Cross Reference
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
                    className="rounded-full border border-brand-orange bg-transparent px-4 py-1.5 text-sm font-bold text-brand-orange transition-opacity hover:opacity-90"
                  >
                    Discard <span className="ml-1">&#10005;</span>
                  </button>
                </div>
              </div>

              <p className="mt-3 text-sm text-white/70">
                Does this cat match an existing entry? If so, merge.
              </p>

              <div className="mt-3">
                <CatFilterToolbar cats={allCats} config={DATABASE_LIST_CONFIG}>
                  {(filteredCats) =>
                    filteredCats.length === 0 ? (
                      <div className="py-6 text-center text-sm text-white/50">
                        No matches.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredCats.map((c) => (
                          <div
                            key={`desktop-${c.id}`}
                            className="flex items-center justify-between rounded-xl bg-white/10 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15">
                                <CatPhoto
                                  photoUrl={c.photo_url}
                                  name={c.name}
                                  className="h-full w-full object-cover"
                                  iconClassName="h-8 w-8 text-white/40"
                                />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-bold tracking-tight text-white">
                                    {c.name || "Unnamed"}
                                  </span>
                                  {sexSymbol(c.sex) ? (
                                    <span className={`text-sm ${sexColor(c.sex)}`}>
                                      {sexSymbol(c.sex)}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-0.5 text-xs text-white/70">
                                  {c.color || "—"} · {c.age || "—"} ·{" "}
                                  {c.spot_last_seen || "—"}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectTarget(c.id)}
                              className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                            >
                              Merge <span className="ml-1">&#8618;</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </CatFilterToolbar>
              </div>
            </div>
          </div>
        </section>
      </div>

      <MergeDetailsDialog
        open={showMergeConfirm}
        onClose={() => setShowMergeConfirm(false)}
        targetName={mergeTargetCat?.name ?? null}
        diffFields={mergeDiffFields}
        autoMergedCount={mergeAutoMergedCount}
        onMerge={handleMerge}
        isLoading={saving}
      />

      <ApproveSessionDialog
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
