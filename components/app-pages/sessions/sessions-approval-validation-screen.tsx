"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DetailHeader,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import { ChangeConfirmDialog } from "@/components/app-pages/shared/dialogs";
import {
  ChevronDownIcon,
  CatIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";
import { CustomSelect } from "@/components/ui/custom-select";
import { getCats, editCat, removeCat } from "@/app/actions/cats";
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
  CatEntryStatus,
} from "@/lib/db/enums";

function DropdownField({
  label,
  options,
  value,
  onChange,
  isMobile,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (val: string) => void;
  isMobile?: boolean;
}) {
  if (isMobile) {
    return (
      <div>
        <label className="text-sm text-slate-700">{label}</label>
        <div className="relative mt-1 rounded-lg border border-slate-200 bg-white">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-full appearance-none rounded-lg bg-white px-3 pr-10 text-sm text-slate-900"
          >
            <option value="">&mdash;</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs font-medium text-white/70">{label}</label>
      <div className="relative mt-1 rounded-lg border border-white/20 bg-white/15">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full appearance-none rounded-lg bg-white/15 px-3 pr-10 text-sm text-white"
        >
          <option value="">&mdash;</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/70" />
      </div>
    </div>
  );
}

export function SessionsApprovalValidationScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const catId = searchParams.get("catId");
  const sessionId = searchParams.get("sessionId");
  const sessionCatId = searchParams.get("sessionCatId");

  const [cat, setCat] = useState<SelectCat | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // Form state
  const [color, setColor] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [sociability, setSociability] = useState("");
  const [catStatus, setCatStatus] = useState("");
  const [caretaker, setCaretaker] = useState("");
  const [notes, setNotes] = useState("");
  const [spotLastSeen, setSpotLastSeen] = useState("");

  const populateForm = useCallback((catData: SelectCat) => {
    setColor(catData.color ?? "");
    setAge(catData.age ?? "");
    setSex(catData.sex ?? "");
    setSociability(catData.sociability ?? "");
    setCatStatus(catData.cat_status ?? "");
    setCaretaker(catData.caretaker ?? "");
    setNotes(catData.notes ?? "");
    setSpotLastSeen(catData.spot_last_seen ?? "");
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

  /** Approve: save form edits + set entry_status to "Original" */
  const handleApprove = useCallback(async () => {
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
        spot_last_seen: spotLastSeen || undefined,
        entry_status: "Original" as CatEntryStatus,
      });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      setShowSaveConfirm(false);
      router.push("/dashboard/sessions/manager");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve.");
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
    spotLastSeen,
    router,
  ]);

  /** Discard: delete the cat entry entirely (cascade removes session_cats link) */
  const handleDiscard = useCallback(async () => {
    if (!catId) return;
    try {
      const result = await removeCat({ id: catId });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      setShowDiscardConfirm(false);
      router.push("/dashboard/sessions/manager");
    } catch (err) {
      console.error("Failed to discard:", err);
      setError("Failed to discard this entry.");
    }
  }, [catId, router]);

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

  const crossRefHref = catId
    ? `/dashboard/sessions/approval/cross-ref?catId=${catId}${sessionId ? `&sessionId=${sessionId}` : ""}${sessionCatId ? `&sessionCatId=${sessionCatId}` : ""}`
    : "/dashboard/sessions/approval/cross-ref";
  const backHref = "/dashboard/sessions/manager";

  return (
    <>
      <div className="tablet:hidden">
        <PageContent>
          <DetailHeader
            name={cat?.name || "Unnamed"}
            lastUpdated={formatDate(cat?.last_updated_at)}
            backHref={backHref}
          />

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowDiscardConfirm(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-brand-orange px-4 py-2.5 text-sm font-bold text-brand-orange transition-colors hover:bg-brand-orange/5"
            >
              Discard <span className="text-sm">🗑️</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setShowSaveConfirm(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Approve Instantly <span className="text-sm">✓</span>
            </button>
          </div>

          {/* Separator */}
          <div className="h-px bg-pink-200" />

          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          ) : null}

          {/* Section header */}
          <div className="flex items-center justify-between">
            <p className="font-heading text-xl font-bold text-brand-green">
              Info Validation
            </p>
            <Link
              href={crossRefHref}
              className="flex items-center gap-1 rounded-xl bg-brand-dark px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-80"
            >
              Next ›
            </Link>
          </div>

          {/* Green form card */}
          <div className="overflow-hidden rounded-2xl bg-brand-green p-4">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-brand-yellow">Last seen at:</p>
                <p className="mt-1 text-[15px] font-semibold text-white">
                  {formatDate(cat?.last_updated_at)} / {cat?.spot_last_seen || "—"}
                </p>
              </div>

              {(
                [
                  { label: "Color", options: CAT_COLOR_VALUES, value: color, onChange: setColor },
                  { label: "Size/Age", options: CAT_AGE_VALUES, value: age, onChange: setAge },
                  { label: "Sex", options: CAT_SEX_VALUES, value: sex, onChange: setSex },
                  { label: "Sociability", options: CAT_SOCIABILITY_VALUES, value: sociability, onChange: setSociability },
                  { label: "Status", options: CAT_STATUS_VALUES, value: catStatus, onChange: setCatStatus },
                ] as const
              ).map(({ label, options, value, onChange }) => (
                <div key={label}>
                  <label className="text-xs font-bold text-brand-yellow">{label}</label>
                  <div className="mt-1.5">
                    <CustomSelect options={options} value={value} onChange={onChange} variant="cream" />
                  </div>
                </div>
              ))}

              <div>
                <label className="text-xs font-bold text-brand-yellow">Caretaker</label>
                <input
                  value={caretaker}
                  onChange={(e) => setCaretaker(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-pink-200 bg-brand-cream px-3 py-2.5 text-sm text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-brand-yellow">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1.5 h-20 w-full resize-none rounded-xl border border-pink-200 bg-brand-cream px-3 py-2.5 text-sm text-slate-900 outline-none"
                />
              </div>
            </div>
          </div>
        </PageContent>
      </div>

      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Sessions
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-brand-green px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Census Report <span className="ml-1">📊</span>
            </button>
            <Link
              href={backHref}
              className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Back <span className="ml-1">&#8249;</span>
            </Link>
          </div>
        </div>

        <section className="mt-4 overflow-hidden rounded-2xl bg-brand-green p-4 ring-1 ring-brand-green">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search"
                className="h-9 w-full rounded-full bg-white/15 px-4 pr-10 text-sm text-white outline-none placeholder:text-white/60"
              />
              <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
            </div>
            <button
              type="button"
              className="flex items-center gap-1 rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Sort by <span className="ml-1">&#9662;</span>
            </button>
          </div>
        </section>

        {error ? (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        ) : null}

        <section className="mt-4 rounded-2xl bg-brand-green p-5 ring-1 ring-brand-green">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <CatIcon className="h-9 w-9 text-white/50" />
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-xl font-bold tracking-tight text-white">
                      {cat?.name || "Unnamed"}
                    </h3>
                    {sexSymbol(cat?.sex) ? (
                      <span className={`text-xl ${sexColor(cat?.sex)}`}>
                        {sexSymbol(cat?.sex)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex gap-1.5">
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
                  </div>
                  <p className="mt-3 text-sm text-white/70">
                    Last seen: {cat?.spot_last_seen || "—"} &middot;{" "}
                    {formatDate(cat?.last_updated_at)}
                  </p>
                </div>

                <Link
                  href={crossRefHref}
                  className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                >
                  Next <span className="ml-1">&#8250;</span>
                </Link>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="inline-block border-b border-white/30 pb-1 text-base font-semibold text-white">
                  For Validation
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setShowSaveConfirm(true)}
                    className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Approve <span className="ml-1">&#10003;</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDiscardConfirm(true)}
                    className="rounded-full border border-brand-orange bg-transparent px-4 py-1.5 text-sm font-bold text-brand-orange transition-opacity hover:opacity-90"
                  >
                    Cancel <span className="ml-1">&#10005;</span>
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <DropdownField
                  label="Color"
                  options={CAT_COLOR_VALUES}
                  value={color}
                  onChange={setColor}
                />
                <DropdownField
                  label="Size/Age"
                  options={CAT_AGE_VALUES}
                  value={age}
                  onChange={setAge}
                />
                <DropdownField
                  label="Sex"
                  options={CAT_SEX_VALUES}
                  value={sex}
                  onChange={setSex}
                />
                <DropdownField
                  label="Sociability"
                  options={CAT_SOCIABILITY_VALUES}
                  value={sociability}
                  onChange={setSociability}
                />
                <DropdownField
                  label="Status"
                  options={CAT_STATUS_VALUES}
                  value={catStatus}
                  onChange={setCatStatus}
                />
                <div>
                  <label className="text-xs font-medium text-white/70">
                    Caretaker
                  </label>
                  <input
                    value={caretaker}
                    onChange={(e) => setCaretaker(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-white/20 bg-white/15 px-3 text-sm text-white outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-white/70">
                  Specific Location
                </label>
                <input
                  value={spotLastSeen}
                  onChange={(e) => setSpotLastSeen(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-white/20 bg-white/15 px-3 text-sm text-white outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
                />
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-white/70">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 h-24 w-full resize-none rounded-lg border border-white/20 bg-white/15 px-3 py-2 text-sm text-white outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      <ChangeConfirmDialog
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard changes?"
        description="This cat entry will be permanently deleted."
        confirmLabel="Discard Entry"
        showAvatar
        onConfirm={handleDiscard}
      />

      <ChangeConfirmDialog
        open={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        title="Approve this entry?"
        description="This will approve the cat and mark it as an original entry."
        confirmLabel="Approve"
        onConfirm={handleApprove}
      />
    </>
  );
}
