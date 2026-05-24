"use client";

import { useState, useMemo, useCallback } from "react";

export type FilterCategory = {
  label: string;
  key: string;
  options: readonly string[];
};

export type SortOption = {
  label: string;
  key: string;
};

export type FilterSortConfig = {
  filters: FilterCategory[];
  sortOptions: SortOption[];
};

export type FilterState = Record<string, Set<string>>;

export function useFilterSort<T>(
  items: T[],
  config: FilterSortConfig,
  getFilterValue: (item: T, key: string) => string | null | undefined,
  getSortValue: (item: T, key: string) => string | number | Date | null | undefined,
  initialFilters?: FilterState,
) {
  const [activeFilters, setActiveFilters] = useState<FilterState>(initialFilters ?? {});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");

  const toggleFilter = useCallback((categoryKey: string, value: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      const set = new Set(prev[categoryKey] ?? []);
      if (set.has(value)) {
        set.delete(value);
      } else {
        set.add(value);
      }
      if (set.size === 0) {
        delete next[categoryKey];
      } else {
        next[categoryKey] = set;
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters({});
  }, []);

  const activeFilterCount = useMemo(() => {
    return Object.values(activeFilters).reduce((sum, set) => sum + set.size, 0);
  }, [activeFilters]);

  const filtered = useMemo(() => {
    let result = items;

    // Apply filters
    const filterEntries = Object.entries(activeFilters);
    if (filterEntries.length > 0) {
      result = result.filter((item) =>
        filterEntries.every(([key, values]) => {
          const val = getFilterValue(item, key);
          return val != null && values.has(val);
        }),
      );
    }

    // Apply sort
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const aVal = getSortValue(a, sortKey);
        const bVal = getSortValue(b, sortKey);
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        let cmp: number;
        if (aVal instanceof Date && bVal instanceof Date) {
          cmp = aVal.getTime() - bVal.getTime();
        } else if (typeof aVal === "number" && typeof bVal === "number") {
          cmp = aVal - bVal;
        } else {
          cmp = String(aVal).localeCompare(String(bVal));
        }
        return sortOrder === "desc" ? -cmp : cmp;
      });
    }

    return result;
  }, [items, activeFilters, sortKey, sortOrder, getFilterValue, getSortValue]);

  return {
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
  };
}
