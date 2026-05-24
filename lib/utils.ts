import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const displayCatField = (v: string | null | undefined): string => v ?? "Unknown";

export const normalizeCatField = <T,>(v: string): T | undefined =>
  v === "Unknown" || v === "" ? undefined : (v as T);
