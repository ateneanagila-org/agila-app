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
export type OpenDialog = "filter" | "sort" | null;
export type FilterValue = string | readonly string[] | null | undefined;

type State = {
  filters: FilterState;
  sort: { key: string | null; order: "asc" | "desc" };
  openDialog: OpenDialog;
};

export function useFilterSort<T>(
  items: T[],
  config: FilterSortConfig,
  getFilterValue: (item: T, key: string) => FilterValue,
  getSortValue: (
    item: T,
    key: string,
  ) => string | number | Date | null | undefined,
  initialFilters?: FilterState,

  shouldPinLast?: (item: T) => boolean,
) {
  const [state, setState] = useState<State>({
    filters: initialFilters ?? {},
    sort: { key: null, order: "asc" },
    openDialog: null,
  });
  const [search, setSearch] = useState("");

  // Each action below is a single setState call — apply + close happen in one
  // render to avoid cascading updates.
  const applyFilters = useCallback((filters: Record<string, string>) => {
    setState((s) => {
      const next: FilterState = {};
      for (const [key, value] of Object.entries(filters)) {
        if (value) next[key] = new Set([value]);
      }
      return { ...s, filters: next, openDialog: null };
    });
  }, []);

  const applySort = useCallback((key: string | null, order: "asc" | "desc") => {
    setState((s) => ({ ...s, sort: { key, order }, openDialog: null }));
  }, []);

  const clearFilters = useCallback(() => {
    setState((s) => ({ ...s, filters: {}, openDialog: null }));
  }, []);

  const openFilterDialog = useCallback(() => {
    setState((s) => ({ ...s, openDialog: "filter" }));
  }, []);

  const openSortDialog = useCallback(() => {
    setState((s) => ({ ...s, openDialog: "sort" }));
  }, []);

  const closeDialog = useCallback(() => {
    setState((s) => ({ ...s, openDialog: null }));
  }, []);

  const activeFilterCount = useMemo(
    () => Object.values(state.filters).reduce((sum, set) => sum + set.size, 0),
    [state.filters],
  );

  const filtered = useMemo(() => {
    let result = items;

    const filterEntries = Object.entries(state.filters);
    if (filterEntries.length > 0) {
      result = result.filter((item) =>
        filterEntries.every(([key, values]) => {
          const val = getFilterValue(item, key);
          const itemValues = Array.isArray(val) ? val : [val];
          return itemValues.some(
            (itemValue) => itemValue != null && values.has(itemValue),
          );
        }),
      );
    }

    if (state.sort.key) {
      const sortKey = state.sort.key;
      const sortOrder = state.sort.order;
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

    if (shouldPinLast) {
      result = [...result].sort(
        (a, b) => Number(shouldPinLast(a)) - Number(shouldPinLast(b)),
      );
    }

    return result;
  }, [
    items,
    state.filters,
    state.sort,
    getFilterValue,
    getSortValue,
    shouldPinLast,
  ]);

  return {
    filtered,
    activeFilters: state.filters,
    activeFilterCount,
    sortKey: state.sort.key,
    sortOrder: state.sort.order,
    openDialog: state.openDialog,
    applyFilters,
    applySort,
    clearFilters,
    openFilterDialog,
    openSortDialog,
    closeDialog,
    search,
    setSearch,
  };
}
