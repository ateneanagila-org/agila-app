"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CatEntryForm } from "@/components/app-pages/shared/cat-entry-form";
import {
  DatabaseFiltersDialog,
  DatabaseSortByDialog,
} from "@/components/app-pages/database/database-dialogs";
import {
  ChevronDownIcon,
  ImagePlaceholderIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";
import { getCats } from "@/app/actions/cats";
import type { SelectCat } from "@/lib/validation/cats";
import { useFilterSort } from "@/lib/hooks/use-filter-sort";
import { DATABASE_LIST_CONFIG } from "@/lib/hooks/filter-sort-configs";

export function DatabaseListScreen() {
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

  /** Format date for display */
  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "—";
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
  };

  /** Get sex symbol */
  const sexSymbol = (sex: string | null | undefined): string | null => {
    if (sex === "Male") return "♂";
    if (sex === "Female") return "♀";
    return null;
  };


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
          {/* Add Entry button — top */}
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-orange py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Add Entry <span className="text-base leading-none">+</span>
          </button>

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
            <div className="space-y-2">
              {searchedCats.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/dashboard/database/general?id=${cat.id}`}
                  className="block overflow-hidden rounded-2xl bg-brand-green transition-opacity hover:opacity-90"
                >
                  <div className="flex items-stretch gap-0">
                    {/* Full-height image column */}
                    <div className="flex w-28 shrink-0 items-center justify-center bg-white/10">
                      <ImagePlaceholderIcon className="h-10 w-10 text-white/40" />
                    </div>
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
                          {cat.color || "Unknown color"} {cat.age ? ` ${cat.age}` : ""}
                        </p>
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-2">
                        <p className="text-sm font-bold text-white truncate">
                          {cat.spot_last_seen || "Unknown loc."} - {formatDate(cat.last_updated_at)}
                        </p>
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-dark text-white/90 shadow-sm">
                          <span className="font-bold leading-none -mt-1">...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* FAB */}
        <div className="pointer-events-none fixed bottom-20 right-4 z-10">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange shadow-lg transition-opacity hover:opacity-90"
          >
            <span className="text-2xl font-bold leading-none text-white">+</span>
          </button>
        </div>
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
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Add entry
            <span className="text-lg leading-none">+</span>
          </button>
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

        <div className="mt-4 grid grid-cols-2 gap-3 laptop:grid-cols-3">
          {loading ? (
            <div className="col-span-full"><LoadingIndicator /></div>
          ) : searchedCats.length === 0 ? (
            <div className="col-span-full"><EmptyState /></div>
          ) : (
            searchedCats.map((cat) => (
              <Link
                key={`desktop-${cat.id}`}
                href={`/dashboard/database/general?id=${cat.id}`}
                className="group flex items-stretch overflow-hidden rounded-2xl bg-brand-green transition-opacity hover:opacity-95"
              >
                <div className="flex w-28 shrink-0 items-center justify-center bg-white/10">
                  <ImagePlaceholderIcon className="h-10 w-10 text-white/40" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between px-4 py-3.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 className="font-heading text-xl font-bold leading-tight tracking-tight text-brand-yellow truncate">
                        {cat.name || "Unnamed"}
                      </h2>
                      {sexSymbol(cat.sex) ? (
                        <span className="text-lg leading-none text-white">
                          {sexSymbol(cat.sex)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-white truncate">
                      {cat.color || "Unknown color"}
                      {cat.age ? ` · ${cat.age}` : ""}
                    </p>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <p className="text-xs font-medium text-white/70 truncate">
                      {cat.spot_last_seen || "Unknown loc."} ·{" "}
                      {formatDate(cat.last_updated_at)}
                    </p>
                    <div className="flex h-7 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-dark text-white shadow-sm">
                      <span className="-mt-1 font-bold leading-none">...</span>
                    </div>
                  </div>
                </div>
              </Link>
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
