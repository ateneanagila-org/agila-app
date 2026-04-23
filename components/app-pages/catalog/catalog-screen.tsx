"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SearchIcon, ImagePlaceholderIcon } from "@/components/app-pages/shared/icons";
import {
  FiltersDialog,
  SortByDialog,
} from "@/components/app-pages/shared/dialogs";
import { getCats } from "@/app/actions/cats";
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
      const result = await getCats({ is_adoptable: true });
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

  const sexSymbol = (s: string | null | undefined): string | null => {
    if (s === "Male") return "♂";
    if (s === "Female") return "♀";
    return null;
  };

  return (
    <div className="flex flex-col">
      {/* Green hero band */}
      <div className="bg-brand-green px-5 pt-6 pb-0">
        <p className="font-heading text-2xl font-bold leading-tight tracking-tight text-brand-yellow text-center">
          ADOPT/FOSTER A CAT NOW!
        </p>
        <div className="mt-3 flex justify-center pb-5">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full border border-brand-orange bg-brand-cream px-5 py-2 text-sm font-bold text-brand-orange transition-opacity hover:opacity-90 shadow-sm"
          >
            Apply <span className="text-base leading-none">🔗</span>
          </button>
        </div>
      </div>
      <ScallopEdge />

      {/* Content on cream */}
      <div className="flex flex-col gap-3 px-4 pt-3 pb-6">
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
          <div className="space-y-3">
            {searchedCats.map((cat) => (
              <Link key={cat.id} href={`/catalog/${cat.id}`} className="block">
                <div className="flex items-stretch gap-0 overflow-hidden rounded-2xl bg-brand-green transition-opacity hover:opacity-90">
                  {/* Full-height image column */}
                  <div className="flex w-28 shrink-0 items-center justify-center bg-white/10">
                    <ImagePlaceholderIcon className="h-10 w-10 text-white/40" />
                  </div>
                  {/* Info */}
                  <div className="flex min-w-0 flex-1 flex-col justify-between px-3.5 py-3 min-h-25">
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-heading text-2xl font-bold leading-tight text-brand-yellow truncate">
                          {cat.name || "Unnamed"}
                        </span>
                        {sexSymbol(cat.sex) ? (
                          <span className="text-white text-lg leading-none ml-1">
                            {sexSymbol(cat.sex)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm font-bold text-white truncate">
                        {cat.color || "—"} {cat.age ? ` ${cat.age}` : ""}
                      </p>
                    </div>
                    {/* Arrow indicator */}
                    <div className="mt-3 flex items-end justify-end">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-dark text-white shadow-sm">
                        <span className="text-sm font-bold">›</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
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
