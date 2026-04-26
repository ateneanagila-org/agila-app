"use client";

import { useState, useEffect, useCallback } from "react";
import { CatEntryForm } from "@/components/app-pages/shared/cat-entry-form";
import {
  DatabaseFiltersDialog,
  DatabaseSortByDialog,
} from "@/components/app-pages/database/database-dialogs";
import {
  ChevronDownIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";
import { CatCard } from "@/components/app-pages/shared/cat-card";
import { getCats } from "@/app/actions/cats";
import type { SelectCat } from "@/lib/validation/cats";
import { useFilterSort } from "@/lib/hooks/use-filter-sort";
import { DATABASE_LIST_CONFIG } from "@/lib/hooks/filter-sort-configs";
import { useAuth } from "@/contexts/auth-context";

export function DatabaseListScreen() {
  const { canManage } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [cats, setCats] = useState<SelectCat[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    filtered: filteredCats,
    activeFilters,
    toggleFilter,
    clearFilters,
    activeFilterCount,
    sortKey,
    setSortKey,
    sortOrder,
    setSortOrder,
    search,
    setSearch,
  } = useFilterSort<SelectCat>(
    cats,
    DATABASE_LIST_CONFIG,
    (cat, key) => {
      const val = cat[key as keyof SelectCat];
      return val != null ? String(val) : null;
    },
    (cat, key) => {
      if (key === "last_updated_at") {
        return cat.last_updated_at ? new Date(cat.last_updated_at) : null;
      }
      const val = cat[key as keyof SelectCat];
      return val != null ? String(val) : null;
    },
  );

  const searchedCats = search
    ? filteredCats.filter((cat) => {
        const q = search.toLowerCase();
        return (
          cat.name?.toLowerCase().includes(q) ||
          cat.color?.toLowerCase().includes(q) ||
          cat.spot_last_seen?.toLowerCase().includes(q)
        );
      })
    : filteredCats;

  const fetchCats = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCats({});
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

          {/* Search bar — orange */}
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full appearance-none rounded-xl bg-brand-orange pl-9 pr-3 text-sm font-semibold text-white outline-none placeholder:text-white/60"
            />
          </div>

          {/* Filter + Sort buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-orange px-3 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              Filter <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowSort(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-orange px-3 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              Sort By <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {loading ? (
            <LoadingIndicator />
          ) : searchedCats.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {searchedCats.map((cat) => (
                <CatCard
                  key={cat.id}
                  cat={cat}
                  href={`/dashboard/database/general?id=${cat.id}`}
                  variant="default"
                  action="kebab"
                />
              ))}
            </div>
          )}
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
              {searchedCats.length} cats on record
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

        <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white p-2 ring-1 ring-border">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-dark/40" />
            <input
              type="text"
              placeholder="Search cats by name, color, or location"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl bg-brand-cream pl-10 pr-4 text-sm text-brand-dark outline-none placeholder:text-brand-dark/40"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Filter
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowSort(true)}
            className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Sort by
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-3">
          {loading ? (
            <div className="col-span-full"><LoadingIndicator /></div>
          ) : searchedCats.length === 0 ? (
            <div className="col-span-full"><EmptyState /></div>
          ) : (
            searchedCats.map((cat) => (
              <CatCard
                key={`desktop-${cat.id}`}
                cat={cat}
                href={`/dashboard/database/general?id=${cat.id}`}
                variant="default"
                action="kebab"
              />
            ))
          )}
        </div>
      </div>

      {showAdd ? (
        <CatEntryForm onClose={() => setShowAdd(false)} onSave={handleSave} />
      ) : null}
      <DatabaseFiltersDialog
        open={showFilters}
        onClose={() => setShowFilters(false)}
        categories={DATABASE_LIST_CONFIG.filters}
        activeFilters={activeFilters}
        onToggle={toggleFilter}
        onClear={clearFilters}
        activeCount={activeFilterCount}
      />
      <DatabaseSortByDialog
        open={showSort}
        onClose={() => setShowSort(false)}
        options={DATABASE_LIST_CONFIG.sortOptions}
        activeKey={sortKey}
        order={sortOrder}
        onSort={setSortKey}
        onOrder={setSortOrder}
      />
    </>
  );
}
