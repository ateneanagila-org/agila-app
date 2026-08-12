/** Spreadsheet tabs that are not region tabs (config/summary/unknown). */
export const NON_REGION_TABS = new Set([
  "_config",
  "For RI",
  "For FA",
  "UNKNOWN",
  "TEMPLATE",
  "HOME",
  "TNVR Statistics",
  "Coat Color and Kitten Breakdown",
  "SAMPLE",
]);

/**
 * The curated tab new region sheets are cloned from. It is intentionally also
 * present in NON_REGION_TABS — it is not a region — but that set is the wrong
 * list to pick a template from, which is how region creation ended up cloning a
 * live region tab. Look this up by name instead.
 */
export const TEMPLATE_TAB_NAME = "TEMPLATE";

export const CENSUS_REPORT_URL =
  "https://docs.google.com/document/d/1KSbi4g0Ir3MyB3b_-KVXHx9I4VWWpF8M8RIvw5331hI/edit?usp=sharing"; // TODO: replace with the real Google Docs folder URL
export const REFERRAL_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1g3f-y-KmJdzSVoL2aKWRQ_1oxVydDDiv-WaAekhAt18/edit?usp=sharing"; // TODO: replace with the real referral GSheet URL
export const ADOPT_FOSTER_APPLICATION_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSecF51CTWP4UzQl98JNecr2A_-FoWSbXoBvJpU4nu7aee122g/viewform"; // TODO: replace with the real form URL

/**
 * system_config keys backing the admin-editable referral links.
 *
 * Defined once and shared by reader and writer so there is a single spelling —
 * system_config is untyped key/value, so a typo would silently yield the
 * fallback instead of an error.
 */
export const LINK_CONFIG_KEYS = {
  censusReport: "link_census_report",
  referralSheet: "link_referral_sheet",
  adoptFoster: "link_adopt_foster",
} as const;

export type AppLinks = {
  censusReport: string;
  referralSheet: string;
  adoptFoster: string;
};

/**
 * Compiled-in fallbacks. A missing or blank system_config row resolves to these,
 * so the feature ships with no migration step and no window where a link is
 * empty. app/error.tsx uses these directly — it is the crash boundary and must
 * never depend on a DB read.
 */
export const DEFAULT_LINKS: AppLinks = {
  censusReport: CENSUS_REPORT_URL,
  referralSheet: REFERRAL_SHEET_URL,
  adoptFoster: ADOPT_FOSTER_APPLICATION_URL,
};
