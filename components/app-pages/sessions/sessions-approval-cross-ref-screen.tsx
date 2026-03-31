"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DetailHeader,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import { ChangeConfirmDialog } from "@/components/app-pages/shared/dialogs";
import {
  ChevronDownIcon,
  ImagePlaceholderIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";
import { getCats, editCat, removeCat } from "@/app/actions/cats";
import type { SelectCat } from "@/lib/validation/cats";
import type { CatEntryStatus } from "@/lib/db/enums";

export function SessionsApprovalCrossRefScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const catId = searchParams.get("catId");

  const [cat, setCat] = useState<SelectCat | null>(null);
  const [allCats, setAllCats] = useState<SelectCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!catId) return;
    setLoading(true);
    try {
      const [catResult, allCatsResult] = await Promise.all([
        getCats({ id: catId }),
        getCats({}),
      ]);
      if (catResult?.data && catResult.data.length > 0) {
        setCat(catResult.data[0]);
      }
      if (allCatsResult?.data) {
        setAllCats(allCatsResult.data);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, [catId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Find similar cats for cross-referencing (same color, age, or sex, excluding self) */
  const similarCats = useMemo(() => {
    if (!cat) return [];
    return allCats.filter((c) => {
      if (c.id === cat.id) return false;
      // Consider cats that share at least one attribute as similar
      const colorMatch = cat.color && c.color === cat.color;
      const ageMatch = cat.age && c.age === cat.age;
      const sexMatch = cat.sex && c.sex === cat.sex;
      // Only show if at least 2 attributes match
      const matchCount = [colorMatch, ageMatch, sexMatch].filter(Boolean).length;
      return matchCount >= 2;
    });
  }, [cat, allCats]);

  /** Merge: set current cat as merged into selected target */
  const handleMerge = useCallback(async () => {
    if (!catId || !mergeTargetId) return;
    setSaving(true);
    setError(null);
    try {
      const boundEdit = editCat.bind(null, catId);
      const result = await boundEdit({
        merged_into_id: mergeTargetId,
        entry_status: "Merged" as CatEntryStatus,
      });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      setShowMergeConfirm(false);
      router.push("/sessions/manager");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge.");
    } finally {
      setSaving(false);
    }
  }, [catId, mergeTargetId, router]);

  /** Approve as original (new cat, not a duplicate) */
  const handleApprove = useCallback(async () => {
    if (!catId) return;
    setSaving(true);
    setError(null);
    try {
      const boundEdit = editCat.bind(null, catId);
      const result = await boundEdit({
        entry_status: "Original" as CatEntryStatus,
      });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      setShowApproveConfirm(false);
      router.push("/sessions/manager");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve.");
    } finally {
      setSaving(false);
    }
  }, [catId, router]);

  /** Discard: delete the cat entry entirely */
  const handleDiscard = useCallback(async () => {
    if (!catId) return;
    try {
      const boundRemove = removeCat.bind(null, catId);
      await boundRemove();
      setShowDiscardConfirm(false);
      router.push("/sessions/manager");
    } catch (err) {
      console.error("Failed to discard:", err);
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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
    );
  }

  const validationHref = catId
    ? `/sessions/approval/validation?catId=${catId}`
    : "/sessions/approval/validation";

  return (
    <>
      {/* Mobile */}
      <div className="tablet:hidden">
        <PageContent>
          <DetailHeader
            name={cat?.name || "Unnamed"}
            lastUpdated={formatDate(cat?.last_updated_at)}
            backHref={validationHref}
          />

          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setShowApproveConfirm(true)}
              className="rounded-full bg-stone-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              New cat, Approve
            </button>
            <button
              type="button"
              onClick={() => setShowDiscardConfirm(true)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Discard
            </button>
          </div>

          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          ) : null}

          <p className="text-base font-bold text-slate-900">Cross Reference</p>
          <p className="text-sm text-slate-500">
            Does this cat match an existing entry?
          </p>

          {similarCats.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">
              No similar cats found. This is likely a new entry.
            </div>
          ) : (
            <div className="space-y-2">
              {similarCats.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-xl bg-white p-3.5 ring-1 ring-slate-200"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200">
                    <ImagePlaceholderIcon className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold tracking-tight text-slate-900">
                        {c.name || "Unnamed"}
                      </span>
                      {sexSymbol(c.sex) ? (
                        <span className={`text-sm ${sexColor(c.sex)}`}>
                          {sexSymbol(c.sex)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {c.color || "—"} · {c.age || "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMergeTargetId(c.id);
                      setShowMergeConfirm(true);
                    }}
                    className="shrink-0 rounded-full bg-lime-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-lime-300"
                  >
                    Merge
                  </button>
                </div>
              ))}
            </div>
          )}
        </PageContent>
      </div>

      {/* Desktop */}
      <div className="hidden min-h-full w-full bg-slate-100 p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sessions</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-white px-4 py-1.5 text-sm text-slate-700 ring-1 ring-slate-100 transition-colors hover:bg-slate-50"
            >
              Census Report <span className="ml-1">&#128202;</span>
            </button>
            <button
              type="button"
              className="rounded-full bg-lime-300 px-4 py-1.5 text-sm font-medium text-slate-800 transition-colors hover:bg-lime-400"
            >
              Review Sessions <span className="ml-1">&#9711;</span>
            </button>
          </div>
        </div>

        <section className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-slate-100">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search"
                className="h-9 w-full rounded-full bg-slate-50 px-4 pr-10 text-sm text-slate-800 outline-none"
              />
              <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <button
              type="button"
              className="rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
            >
              Sort by <span className="ml-1">&#9662;</span>
            </button>
            <Link
              href={validationHref}
              className="rounded-full bg-lime-300 px-4 py-1.5 text-sm font-medium text-slate-800 transition-colors hover:bg-lime-400"
            >
              Back <span className="ml-1">&#8249;</span>
            </Link>
          </div>
        </section>

        {error ? (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        ) : null}

        <section className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-slate-100">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200">
              <ImagePlaceholderIcon className="h-9 w-9 text-slate-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold tracking-tight text-slate-900">
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
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                        {cat.color}
                      </span>
                    ) : null}
                    {cat?.age ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                        {cat.age}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    Last seen: {cat?.spot_last_seen || "—"} &middot;{" "}
                    {formatDate(cat?.last_updated_at)}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="inline-block border-b border-slate-300 pb-1 text-base font-semibold text-slate-800">
                  Cross Reference
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setShowApproveConfirm(true)}
                    className="rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700 ring-1 ring-slate-100 transition-colors hover:bg-slate-100 disabled:opacity-50"
                  >
                    New cat, Approve <span className="ml-1">&#10003;</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDiscardConfirm(true)}
                    className="rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700 ring-1 ring-slate-100 transition-colors hover:bg-slate-100"
                  >
                    Discard <span className="ml-1">&#10005;</span>
                  </button>
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-500">
                Does this cat match an existing entry? If so, merge.
              </p>

              <div className="mt-3 space-y-2">
                {similarCats.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-400">
                    No similar cats found. This is likely a new entry.
                  </div>
                ) : (
                  similarCats.map((c) => (
                    <div
                      key={`desktop-${c.id}`}
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200">
                          <ImagePlaceholderIcon className="h-5 w-5 text-slate-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold tracking-tight text-slate-900">
                              {c.name || "Unnamed"}
                            </span>
                            {sexSymbol(c.sex) ? (
                              <span className={`text-sm ${sexColor(c.sex)}`}>
                                {sexSymbol(c.sex)}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {c.color || "—"} · {c.age || "—"} · {c.spot_last_seen || "—"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMergeTargetId(c.id);
                          setShowMergeConfirm(true);
                        }}
                        className="rounded-full bg-lime-200 px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-lime-300"
                      >
                        Merge <span className="ml-1">&#8618;</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <ChangeConfirmDialog
        open={showMergeConfirm}
        onClose={() => setShowMergeConfirm(false)}
        title="Merge this cat?"
        description="This will mark the current entry as a duplicate and merge it into the selected existing cat."
        confirmLabel="Merge"
        onConfirm={handleMerge}
      />

      <ChangeConfirmDialog
        open={showApproveConfirm}
        onClose={() => setShowApproveConfirm(false)}
        title="Approve as new cat?"
        description="This cat will be approved as an original, unique entry."
        confirmLabel="Approve"
        onConfirm={handleApprove}
      />

      <ChangeConfirmDialog
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard changes?"
        description="This cat entry will be permanently deleted."
        confirmLabel="Discard Entry"
        showAvatar
        onConfirm={handleDiscard}
      />
    </>
  );
}
