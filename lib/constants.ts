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
