"use client";

import { useState, useEffect, useCallback } from "react";
import { SearchIcon } from "@/components/app-pages/shared/icons";
import { CatCard } from "@/components/app-pages/shared/cat-card";
import {
  FiltersDialog,
  SortByDialog,
} from "@/components/app-pages/shared/dialogs";
import { getAdoptableCats } from "@/app/actions/cats";
import type { SelectCat } from "@/lib/validation/cats";
import { useFilterSort } from "@/lib/hooks/use-filter-sort";
import { DATABASE_LIST_CONFIG } from "@/lib/hooks/filter-sort-configs";

function ScallopEdge() {
  return (
    <svg
      viewBox="0 0 400 28"
      preserveAspectRatio="none"
      className="block h-7 w-full"
      aria-hidden="true"
    >
      <path
        d="M0 0 H400 V6 Q380 28 360 6 Q340 28 320 6 Q300 28 280 6 Q260 28 240 6 Q220 28 200 6 Q180 28 160 6 Q140 28 120 6 Q100 28 80 6 Q60 28 40 6 Q20 28 0 6 Z"
        className="fill-brand-green"
      />
    </svg>
  );
}

export function CatalogScreen() {
  const [cats, setCats] = useState<SelectCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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
      if (key === "last_updated_at")
        return cat.last_updated_at ? new Date(cat.last_updated_at) : null;
      const val = cat[key as keyof SelectCat];
      return val != null ? String(val) : null;
    },
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
    <div className="mx-auto flex w-full max-w-5xl flex-col">
      {/* Green hero band */}
      <div className="bg-brand-green px-5 pt-6 pb-0 tablet:px-8 tablet:pt-12 tablet:pb-2">
        <p className="text-center font-heading text-2xl font-bold leading-tight tracking-tight text-brand-yellow tablet:text-4xl">
          ADOPT/FOSTER A CAT NOW!
        </p>
        <p className="mx-auto mt-2 hidden max-w-xl text-center text-sm text-white/80 tablet:block">
          Give a rescued cat a second chance at a loving home.
        </p>
        <div className="mt-3 flex justify-center pb-5 tablet:mt-5 tablet:pb-8">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full border border-brand-orange bg-brand-cream px-5 py-2 text-sm font-bold text-brand-orange shadow-sm transition-opacity hover:opacity-90 tablet:px-6 tablet:py-2.5"
          >
            Apply <span className="text-base leading-none">→</span>
          </button>
        </div>
      </div>
      <ScallopEdge />

      {/* Content on cream */}
      <div className="flex w-full flex-col gap-3 px-4 pt-3 pb-6 tablet:gap-4 tablet:px-8 tablet:pt-6 tablet:pb-10">
        {/* Search + Filter + Sort */}
        <div className="flex gap-2">
          {searchOpen ? (
            <div className="flex flex-1 items-center gap-2 rounded-full bg-brand-orange px-3 py-2">
              <SearchIcon className="h-4 w-4 shrink-0 text-white" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => { if (!search) setSearchOpen(false); }}
                placeholder="Search..."
                className="flex-1 bg-transparent text-sm text-white placeholder-white/60 outline-none"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex flex-1 items-center gap-2 rounded-xl bg-brand-orange px-3 py-2 transition-opacity hover:opacity-90"
            >
              <SearchIcon className="h-4 w-4 shrink-0 text-white" />
              <span className="text-sm font-bold text-white">Search</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-3 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
          >
            Filter <span className="text-[10px]">▼</span>
          </button>
          <button
            type="button"
            onClick={() => setShowSort(true)}
            className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-3 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
          >
            Sort By <span className="text-[10px]">▼</span>
          </button>
        </div>

        {/* Cat cards */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
          </div>
        ) : searchedCats.length === 0 ? (
          <div className="py-8 text-center text-sm text-foreground/50">
            No adoptable/fosterable cats available right now.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 laptop:grid-cols-4">
            {searchedCats.map((cat) => (
              <CatCard
                key={cat.id}
                cat={cat}
                href={`/catalog/${cat.id}`}
                variant="default"
                action="chevron"
              />
            ))}
          </div>
        )}
      </div>

      <FiltersDialog
        open={showFilters}
        onClose={() => setShowFilters(false)}
        categories={DATABASE_LIST_CONFIG.filters}
        activeFilters={activeFilters}
        onToggle={toggleFilter}
        onClear={clearFilters}
        activeCount={activeFilterCount}
      />
      <SortByDialog
        open={showSort}
        onClose={() => setShowSort(false)}
        options={DATABASE_LIST_CONFIG.sortOptions}
        activeKey={sortKey}
        order={sortOrder}
        onSort={setSortKey}
        onOrder={setSortOrder}
      />
    </div>
  );
}
