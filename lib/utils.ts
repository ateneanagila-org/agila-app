import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const displayCatField = (v: string | null | undefined): string => v ?? "Unknown";

/**
 * The codebase's date display format: MM/DD/YY, em dash when absent.
 *
 * Extracted here because nine components had defined this same function
 * locally. Those copies are not migrated by this project — see the follow-up
 * note in Out of Scope — but new code uses this one rather than adding a tenth.
 */
export const formatDate = (
  date: Date | string | null | undefined,
): string => {
  if (!date) return "—";
  const d = new Date(date);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
};

// "Unknown"/"" → null so the value is explicitly cleared on edit (honest
// WYSIWYG: picking Unknown actually resets the field, not silently kept).
export const normalizeCatField = <T,>(v: string): T | null =>
  v === "Unknown" || v === "" ? null : (v as T);

/**
 * Whole months elapsed, not counting a month until its day-of-month is reached.
 *
 * Calendar-aware on purpose. Dividing milliseconds (as the inline `daysSince` in
 * sessions-screen.tsx does) is fine for days but wrong for months, which have
 * unequal lengths — Jan 31 → Mar 1 is one whole month by the calendar and zero by
 * a 30-day approximation.
 */
export function monthsSince(date: Date, now: Date = new Date()): number {
  let months =
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth());
  if (now.getDate() < date.getDate()) months -= 1;
  return Math.max(0, months);
}

/** Human-readable elapsed months: "this month", "1 month ago", "14 months ago". */
export function formatMonthsAgo(
  value: Date | string,
  now: Date = new Date(),
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const months = monthsSince(date, now);
  if (months < 1) return "this month";
  return months === 1 ? "1 month ago" : `${months} months ago`;
}
