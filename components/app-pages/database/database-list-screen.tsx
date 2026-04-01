"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CatEntryForm } from "@/components/app-pages/shared/cat-entry-form";
import {
  FiltersDialog,
  SortByDialog,
} from "@/components/app-pages/shared/dialogs";
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
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
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
        <div className="flex-1 space-y-4 px-4 py-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Filters
            </button>
            <button
              type="button"
              onClick={() => setShowSort(true)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Sort By
            </button>
          </div>

          {loading ? (
            <LoadingIndicator />
          ) : searchedCats.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
              {searchedCats.map((cat, i) => (
                <Link
                  key={cat.id}
                  href={`/database/general?id=${cat.id}`}
                  className="block"
                >
                  <div className="flex items-start gap-3 px-3.5 py-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200">
                      <ImagePlaceholderIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold tracking-tight text-slate-900">
                          {cat.name || "Unnamed"}
                        </span>
                        {sexSymbol(cat.sex) ? (
                          <span className={`text-sm ${sexColor(cat.sex)}`}>
                            {sexSymbol(cat.sex)}
                          </span>
                        ) : null}
                        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          Edit
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {cat.color || "Unknown color"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {cat.age || "Unknown age"}
                      </p>
                      <p className="mt-1.5 text-[11px] font-medium text-slate-600">
                        {cat.spot_last_seen || "Unknown location"} &middot;{" "}
                        {formatDate(cat.last_updated_at)}
                      </p>
                    </div>
                  </div>
                  {i < searchedCats.length - 1 ? (
                    <div className="mx-3.5 border-b border-slate-100" />
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end px-4 pb-5">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-full bg-stone-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-stone-700"
          >
            Add Entry
            <PlusCircleIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="hidden min-h-full w-full bg-slate-100 p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Database</h1>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-full bg-lime-300 px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-lime-400"
          >
            Add entry
            <span className="text-lg leading-none">+</span>
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-100">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-full bg-slate-50 px-4 pr-10 text-sm text-slate-800 outline-none"
            />
            <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            Filter
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowSort(true)}
            className="flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
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
                className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 ring-1 ring-slate-100 transition-shadow hover:shadow-sm"
              >
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200">
                  <ImagePlaceholderIcon className="h-9 w-9 text-slate-400" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight text-slate-900">
                      {cat.name || "Unnamed"}
                    </h2>
                    {sexSymbol(cat.sex) ? (
                      <span className={`text-xl ${sexColor(cat.sex)}`}>
                        {sexSymbol(cat.sex)}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {cat.color ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                        {cat.color}
                      </span>
                    ) : null}
                    {cat.age ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                        {cat.age}
                      </span>
                    ) : null}
                    {cat.sociability && cat.sociability !== "Unknown" ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                        {cat.sociability}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      Last seen: {cat.spot_last_seen || "Unknown"} &middot;{" "}
                      {formatDate(cat.last_updated_at)}
                    </p>
                    <span className="rounded-full bg-slate-50 px-3.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-100 transition-colors hover:bg-slate-100">
                      Edit entry <span className="ml-1">&#9998;</span>
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {showAdd ? (
        <CatEntryForm
          onClose={() => setShowAdd(false)}
          onSave={handleSave}
        />
      ) : null}
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
    </>
  );
}
