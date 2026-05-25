"use client";

import { useState, useEffect, useCallback } from "react";
import { CatEntryForm } from "@/components/app-pages/shared/cat-entry-form";
import { CatFilterToolbar } from "@/components/app-pages/shared/cat-filter-toolbar";
import { PlusIcon } from "@/components/app-pages/shared/icons";
import { CatCard } from "@/components/app-pages/shared/cat-card";
import { getCats } from "@/app/actions/cats";
import type { CatWithRegion } from "@/lib/repo/cats.repo";
import { DATABASE_LIST_CONFIG } from "@/lib/hooks/filter-sort-configs";
import { useAuth } from "@/contexts/auth-context";

export function DatabaseListScreen() {
  const { canManage } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [cats, setCats] = useState<CatWithRegion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCats = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCats({ entry_status: "Original" });
      if (result?.data) {
        setCats(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch cats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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

          <CatFilterToolbar cats={cats} config={DATABASE_LIST_CONFIG}>
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
              className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange shadow-lg transition-opacity hover:opacity-90"
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
          <CatFilterToolbar cats={cats} config={DATABASE_LIST_CONFIG}>
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
