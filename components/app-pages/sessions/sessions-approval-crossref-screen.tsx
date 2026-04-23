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
  DiscardSessionDialog,
  MergeDetailsDialog,
} from "@/components/app-pages/sessions/session-dialogs";
import {
  ImagePlaceholderIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";
import { getCats, editCat, removeCat } from "@/app/actions/cats";
import { syncAllPendingRegions } from "@/app/actions/google-sheets";
import { removeSessionCat } from "@/app/actions/sessions";
import type { SelectCat } from "@/lib/validation/cats";
import type { CatEntryStatus } from "@/lib/db/enums";

export function SessionsApprovalCrossRefScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const catId = searchParams.get("catId");
  const sessionId = searchParams.get("sessionId");
  const sessionCatId = searchParams.get("sessionCatId");

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
    if (!catId) {
      setError("Missing cat ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [catResult, allCatsResult] = await Promise.all([
        getCats({ id: catId }),
        getCats({}),
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
    () => (mergeTargetId ? allCats.find((c) => c.id === mergeTargetId) ?? null : null),
    [mergeTargetId, allCats],
  );

  const similarCats = useMemo(() => {
    if (!cat) return [];
    return allCats.filter((c) => {
      if (c.id === cat.id) return false;

      const colorMatch = !!cat.color && c.color === cat.color;
      const ageMatch = !!cat.age && c.age === cat.age;
      const sexMatch = !!cat.sex && c.sex === cat.sex;

      // Show entries that are likely the same cat without being too aggressive.
      const matchCount = [colorMatch, ageMatch, sexMatch].filter(
        Boolean,
      ).length;
      return matchCount >= 2;
    });
  }, [cat, allCats]);

  const handleMerge = useCallback(async () => {
    if (!catId || !mergeTargetId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await editCat({
        id: catId,
        merged_into_id: mergeTargetId,
        entry_status: "Merged" as CatEntryStatus,
      });

      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      syncAllPendingRegions();
      setShowMergeConfirm(false);
      router.push("/dashboard/sessions/manager");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge.");
    } finally {
      setSaving(false);
    }
  }, [catId, mergeTargetId, router]);

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
      syncAllPendingRegions();
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
      if (sessionCatId) {
        const boundRemoveSessionCat = removeSessionCat.bind(null, sessionCatId);
        await boundRemoveSessionCat();
      } else {
        await removeCat({ id: catId });
      }
      syncAllPendingRegions();
      setShowDiscardConfirm(false);
      router.push("/dashboard/sessions/manager");
    } catch (err) {
      console.error("Failed to discard:", err);
      setError("Failed to discard this entry.");
    }
  }, [catId, cat, router, sessionCatId]);

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

          {/* Search bar + Filters */}
          <div className="flex gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-pink-200 bg-brand-cream px-3 py-2">
              <span className="text-sm font-bold text-brand-orange">Search</span>
              <SearchIcon className="h-4 w-4 shrink-0 text-brand-orange" />
            </div>
            <button className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90">
              Filter <span className="text-xs">▼</span>
            </button>
            <button className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90">
              Sort <span className="text-xs">▼</span>
            </button>
          </div>

          {similarCats.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">
              No similar cats found. This is likely a new entry.
            </div>
          ) : (
            <div className="space-y-2">
              {similarCats.map((c) => (
                <div
                  key={c.id}
                  className="overflow-hidden rounded-2xl bg-brand-green"
                >
                  <div className="flex items-stretch gap-0">
                    {/* Full-height image column */}
                    <div className="flex w-28 shrink-0 items-center justify-center bg-white/10">
                      <ImagePlaceholderIcon className="h-10 w-10 text-white/40" />
                    </div>
                    {/* Info */}
                    <div className="flex min-w-0 flex-1 flex-col justify-between px-3.5 py-3 min-h-25">
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="font-heading text-2xl font-bold leading-tight text-brand-yellow truncate">
                            {c.name || "Unnamed"}
                          </span>
                          {sexSymbol(c.sex) ? (
                            <span className="text-white text-lg leading-none ml-1">{sexSymbol(c.sex)}</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm font-bold text-white truncate">
                          {c.color || "—"}{c.age ? ` ${c.age}` : ""}
                        </p>
                      </div>
                      
                      <div>
                        <p className="mt-3 text-sm font-bold text-white truncate">
                          {c.spot_last_seen || "—"} - {formatDate(c.last_updated_at)}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              setMergeTargetId(c.id);
                              setShowMergeConfirm(true);
                            }}
                            className="rounded-full bg-brand-orange px-3 py-1 text-xs font-bold text-white transition-opacity hover:opacity-90"
                          >
                            Merge ›
                          </button>
                          <div className="flex h-7 w-10 items-center justify-center rounded-lg bg-brand-dark text-white shadow-sm">
                            <span className="text-base font-bold">•••</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
              className="rounded-full bg-brand-green px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Census Report <span className="ml-1">📊</span>
            </button>
            <Link
              href={validationHref}
              className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Back <span className="ml-1">&#8249;</span>
            </Link>
          </div>
        </div>

        <section className="mt-4 overflow-hidden rounded-2xl bg-brand-green p-4 ring-1 ring-brand-green">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search"
                className="h-9 w-full rounded-full bg-white/15 px-4 pr-10 text-sm text-white outline-none placeholder:text-white/60"
              />
              <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        ) : null}

        <section className="mt-4 rounded-2xl bg-brand-green p-5 ring-1 ring-brand-green">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <ImagePlaceholderIcon className="h-9 w-9 text-white/50" />
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

              <div className="mt-3 space-y-2">
                {similarCats.length === 0 ? (
                  <div className="py-6 text-center text-sm text-white/50">
                    No similar cats found. This is likely a new entry.
                  </div>
                ) : (
                  similarCats.map((c) => (
                    <div
                      key={`desktop-${c.id}`}
                      className="flex items-center justify-between rounded-xl bg-white/10 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
                          <ImagePlaceholderIcon className="h-5 w-5 text-white/50" />
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
                        onClick={() => {
                          setMergeTargetId(c.id);
                          setShowMergeConfirm(true);
                        }}
                        className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
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

      <MergeDetailsDialog
        open={showMergeConfirm}
        onClose={() => setShowMergeConfirm(false)}
        catA={cat}
        catB={mergeTargetCat}
        onMerge={() => handleMerge()}
        isLoading={saving}
      />

      <ApproveSessionDialog
        open={showApproveConfirm}
        onClose={() => setShowApproveConfirm(false)}
        onConfirm={handleApprove}
        isLoading={saving}
      />

      <DiscardSessionDialog
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleDiscard}
        isLoading={saving}
      />
    </>
  );
}
