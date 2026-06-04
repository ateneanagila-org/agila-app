import type { FilterSortConfig } from "./use-filter-sort";
import {
  CAT_COLOR_VALUES,
  CAT_AGE_VALUES,
  CAT_SEX_VALUES,
  CAT_SOCIABILITY_VALUES,
  CAT_STATUS_VALUES,
  CATHEALTHRECORD_CONDITION_VALUES,
  INTERVENTION_TYPE_VALUES,
  INTERVENTION_STATUS_VALUES,
  AUTH_ROLE_VALUES,
} from "@/lib/db/enums";
import type { CatWithRegion } from "@/lib/repo/cats.repo";

/** Returns a copy of `config` with the `region_name` filter options derived from the loaded cats. */
export function withCatRegionOptions(
  config: FilterSortConfig,
  cats: CatWithRegion[],
): FilterSortConfig {
  const names = Array.from(
    new Set(cats.map((c) => c.region_name).filter((n): n is string => n != null)),
  ).sort((a, b) => a.localeCompare(b));
  return {
    ...config,
    filters: config.filters.map((f) =>
      f.key === "region_name" ? { ...f, options: names } : f,
    ),
  };
}

export const DATABASE_LIST_CONFIG: FilterSortConfig = {
  filters: [
    { label: "Region", key: "region_name", options: [] },
    { label: "Color", key: "color", options: [...CAT_COLOR_VALUES, "Unknown"] },
    { label: "Age", key: "age", options: [...CAT_AGE_VALUES, "Unknown"] },
    { label: "Sex", key: "sex", options: [...CAT_SEX_VALUES, "Unknown"] },
    {
      label: "Sociability",
      key: "sociability",
      options: [...CAT_SOCIABILITY_VALUES, "Unknown"],
    },
    {
      label: "Status",
      key: "cat_status",
      options: [...CAT_STATUS_VALUES, "Unknown"],
    },
    {
      label: "Medical Condition",
      key: "condition",
      options: [...CATHEALTHRECORD_CONDITION_VALUES, "Unknown"],
    },
    {
      label: "Intervention Type",
      key: "intervention_type",
      options: [...INTERVENTION_TYPE_VALUES, "Unknown"],
    },
    {
      label: "Intervention Status",
      key: "intervention_status",
      options: [...INTERVENTION_STATUS_VALUES, "Unknown"],
    },
  ],
  sortOptions: [
    { label: "Name", key: "name" },
    { label: "Age", key: "age" },
    { label: "Sex", key: "sex" },
    { label: "Color", key: "color" },
    { label: "Last Updated", key: "last_updated_at" },
  ],
};

export const PUBLIC_CATALOG_CONFIG: FilterSortConfig = {
  filters: [
    { label: "Region", key: "region_name", options: [] },
    { label: "Color", key: "color", options: [...CAT_COLOR_VALUES, "Unknown"] },
    { label: "Age", key: "age", options: [...CAT_AGE_VALUES, "Unknown"] },
    { label: "Sex", key: "sex", options: [...CAT_SEX_VALUES, "Unknown"] },
    {
      label: "Sociability",
      key: "sociability",
      options: [...CAT_SOCIABILITY_VALUES, "Unknown"],
    },
  ],
  sortOptions: [
    { label: "Name", key: "name" },
    { label: "Age", key: "age" },
    { label: "Sex", key: "sex" },
    { label: "Color", key: "color" },
    { label: "Last Updated", key: "last_updated_at" },
  ],
};

export const SESSIONS_CONFIG: FilterSortConfig = {
  filters: [
    {
      label: "Status",
      key: "status",
      options: ["Unfinished", "Submitted", "Reviewed"],
    },
  ],
  sortOptions: [
    { label: "Date", key: "created_at" },
    { label: "Location", key: "location" },
  ],
};

export const USERS_CONFIG: FilterSortConfig = {
  filters: [{ label: "Role", key: "auth_role", options: AUTH_ROLE_VALUES }],
  sortOptions: [
    { label: "Name", key: "name" },
    { label: "Role", key: "auth_role" },
  ],
};

export const INTERVENTIONS_CONFIG: FilterSortConfig = {
  filters: [
    { label: "Type", key: "type", options: INTERVENTION_TYPE_VALUES },
    { label: "Status", key: "status", options: INTERVENTION_STATUS_VALUES },
  ],
  sortOptions: [
    { label: "Date Requested", key: "requested_at" },
    { label: "Type", key: "type" },
    { label: "Status", key: "status" },
  ],
};

export const CROSSREF_LIST_CONFIG: FilterSortConfig = {
  filters: [
    { label: "Region", key: "region_name", options: [] },
    { label: "Color", key: "color", options: [...CAT_COLOR_VALUES, "Unknown"] },
    { label: "Age", key: "age", options: [...CAT_AGE_VALUES, "Unknown"] },
    { label: "Sex", key: "sex", options: [...CAT_SEX_VALUES, "Unknown"] },
    {
      label: "Sociability",
      key: "sociability",
      options: [...CAT_SOCIABILITY_VALUES, "Unknown"],
    },
    {
      label: "Status",
      key: "cat_status",
      options: [...CAT_STATUS_VALUES, "Unknown"],
    },
  ],
  sortOptions: [
    { label: "Name", key: "name" },
    { label: "Age", key: "age" },
    { label: "Sex", key: "sex" },
    { label: "Color", key: "color" },
    { label: "Last Updated", key: "last_updated_at" },
  ],
};

export const SESSIONS_MANAGER_CONFIG: FilterSortConfig = {
  filters: [
    { label: "Color", key: "color", options: [...CAT_COLOR_VALUES, "Unknown"] },
    { label: "Sex", key: "sex", options: [...CAT_SEX_VALUES, "Unknown"] },
    {
      label: "Condition",
      key: "condition",
      options: [...CATHEALTHRECORD_CONDITION_VALUES, "Unknown"],
    },
  ],
  sortOptions: [
    { label: "Name", key: "name" },
    { label: "Last Updated", key: "last_updated_at" },
  ],
};
