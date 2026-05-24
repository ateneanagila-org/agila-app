"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import {
  DatabaseFiltersDialog,
  DatabaseSortByDialog,
} from "@/components/app-pages/database/database-dialogs";
import { ChevronDownIcon, SearchIcon } from "@/components/app-pages/shared/icons";
import { useFilterSort } from "@/lib/hooks/use-filter-sort";
import type { FilterSortConfig } from "@/lib/hooks/use-filter-sort";
import type { CatWithRegion } from "@/lib/repo/cats.repo";
import type { SelectCat } from "@/lib/validation/cats";

type CatFilterToolbarProps = {
  cats: CatWithRegion[];
  config: FilterSortConfig;
  searchFields?: (keyof SelectCat)[];
  children: (filteredCats: CatWithRegion[]) => ReactNode;
};

export function CatFilterToolbar({
  cats,
  config,
  searchFields = ["name"],
  children,
}: CatFilterToolbarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const {
    filtered,
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
  } = useFilterSort<CatWithRegion>(
    cats,
    config,
    (cat, key) => {
      if (key === "region_name") return cat.region_name ?? null;
      const val = cat[key as keyof SelectCat];
      return val != null ? String(val) : null;
    },
    (cat, key) => {
      if (key === "last_updated_at") {
        return cat.last_updated_at ? new Date(cat.last_updated_at) : null;
      }
      if (key === "region_name") return cat.region_name ?? null;
      const val = cat[key as keyof SelectCat];
      return val != null ? String(val) : null;
    },
  );

  const [debouncedSearch] = useDebounce(searchInput, 250);
  useEffect(() => {
    setSearch(debouncedSearch);
  }, [debouncedSearch, setSearch]);

  const filteredCats = search
    ? filtered.filter((cat) => {
        const q = search.toLowerCase();
        return searchFields.some((field) => {
          const val = cat[field as keyof SelectCat];
          return typeof val === "string" && val.toLowerCase().includes(q);
        });
      })
    : filtered;

  return (
    <>
      <div className="rounded-2xl bg-white p-2 ring-1 ring-brand-dark/8 tablet:ring-border">
        <div className="tablet:flex tablet:items-center tablet:gap-2">
          <div className="relative tablet:flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-dark/40" />
            <input
              type="text"
              placeholder="Search by name"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-10 w-full rounded-xl bg-brand-cream pl-10 pr-4 text-sm text-brand-dark outline-none placeholder:text-brand-dark/40"
            />
          </div>
          <div className="mt-2 flex gap-2 tablet:mt-0">
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 tablet:flex-none"
            >
              Filter <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowSort(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 tablet:flex-none"
            >
              Sort by <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {children(filteredCats)}

      <DatabaseFiltersDialog
        open={showFilters}
        onClose={() => setShowFilters(false)}
        categories={config.filters}
        activeFilters={activeFilters}
        onToggle={toggleFilter}
        onClear={clearFilters}
        activeCount={activeFilterCount}
      />
      <DatabaseSortByDialog
        open={showSort}
        onClose={() => setShowSort(false)}
        options={config.sortOptions}
        activeKey={sortKey}
        order={sortOrder}
        onSort={setSortKey}
        onOrder={setSortOrder}
      />
    </>
  );
}
