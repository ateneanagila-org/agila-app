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
  ImagePlaceholderIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";
import { CustomSelect } from "@/components/ui/custom-select";
import { getCats, editCat } from "@/app/actions/cats";
import {
  DiscardChangesDialog,
  SaveChangesDialog,
} from "@/components/app-pages/database/database-dialogs";
import { syncAllPendingRegions } from "@/app/actions/google-sheets";
import type { SelectCat } from "@/lib/validation/cats";
import {
  CAT_COLOR_VALUES,
  CAT_AGE_VALUES,
  CAT_SEX_VALUES,
  CAT_SOCIABILITY_VALUES,
  CAT_STATUS_VALUES,
} from "@/lib/db/enums";
import type {
  CatColor,
  CatAge,
  CatSex,
  CatSociability,
  CatStatus,
} from "@/lib/db/enums";

const FILTER_CHIPS = [
  "Include +",
  "Filter 1 Sample",
  "Filter 2 Sample",
  "Exclude -",
  "Filter 1 Sample",
  "Filter 2 Sample",
];

/** Form field label + CustomSelect used inside green card */
function FormSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-brand-yellow">{label}</label>
      <div className="mt-1.5">
        <CustomSelect options={options} value={value} onChange={onChange} variant="cream" />
      </div>
    </div>
  );
}

export function DatabaseGeneralScreen() {
  const searchParams = useSearchParams();
  const catId = searchParams.get("id");

  const [cat, setCat] = useState<SelectCat | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showDesktopFilters, setShowDesktopFilters] = useState(false);

  // Form state
  const [color, setColor] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [sociability, setSociability] = useState("");
  const [catStatus, setCatStatus] = useState("");
  const [caretaker, setCaretaker] = useState("");
  const [notes, setNotes] = useState("");
  const [isAdoptable, setIsAdoptable] = useState(false);

  const populateForm = useCallback((catData: SelectCat) => {
    setColor(catData.color ?? "");
    setAge(catData.age ?? "");
    setSex(catData.sex ?? "");
    setSociability(catData.sociability ?? "");
    setCatStatus(catData.cat_status ?? "");
    setCaretaker(catData.caretaker ?? "");
    setNotes(catData.notes ?? "");
    setIsAdoptable(catData.is_adoptable ?? false);
  }, []);

  const fetchCat = useCallback(async () => {
    if (!catId) {
      setError("Missing cat ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await getCats({ id: catId });
      if (result?.data && result.data.length > 0) {
        const catData = result.data[0];
        setCat(catData);
        populateForm(catData);
      } else {
        setError("Cat not found.");
      }
    } catch (err) {
      console.error("Failed to fetch cat:", err);
      setError("Failed to load cat data.");
    } finally {
      setLoading(false);
    }
  }, [catId, populateForm]);

  useEffect(() => {
    fetchCat();
  }, [fetchCat]);

  const handleSave = useCallback(async () => {
    if (!catId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await editCat({
        id: catId,
        color: (color || undefined) as CatColor | undefined,
        age: (age || undefined) as CatAge | undefined,
        sex: (sex || undefined) as CatSex | undefined,
        sociability: (sociability || undefined) as CatSociability | undefined,
        cat_status: (catStatus || undefined) as CatStatus | undefined,
        caretaker: caretaker || undefined,
        notes: notes || undefined,
        is_adoptable: isAdoptable,
      });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      syncAllPendingRegions();
      // Re-fetch to get updated data
      await fetchCat();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, [
    catId,
    color,
    age,
    sex,
    sociability,
    catStatus,
    caretaker,
    notes,
    isAdoptable,
    fetchCat,
  ]);

  const handleCancel = useCallback(() => {
    if (cat) populateForm(cat);
  }, [cat, populateForm]);

  const handleToggleAdoptable = useCallback(async () => {
    if (!catId) return;
    const newVal = !isAdoptable;
    setIsAdoptable(newVal);
    try {
      await editCat({ id: catId, is_adoptable: newVal });
      syncAllPendingRegions();
    } catch (err) {
      console.error("Failed to toggle adoptable:", err);
      setIsAdoptable(!newVal); // revert
    }
  }, [catId, isAdoptable]);

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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
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
          <TopTabs active="General" />

          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          ) : null}

          <div className="space-y-4">
            {/* Green form section */}
            <div className="overflow-hidden rounded-2xl bg-brand-green p-4">
              <div className="space-y-4">
                {/* Adoptable toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">
                    Adoptable/Fosterable?
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleAdoptable}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${isAdoptable ? "bg-brand-orange" : "bg-white/30"}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${isAdoptable ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                </div>

                {/* Last seen at */}
                <div>
                  <p className="text-xs font-bold text-brand-yellow">Last seen at:</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {formatDate(cat?.last_updated_at)} /{" "}
                    {cat?.spot_last_seen || "—"}
                  </p>
                </div>

                <FormSelect label="Color" options={CAT_COLOR_VALUES} value={color} onChange={setColor} />
                <FormSelect label="Size/Age" options={CAT_AGE_VALUES} value={age} onChange={setAge} />
                <FormSelect label="Sex" options={CAT_SEX_VALUES} value={sex} onChange={setSex} />
                <FormSelect label="Sociability" options={CAT_SOCIABILITY_VALUES} value={sociability} onChange={setSociability} />
                <FormSelect label="Status" options={CAT_STATUS_VALUES} value={catStatus} onChange={setCatStatus} />

                <div>
                  <label className="text-xs font-bold text-brand-yellow">Caretaker</label>
                  <input
                    value={caretaker}
                    onChange={(e) => setCaretaker(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-pink-200 bg-brand-cream px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-brand-yellow">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1.5 h-20 w-full resize-none rounded-xl border border-pink-200 bg-brand-cream px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowDiscardDialog(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-brand-orange px-4 py-2.5 text-sm font-bold text-brand-orange transition-colors hover:bg-brand-orange hover:text-white"
              >
                Cancel <span>✕</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowSaveDialog(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : <><span>Save</span> <span>✓</span></>}
              </button>
            </div>
          </div>
        </PageContent>
      </div>

      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Database
          </h1>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Add entry
            <span className="text-lg leading-none">+</span>
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-border">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search"
                className="h-9 w-full rounded-full bg-brand-cream px-4 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>

            <button
              type="button"
              onClick={() => setShowDesktopFilters((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-brand-cream px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-border"
            >
              Filter
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              className="flex items-center gap-1 rounded-full bg-brand-cream px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-border"
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
                  className="rounded-full bg-brand-cream px-3 py-1 text-xs text-foreground"
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

        <section className="mt-4 overflow-hidden rounded-2xl bg-brand-green p-5 ring-1 ring-brand-green">
          <div className="flex gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <ImagePlaceholderIcon className="h-9 w-9 text-white/50" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-xl font-bold tracking-tight text-white">
                  {cat?.name || "Unnamed"}
                </h2>
                {sexSymbol(cat?.sex) ? (
                  <span className="text-xl font-semibold text-white/70">
                    {sexSymbol(cat?.sex)}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {cat?.color ? (
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                    {cat.color}
                  </span>
                ) : null}
                {cat?.age ? (
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                    {cat.age}
                  </span>
                ) : null}
                {cat?.sociability && cat.sociability !== "Unknown" ? (
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                    {cat.sociability}
                  </span>
                ) : null}
              </div>

              <p className="mt-3 text-sm text-white/70">
                Last seen: {cat?.spot_last_seen || "—"} &middot;{" "}
                {formatDate(cat?.last_updated_at)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <TopTabs active="General" />
            <button
              type="button"
              onClick={handleToggleAdoptable}
              className="ml-4 flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white"
            >
              <span>Adoptable</span>
              <span
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${isAdoptable ? "bg-brand-orange" : "bg-white/30"}`}
              >
                <span
                  className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${isAdoptable ? "translate-x-3.5" : "translate-x-0.5"}`}
                />
              </span>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <FormSelect label="Color" options={CAT_COLOR_VALUES} value={color} onChange={setColor} />
            <FormSelect label="Size/Age" options={CAT_AGE_VALUES} value={age} onChange={setAge} />
            <FormSelect label="Sex" options={CAT_SEX_VALUES} value={sex} onChange={setSex} />
            <FormSelect label="Sociability" options={CAT_SOCIABILITY_VALUES} value={sociability} onChange={setSociability} />
            <FormSelect label="Status" options={CAT_STATUS_VALUES} value={catStatus} onChange={setCatStatus} />
            <div>
              <label className="text-xs font-bold text-brand-orange">Caretaker</label>
              <input
                value={caretaker}
                onChange={(e) => setCaretaker(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-pink-200 bg-brand-cream px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="text-xs font-bold text-brand-orange">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5 h-20 w-full resize-none rounded-xl border border-pink-200 bg-brand-cream px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border-2 border-white px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-white hover:text-brand-green"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </section>
      </div>

      <DiscardChangesDialog
        open={showDiscardDialog}
        onClose={() => setShowDiscardDialog(false)}
        onConfirm={() => { handleCancel(); setShowDiscardDialog(false); }}
      />
      <SaveChangesDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onConfirm={() => { handleSave(); setShowSaveDialog(false); }}
        isLoading={saving}
      />
    </>
  );
}
