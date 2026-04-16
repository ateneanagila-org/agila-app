"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  SearchIcon,
  ImagePlaceholderIcon,
} from "@/components/app-pages/shared/icons";
import {
  FiltersDialog,
  SortByDialog,
} from "@/components/app-pages/shared/dialogs";
import { getCats } from "@/app/actions/cats";
import type { SelectCat } from "@/lib/validation/cats";
import { useFilterSort } from "@/lib/hooks/use-filter-sort";
import { DATABASE_LIST_CONFIG } from "@/lib/hooks/filter-sort-configs";

export function CatalogScreen() {
  const [cats, setCats] = useState<SelectCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

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
      // Fetch only adoptable cats for the catalog
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

  const sexColor = (s: string | null | undefined): string => {
    if (s === "Male") return "text-blue-500";
    if (s === "Female") return "text-pink-500";
    return "text-slate-400";
  };

  return (
    <div className="space-y-4 px-4 py-5">
      {/* Heading */}
      <div className="flex items-center justify-between rounded-2xl bg-brand-green p-4">
        <p className="font-heading text-lg font-bold tracking-tight text-yellow-200">
          Adopt/Foster A Cat Now!
        </p>
        <button
          type="button"
          className="rounded-full bg-brand-orange px-5 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          Apply
        </button>
      </div>

      {/* Search + Filter + Sort */}
      <div className="flex gap-2">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 rounded-full bg-brand-orange px-3 py-2.5 text-white transition-opacity hover:opacity-90"
        >
          <SearchIcon className="h-4 w-4 shrink-0" />
          <span className="text-sm text-white/70">Search</span>
        </button>
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className="rounded-full bg-brand-orange px-4 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setShowSort(true)}
          className="rounded-full bg-brand-orange px-4 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
        >
          Sort By
        </button>
      </div>

      {/* Cat cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
        </div>
      ) : searchedCats.length === 0 ? (
        <div className="py-8 text-center text-sm text-white/50">
          No adoptable/fosterable cats available right now.
        </div>
      ) : (
        <div className="space-y-3">
          {searchedCats.map((cat) => (
            <Link key={cat.id} href={`/catalog/${cat.id}`} className="block">
              <div className="flex items-center gap-3 overflow-hidden rounded-2xl bg-brand-green transition-opacity hover:opacity-90">
                {/* Photo */}
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                  <ImagePlaceholderIcon className="h-9 w-9 text-white/50" />
                </div>
                {/* Info */}
                <div className="py-2 pr-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold tracking-tight text-white">
                      {cat.name || "Unnamed"}
                    </span>
                    {sexSymbol(cat.sex) ? (
                      <span className={`text-sm ${sexColor(cat.sex)}`}>
                        {sexSymbol(cat.sex)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-white/70">
                    {cat.color || "—"}
                  </p>
                  <p className="text-xs text-white/70">{cat.age || "—"}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
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
