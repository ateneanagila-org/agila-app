"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronDownIcon,
  ExternalLinkIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";
import { CatCard } from "@/components/app-pages/shared/cat-card";
import {
  DatabaseFiltersDialog,
  DatabaseSortByDialog,
} from "@/components/app-pages/database/database-dialogs";
import { getAdoptableCats } from "@/app/actions/cats";
import type { SelectCat } from "@/lib/validation/cats";
import type { CatWithRegion } from "@/lib/repo/cats.repo";
import { useFilterSort } from "@/lib/hooks/use-filter-sort";
import { PUBLIC_CATALOG_CONFIG } from "@/lib/hooks/filter-sort-configs";
import { ADOPT_FOSTER_APPLICATION_URL } from "@/lib/constants";

export function CatalogScreen() {
  const [cats, setCats] = useState<CatWithRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const {
    filtered: filteredCats,
    activeFilters,
    activeFilterCount,
    sortKey,
    sortOrder,
    openDialog,
    openFilterDialog,
    openSortDialog,
    closeDialog,
    applyFilters,
    applySort,
    clearFilters,
    search,
    setSearch,
  } = useFilterSort<CatWithRegion>(
    cats,
    PUBLIC_CATALOG_CONFIG,
    (cat, key) => {
      if (key === "region_name") return cat.region_name ?? null;
      const val = cat[key as keyof SelectCat];
      return val != null ? String(val) : null;
    },
    (cat, key) => {
      if (key === "last_updated_at")
        return cat.last_updated_at ? new Date(cat.last_updated_at) : null;
      if (key === "region_name") return cat.region_name ?? null;
      const val = cat[key as keyof SelectCat];
      return val != null ? String(val) : null;
    },
    undefined,
    (cat) => !cat.name?.trim(),
  );

  const searchedCats = search
    ? filteredCats.filter((cat) => {
        const q = search.toLowerCase();
        return (
          cat.name?.toLowerCase().includes(q) ||
          cat.color?.toLowerCase().includes(q)
        );
      })
    : filteredCats;

  const fetchCats = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdoptableCats({});
      if (result?.data) {
        setCats(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch catalog cats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCats();
  }, [fetchCats]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pt-5 pb-12 tablet:px-8 tablet:pt-10">
      {/* Hero */}
      <div className="mb-6 text-center tablet:mb-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-orange">
          Ateneo de Manila Campus
        </p>
        <h1 className="mt-2 font-heading text-4xl font-bold leading-[1.05] tracking-tight text-brand-dark tablet:text-6xl">
          Find a friend for life.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-brand-dark/65 tablet:text-base">
          Every cat below is available for adoption or fostering. Give a rescued
          cat a second chance at a loving home.
        </p>
        <a
          href={ADOPT_FOSTER_APPLICATION_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          Apply to Adopt/Foster
          <ExternalLinkIcon className="h-4 w-4" />
        </a>
      </div>

      {/* Search + Filter + Sort — same colors mobile + desktop */}
      <div className="rounded-2xl bg-white p-2 ring-1 ring-brand-dark/8">
        <div className="flex flex-col gap-2 tablet:flex-row tablet:items-center">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-dark/40" />
            <input
              type="text"
              placeholder="Search cats by name or color"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl bg-brand-cream pl-10 pr-4 text-sm text-brand-dark outline-none placeholder:text-brand-dark/40"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openFilterDialog}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 tablet:flex-none"
            >
              Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={openSortDialog}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 tablet:flex-none"
            >
              Sort by
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Cat cards */}
      <div className="mt-5 tablet:mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
          </div>
        ) : searchedCats.length === 0 ? (
          <div className="py-12 text-center text-sm text-brand-dark/55">
            No adoptable/fosterable cats available right now.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
            {searchedCats.map((cat) => (
              <CatCard
                key={cat.id}
                cat={cat}
                region_name={cat.region_name}
                href={`/catalog/${cat.id}`}
                variant="default"
                action="chevron"
                hideAdoptableChip
              />
            ))}
          </div>
        )}
      </div>

      <DatabaseFiltersDialog
        open={openDialog === "filter"}
        onClose={closeDialog}
        categories={PUBLIC_CATALOG_CONFIG.filters}
        activeFilters={activeFilters}
        onClear={clearFilters}
        onApply={applyFilters}
      />
      <DatabaseSortByDialog
        open={openDialog === "sort"}
        onClose={closeDialog}
        options={PUBLIC_CATALOG_CONFIG.sortOptions}
        activeKey={sortKey}
        order={sortOrder}
        onApply={applySort}
      />
    </div>
  );
}
