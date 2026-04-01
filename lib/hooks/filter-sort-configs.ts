import type { FilterSortConfig } from "./use-filter-sort";
import {
  CAT_COLOR_VALUES,
  CAT_AGE_VALUES,
  CAT_SEX_VALUES,
  CAT_SOCIABILITY_VALUES,
  CAT_STATUS_VALUES,
  CAT_ENTRY_STATUS_VALUES,
  CATHEALTHRECORD_CONDITION_VALUES,
  INTERVENTION_TYPE_VALUES,
  INTERVENTION_STATUS_VALUES,
  AUTH_ROLE_VALUES,
} from "@/lib/db/enums";

export const DATABASE_LIST_CONFIG: FilterSortConfig = {
  filters: [
    { label: "Color", key: "color", options: CAT_COLOR_VALUES },
    { label: "Age", key: "age", options: CAT_AGE_VALUES },
    { label: "Sex", key: "sex", options: CAT_SEX_VALUES },
    { label: "Sociability", key: "sociability", options: CAT_SOCIABILITY_VALUES },
    { label: "Status", key: "cat_status", options: CAT_STATUS_VALUES },
    { label: "Entry Status", key: "entry_status", options: CAT_ENTRY_STATUS_VALUES },
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
      options: ["Unfinished", "Reviewed"],
    },
  ],
  sortOptions: [
    { label: "Date", key: "created_at" },
    { label: "Location", key: "location" },
  ],
};

export const USERS_CONFIG: FilterSortConfig = {
  filters: [
    { label: "Role", key: "auth_role", options: AUTH_ROLE_VALUES },
  ],
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

export const SESSIONS_MANAGER_CONFIG: FilterSortConfig = {
  filters: [
    { label: "Color", key: "color", options: CAT_COLOR_VALUES },
    { label: "Sex", key: "sex", options: CAT_SEX_VALUES },
    { label: "Condition", key: "condition", options: CATHEALTHRECORD_CONDITION_VALUES },
  ],
  sortOptions: [
    { label: "Name", key: "name" },
    { label: "Last Updated", key: "last_updated_at" },
  ],
};
