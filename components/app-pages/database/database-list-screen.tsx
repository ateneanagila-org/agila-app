"use client";

import { useState, useEffect, useCallback } from "react";
import { CatEntryForm } from "@/components/app-pages/shared/cat-entry-form";
import { CatFilterToolbar } from "@/components/app-pages/shared/cat-filter-toolbar";
import type { FilterableCat } from "@/components/app-pages/shared/cat-filter-toolbar";
import { PlusIcon } from "@/components/app-pages/shared/icons";
import { CatCard } from "@/components/app-pages/shared/cat-card";
import { getCats, getCatHealthRecords } from "@/app/actions/cats";
import { getInterventions } from "@/app/actions/interventions";
import type { SelectCatHealthRecord } from "@/lib/validation/cats";
import type { SelectIntervention } from "@/lib/validation/interventions";
import { DATABASE_LIST_CONFIG } from "@/lib/hooks/filter-sort-configs";
import { useAuth } from "@/contexts/auth-context";

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

export function DatabaseListScreen() {
  const { canManage } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [cats, setCats] = useState<FilterableCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDataLoaded, setFilterDataLoaded] = useState(false);

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

  const loadFilterData = useCallback(async () => {
    if (filterDataLoaded || cats.length === 0) return;

    try {
      const [healthResult, interventionsResult] = await Promise.allSettled([
        getCatHealthRecords({}),
        getInterventions({}),
      ]);

      const healthRecords =
        healthResult.status === "fulfilled" ? healthResult.value?.data : undefined;
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
    } finally {
      setFilterDataLoaded(true);
    }
  }, [cats.length, filterDataLoaded]);

  useEffect(() => {
    fetchCats();
  }, [fetchCats]);

  const handleSave = useCallback(() => {
    fetchCats();
  }, [fetchCats]);

  const LoadingIndicator = () => (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
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
          {canManage ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-dark py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Add Entry <PlusIcon className="h-4 w-4" />
            </button>
          ) : null}

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
                <div className="grid grid-cols-2 gap-3">
                  {filteredCats.map((cat) => (
                    <CatCard
                      key={cat.id}
                      cat={cat}
                      region_name={cat.region_name}
                      href={`/dashboard/database/general?id=${cat.id}`}
                      variant="default"
                      action="kebab"
                    />
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

        <div className="mt-5">
          <CatFilterToolbar
            cats={cats}
            config={DATABASE_LIST_CONFIG}
            onBeforeOpenFilter={loadFilterData}
          >
            {(filteredCats) => (
              <div className="mt-4 grid grid-cols-5 gap-3">
                {loading ? (
                  <div className="col-span-full"><LoadingIndicator /></div>
                ) : filteredCats.length === 0 ? (
                  <div className="col-span-full"><EmptyState /></div>
                ) : (
                  filteredCats.map((cat) => (
                    <CatCard
                      key={`desktop-${cat.id}`}
                      cat={cat}
                      region_name={cat.region_name}
                      href={`/dashboard/database/general?id=${cat.id}`}
                      variant="default"
                      action="kebab"
                    />
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
    </>
  );
}
