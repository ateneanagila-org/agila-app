"use client";

import { useState, useCallback } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { CatEntryForm } from "@/components/app-pages/shared/cat-entry-form";
import { CatFilterToolbar } from "@/components/app-pages/shared/cat-filter-toolbar";
import type { FilterableCat } from "@/components/app-pages/shared/cat-filter-toolbar";
import { PlusIcon, TrashIcon } from "@/components/app-pages/shared/icons";
import { CatCard } from "@/components/app-pages/shared/cat-card";
import { getCats, getCatHealthRecords, removeCat } from "@/app/actions/cats";
import { getInterventions } from "@/app/actions/interventions";
import type { SelectCatHealthRecord } from "@/lib/validation/cats";
import type { SelectIntervention } from "@/lib/validation/interventions";
import { DATABASE_LIST_CONFIG } from "@/lib/hooks/filter-sort-configs";
import { useAuth } from "@/contexts/auth-context";
import { REFERRAL_SHEET_URL } from "@/lib/constants";

function groupByCatId<T extends { cat_id: string }>(items: T[] | undefined) {
  const grouped = new Map<string, T[]>();
  for (const item of items ?? []) {
    const existing = grouped.get(item.cat_id);
    if (existing) existing.push(item);
    else grouped.set(item.cat_id, [item]);
  }
  return grouped;
}

function uniqueOrUnknown(values: Array<string | null | undefined>) {
  const unique = Array.from(new Set(values.filter(Boolean) as string[]));
  return unique.length > 0 ? unique : ["Unknown"];
}

function addMedicalAndInterventionInfo(
  cats: FilterableCat[],
  healthRecords: SelectCatHealthRecord[] | undefined,
  interventions: SelectIntervention[] | undefined,
): FilterableCat[] {
  const healthByCatId = new Map(
    (healthRecords ?? []).map((record) => [record.cat_id, record]),
  );
  const interventionsByCatId = groupByCatId(interventions);

  return cats.map((cat) => {
    const catInterventions = interventionsByCatId.get(cat.id) ?? [];
    return {
      ...cat,
      condition: healthByCatId.get(cat.id)?.condition ?? "Unknown",
      intervention_type: uniqueOrUnknown(
        catInterventions.map((item) => item.type),
      ),
      intervention_status: uniqueOrUnknown(
        catInterventions.map((item) => item.status),
      ),
    };
  });
}

type DatabaseListScreenProps = {
  initialCats: FilterableCat[];
};

export function DatabaseListScreen({ initialCats }: DatabaseListScreenProps) {
  const { canManage } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [cats, setCats] = useState<FilterableCat[]>(initialCats);
  const [loading, setLoading] = useState(false);
  const [filterDataLoaded, setFilterDataLoaded] = useState(false);
  const [catToDelete, setCatToDelete] = useState<FilterableCat | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchCats = useCallback(async () => {
    setLoading(true);
    try {
      const catsResult = await getCats({ entry_status: "Original" });
      if (catsResult?.data) {
        setCats(catsResult.data);
        setFilterDataLoaded(false);
      }
    } catch (err) {
      console.error("Failed to fetch cats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFilterData = useCallback(() => {
    if (filterDataLoaded || cats.length === 0) return;
    setFilterDataLoaded(true);
    void (async () => {
      try {
        const [healthResult, interventionsResult] = await Promise.allSettled([
          getCatHealthRecords({}),
          getInterventions({}),
        ]);
        const healthRecords =
          healthResult.status === "fulfilled"
            ? healthResult.value?.data
            : undefined;
        const interventions =
          interventionsResult.status === "fulfilled"
            ? interventionsResult.value?.data
            : undefined;
        setCats((currentCats) =>
          addMedicalAndInterventionInfo(
            currentCats,
            healthRecords,
            interventions,
          ),
        );
      } catch {
        // enrichment is best-effort; filters still work on base fields
      }
    })();
  }, [cats.length, filterDataLoaded]);

  const handleSave = useCallback(() => {
    fetchCats();
  }, [fetchCats]);

  const handleDeleteCat = useCallback(async () => {
    if (!catToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await removeCat({ id: catToDelete.id });
      if (result?.serverError) {
        setDeleteError(result.serverError);
        return;
      }
      setCats((currentCats) =>
        currentCats.filter((cat) => cat.id !== catToDelete.id),
      );
      setCatToDelete(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete cat.",
      );
    } finally {
      setDeleting(false);
    }
  }, [catToDelete]);

  const LoadingIndicator = () => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
    </div>
  );

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <p className="text-sm text-brand-dark/80">No cats found.</p>
      <p className="mt-1 text-xs text-brand-dark/60">
        Add a new entry to get started.
      </p>
    </div>
  );

  return (
    <>
      <div className="flex flex-1 flex-col tablet:hidden">
        <div className="flex-1 space-y-3 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-brand-dark">
                Database
              </h1>
              <p className="mt-0.5 text-xs font-semibold text-brand-green">
                {cats.length} cats on record
              </p>
            </div>
            <a
              href={REFERRAL_SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-dark px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Sheets <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <CatFilterToolbar
            cats={cats}
            config={DATABASE_LIST_CONFIG}
            onBeforeOpenFilter={loadFilterData}
          >
            {(filteredCats) =>
              loading ? (
                <LoadingIndicator />
              ) : filteredCats.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
                  {filteredCats.map((cat) => (
                    <div key={cat.id} className="group/cat-card relative">
                      <CatCard
                        cat={cat}
                        region_name={cat.region_name}
                        href={`/dashboard/database/general?id=${cat.id}`}
                        variant="default"
                        action={canManage ? "none" : "chevron"}
                      />
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setCatToDelete(cat);
                          }}
                          className="absolute left-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-orange text-white shadow-md ring-2 ring-white transition-all duration-200 group-hover/cat-card:-translate-y-0.5 hover:scale-105 hover:opacity-90 active:scale-95"
                          aria-label={`Delete ${cat.name || "unnamed cat"}`}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )
            }
          </CatFilterToolbar>
        </div>

        {canManage ? (
          <div className="pointer-events-none fixed bottom-20 right-4 z-10">
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange p-0 leading-none shadow-lg transition-opacity hover:opacity-90"
              aria-label="Add entry"
            >
              <PlusIcon className="h-6 w-6 text-white" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-brand-dark">
              Database
            </h1>
            <p className="mt-1 text-xs font-semibold text-brand-green">
              {cats.length} cats on record
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={REFERRAL_SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full bg-brand-dark px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Sheets
              <ExternalLink className="h-4 w-4" />
            </a>
            {canManage ? (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 rounded-full bg-brand-dark px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                Add entry
                <PlusIcon className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <CatFilterToolbar
            cats={cats}
            config={DATABASE_LIST_CONFIG}
            onBeforeOpenFilter={loadFilterData}
          >
            {(filteredCats) => (
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {loading ? (
                  <div className="col-span-full">
                    <LoadingIndicator />
                  </div>
                ) : filteredCats.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState />
                  </div>
                ) : (
                  filteredCats.map((cat) => (
                    <div
                      key={`desktop-${cat.id}`}
                      className="group/cat-card relative"
                    >
                      <CatCard
                        cat={cat}
                        region_name={cat.region_name}
                        href={`/dashboard/database/general?id=${cat.id}`}
                        variant="default"
                        action={canManage ? "none" : "chevron"}
                      />
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setCatToDelete(cat);
                          }}
                          className="absolute left-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-orange text-white shadow-md ring-2 ring-white transition-all duration-200 group-hover/cat-card:-translate-y-0.5 hover:scale-105 hover:opacity-90 active:scale-95"
                          aria-label={`Delete ${cat.name || "unnamed cat"}`}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            )}
          </CatFilterToolbar>
        </div>
      </div>

      {showAdd ? (
        <CatEntryForm onClose={() => setShowAdd(false)} onSave={handleSave} />
      ) : null}

      {catToDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5 backdrop-blur-[2px]"
          onClick={() => {
            if (!deleting) setCatToDelete(null);
          }}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-2xl bg-brand-cream p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight text-brand-green">
                Delete cat?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-brand-dark/70">
                {catToDelete.name?.trim() || "This unnamed cat"} will be
                permanently removed from the database.
              </p>
            </div>

            {deleteError ? (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {deleteError}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCatToDelete(null)}
                disabled={deleting}
                className="rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCat}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
