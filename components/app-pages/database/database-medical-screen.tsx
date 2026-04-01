"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  DetailHeader,
  TopTabs,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import {
  ChevronDownIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";
import {
  getCats,
  getCatHealthRecords,
  editCathHealthRecord,
} from "@/app/actions/cats";
import type { SelectCat, SelectCatHealthRecord } from "@/lib/validation/cats";
import { CATHEALTHRECORD_CONDITION_VALUES } from "@/lib/db/enums";
import type { CatHealthRecordCondition } from "@/lib/db/enums";

const FILTER_CHIPS = [
  "Include +",
  "Filter 1 Sample",
  "Filter 2 Sample",
  "Exclude -",
  "Filter 1 Sample",
  "Filter 2 Sample",
];

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);
const DAYS = Array.from({ length: 31 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);
const YEARS = Array.from({ length: 10 }, (_, i) => String(2020 + i));

function DateInputRow({
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
    <div className="mt-1 grid grid-cols-3 gap-2">
      <div className="relative rounded-md border border-lime-300 bg-white">
        <select
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="h-8 w-full appearance-none rounded-md bg-white px-3 pr-8 text-sm text-slate-700"
        >
          <option value="">MM</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>
      <div className="relative rounded-md border border-lime-300 bg-white">
        <select
          value={day}
          onChange={(e) => onDayChange(e.target.value)}
          className="h-8 w-full appearance-none rounded-md bg-white px-3 pr-8 text-sm text-slate-700"
        >
          <option value="">DD</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>
      <div className="relative rounded-md border border-lime-300 bg-white">
        <select
          value={year}
          onChange={(e) => onYearChange(e.target.value)}
          className="h-8 w-full appearance-none rounded-md bg-white px-3 pr-8 text-sm text-slate-700"
        >
          <option value="">YYYY</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

/** Parse a Date | string | null into { month, day, year } strings */
function parseDateParts(date: Date | string | null | undefined) {
  if (!date) return { month: "", day: "", year: "" };
  const d = new Date(date);
  if (isNaN(d.getTime())) return { month: "", day: "", year: "" };
  return {
    month: String(d.getMonth() + 1).padStart(2, "0"),
    day: String(d.getDate()).padStart(2, "0"),
    year: String(d.getFullYear()),
  };
}

/** Build a Date from month/day/year strings, or null if incomplete */
function buildDate(month: string, day: string, year: string): Date | null {
  if (!month || !day || !year) return null;
  return new Date(`${year}-${month}-${day}T00:00:00`);
}

export function DatabaseMedicalScreen() {
  const searchParams = useSearchParams();
  const catId = searchParams.get("id");

  const [cat, setCat] = useState<SelectCat | null>(null);
  const [healthRecord, setHealthRecord] =
    useState<SelectCatHealthRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDesktopFilters, setShowDesktopFilters] = useState(false);

  // Form state
  const [condition, setCondition] = useState("");
  const [neuterMonth, setNeuterMonth] = useState("");
  const [neuterDay, setNeuterDay] = useState("");
  const [neuterYear, setNeuterYear] = useState("");
  const [vaccMonth, setVaccMonth] = useState("");
  const [vaccDay, setVaccDay] = useState("");
  const [vaccYear, setVaccYear] = useState("");

  const populateForm = useCallback((hr: SelectCatHealthRecord) => {
    setCondition(hr.condition ?? "");
    const neuter = parseDateParts(hr.neuter_date);
    setNeuterMonth(neuter.month);
    setNeuterDay(neuter.day);
    setNeuterYear(neuter.year);
    const vacc = parseDateParts(hr.vaccination_date);
    setVaccMonth(vacc.month);
    setVaccDay(vacc.day);
    setVaccYear(vacc.year);
  }, []);

  const fetchData = useCallback(async () => {
    if (!catId) {
      setError("Missing cat ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [catResult, hrResult] = await Promise.all([
        getCats({ id: catId }),
        getCatHealthRecords({ cat_id: catId }),
      ]);
      if (catResult?.data && catResult.data.length > 0) {
        setCat(catResult.data[0]);
      } else {
        setError("Cat not found.");
      }
      if (hrResult?.data && hrResult.data.length > 0) {
        const hr = hrResult.data[0];
        setHealthRecord(hr);
        populateForm(hr);
      }
    } catch (err) {
      console.error("Failed to fetch medical data:", err);
      setError("Failed to load medical data.");
    } finally {
      setLoading(false);
    }
  }, [catId, populateForm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = useCallback(async () => {
    if (!healthRecord?.id) return;
    setSaving(true);
    setError(null);
    try {
      const boundEdit = editCathHealthRecord.bind(null, healthRecord.id);
      const result = await boundEdit({
        condition: (condition || undefined) as
          | CatHealthRecordCondition
          | undefined,
        neuter_date: buildDate(neuterMonth, neuterDay, neuterYear) ?? undefined,
        vaccination_date: buildDate(vaccMonth, vaccDay, vaccYear) ?? undefined,
      });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, [
    healthRecord?.id,
    condition,
    neuterMonth,
    neuterDay,
    neuterYear,
    vaccMonth,
    vaccDay,
    vaccYear,
    fetchData,
  ]);

  const handleCancel = useCallback(() => {
    if (healthRecord) populateForm(healthRecord);
  }, [healthRecord, populateForm]);

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "—";
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
  };

  const sexSymbol = (s: string | null | undefined): string | null => {
    if (s === "Male") return "♂";
    if (s === "Female") return "♀";
    return null;
  };

  const sexColor = (s: string | null | undefined): string => {
    if (s === "Male") return "text-blue-500";
    if (s === "Female") return "text-pink-500";
    return "text-slate-400";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
    );
  }

  return (
    <>
      <div className="tablet:hidden">
        <PageContent>
          <DetailHeader
            name={cat?.name || "Unnamed"}
            lastUpdated={formatDate(cat?.last_updated_at)}
            backHref="/database"
          />
          <TopTabs active="Medical" />

          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          ) : null}

          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-700">Condition</label>
              <div className="relative mt-1 rounded-lg border border-slate-200 bg-white">
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="h-10 w-full appearance-none rounded-lg bg-white px-3 pr-10 text-sm text-slate-900"
                >
                  <option value="">—</option>
                  {CATHEALTHRECORD_CONDITION_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-700">Neuter Date</label>
              <DateInputRow
                month={neuterMonth}
                day={neuterDay}
                year={neuterYear}
                onMonthChange={setNeuterMonth}
                onDayChange={setNeuterDay}
                onYearChange={setNeuterYear}
              />
            </div>

            <div>
              <label className="text-sm text-slate-700">Vaccination Date</label>
              <DateInputRow
                month={vaccMonth}
                day={vaccDay}
                year={vaccYear}
                onMonthChange={setVaccMonth}
                onDayChange={setVaccDay}
                onYearChange={setVaccYear}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}{" "}
                <span className="ml-1">&#10003;</span>
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-200"
              >
                Cancel <span className="ml-1">&#10005;</span>
              </button>
            </div>
          </div>
        </PageContent>
      </div>

      <div className="hidden min-h-full w-full bg-slate-100 p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Database
          </h1>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full bg-lime-300 px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-lime-400"
          >
            Add entry
            <span className="text-lg leading-none">+</span>
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-slate-100">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search"
                className="h-9 w-full rounded-full bg-slate-50 px-4 pr-10 text-sm text-slate-800 outline-none"
              />
              <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            <button
              type="button"
              onClick={() => setShowDesktopFilters((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
            >
              Filter
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              className="flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
            >
              Sort by
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {showDesktopFilters ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FILTER_CHIPS.map((chip, index) => (
                <span
                  key={`${chip}-${index}`}
                  className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-600"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        ) : null}

        <section className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-slate-100">
          <div className="flex gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200">
              <span className="text-2xl text-slate-400">&#9635;</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  {cat?.name || "Unnamed"}
                </h2>
                {sexSymbol(cat?.sex) ? (
                  <span className={`text-xl ${sexColor(cat?.sex)}`}>
                    {sexSymbol(cat?.sex)}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {cat?.color ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                    {cat.color}
                  </span>
                ) : null}
                {cat?.age ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                    {cat.age}
                  </span>
                ) : null}
              </div>

              <p className="mt-3 text-sm text-slate-600">
                Last seen: {cat?.spot_last_seen || "—"} &middot;{" "}
                {formatDate(cat?.last_updated_at)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <TopTabs active="Medical" />
            <div className="ml-4 flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              <span>Adoptable</span>
              <span
                className={`relative inline-flex h-4 w-7 items-center rounded-full ${cat?.is_adoptable ? "bg-slate-800" : "bg-slate-300"}`}
              >
                <span
                  className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${cat?.is_adoptable ? "translate-x-3.5" : "translate-x-0.5"}`}
                />
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">
                Condition
              </label>
              <div className="relative mt-1 rounded-md border border-lime-300 bg-white">
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="h-8 w-full appearance-none rounded-md bg-white px-3 pr-10 text-sm text-slate-900"
                >
                  <option value="">—</option>
                  {CATHEALTHRECORD_CONDITION_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            <div />

            <div>
              <label className="text-xs font-medium text-slate-600">
                Neuter Date
              </label>
              <DateInputRow
                month={neuterMonth}
                day={neuterDay}
                year={neuterYear}
                onMonthChange={setNeuterMonth}
                onDayChange={setNeuterDay}
                onYearChange={setNeuterYear}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">
                Vaccination Date
              </label>
              <DateInputRow
                month={vaccMonth}
                day={vaccDay}
                year={vaccYear}
                onMonthChange={setVaccMonth}
                onDayChange={setVaccDay}
                onYearChange={setVaccYear}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}{" "}
              <span className="ml-1">&#10003;</span>
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-200"
            >
              Cancel <span className="ml-1">&#10005;</span>
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
