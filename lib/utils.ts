import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const displayCatField = (v: string | null | undefined): string => v ?? "Unknown";

// "Unknown"/"" → null so the value is explicitly cleared on edit (honest
// WYSIWYG: picking Unknown actually resets the field, not silently kept).
export const normalizeCatField = <T,>(v: string): T | null =>
  v === "Unknown" || v === "" ? null : (v as T);
