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
  PlusCircleIcon,
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

  const sexColor = (sex: string | null | undefined): string => {
    if (sex === "Male") return "text-blue-500";
    if (sex === "Female") return "text-pink-500";
    return "text-slate-400";
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
      <p className="text-sm text-slate-500">No cats found.</p>
      <p className="mt-1 text-xs text-slate-400">
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
                  href={`/database/general?id=${cat.id}`}
                  className="block overflow-hidden rounded-2xl bg-brand-green"
                >
                  <div className="flex items-start gap-3 p-3.5">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/15">
                      <ImagePlaceholderIcon className="h-8 w-8 text-white/50" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-heading text-xl font-bold leading-tight text-brand-yellow">
                            {cat.name || "Unnamed"}
                            {sexSymbol(cat.sex) ? (
                              <span className="ml-1 text-white/80">
                                {sexSymbol(cat.sex)}
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 text-xs text-white/70">
                            {cat.color || "Unknown color"} {cat.age ? `• ${cat.age}` : ""}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-white/60">
                            {cat.spot_last_seen || "Unknown location"} &middot;{" "}
                            {formatDate(cat.last_updated_at)}
                          </p>
                        </div>
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-dark text-white/80">
                          ···
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

      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Database
          </h1>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Add entry
            <span className="text-lg leading-none">+</span>
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-border">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-full bg-brand-cream px-4 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-1 rounded-full bg-brand-cream px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-border"
          >
            Filter
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowSort(true)}
            className="flex items-center gap-1 rounded-full bg-brand-cream px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-border"
          >
            Sort by
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <LoadingIndicator />
          ) : searchedCats.length === 0 ? (
            <EmptyState />
          ) : (
            searchedCats.map((cat) => (
              <Link
                key={`desktop-${cat.id}`}
                href={`/database/general?id=${cat.id}`}
                className="flex items-center gap-4 overflow-hidden rounded-2xl bg-brand-green px-5 py-4 ring-1 ring-brand-green transition-opacity hover:opacity-90"
              >
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                  <ImagePlaceholderIcon className="h-9 w-9 text-white/50" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-xl font-bold tracking-tight text-white">
                      {cat.name || "Unnamed"}
                    </h2>
                    {sexSymbol(cat.sex) ? (
                      <span className={`text-xl font-semibold text-white/70`}>
                        {sexSymbol(cat.sex)}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {cat.color ? (
                      <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                        {cat.color}
                      </span>
                    ) : null}
                    {cat.age ? (
                      <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                        {cat.age}
                      </span>
                    ) : null}
                    {cat.sociability && cat.sociability !== "Unknown" ? (
                      <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                        {cat.sociability}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm text-white/70">
                      Last seen: {cat.spot_last_seen || "Unknown"} &middot;{" "}
                      {formatDate(cat.last_updated_at)}
                    </p>
                    <span className="rounded-full bg-brand-orange px-3.5 py-1 text-xs font-bold text-white transition-opacity hover:opacity-90">
                      Edit entry <span className="ml-1">✎</span>
                    </span>
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
