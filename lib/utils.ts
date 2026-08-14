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
