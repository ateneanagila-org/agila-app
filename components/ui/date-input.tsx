"use client";

import { CustomSelect } from "@/components/ui/custom-select";

export const MONTHS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);
export const DAYS = Array.from({ length: 31 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);
// Span legacy sighting dates through next year. Wide enough for hand-entered
// historical "date last seen" values; harmless for neuter/vaccination dates.
export const YEARS = (() => {
  const end = new Date().getFullYear() + 1;
  const start = 2010;
  return Array.from({ length: end - start + 1 }, (_, i) => String(start + i));
})();

/** Three month/day/year dropdowns. All-blank = no date. */
export function DateInputRow({
  month,
  day,
  year,
  onMonthChange,
  onDayChange,
  onYearChange,
}: {
  month: string;
  day: string;
  year: string;
  onMonthChange: (val: string) => void;
  onDayChange: (val: string) => void;
  onYearChange: (val: string) => void;
}) {
  return (
    <div className="mt-1.5 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(78px,1.15fr)] gap-1.5 tablet:gap-2">
      <CustomSelect options={MONTHS} value={month} onChange={onMonthChange} placeholder="MM" variant="white" size="sm" />
      <CustomSelect options={DAYS} value={day} onChange={onDayChange} placeholder="DD" variant="white" size="sm" />
      <CustomSelect options={YEARS} value={year} onChange={onYearChange} placeholder="YYYY" variant="white" size="sm" />
    </div>
  );
}

export function parseDateParts(date: Date | string | null | undefined) {
  if (!date) return { month: "", day: "", year: "" };
  const d = new Date(date);
  if (isNaN(d.getTime())) return { month: "", day: "", year: "" };
  return {
    month: String(d.getMonth() + 1).padStart(2, "0"),
    day: String(d.getDate()).padStart(2, "0"),
    year: String(d.getFullYear()),
  };
}

export function buildDate(month: string, day: string, year: string): Date | null {
  if (!month || !day || !year) return null;
  return new Date(`${year}-${month}-${day}T00:00:00`);
}
