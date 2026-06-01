"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DetailHeader,
  TopTabs,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import { CatPhoto } from "@/components/app-pages/shared/cat-photo";
import { CameraIcon, UploadIcon } from "@/components/app-pages/shared/icons";
import { PhotoCaptureDialog } from "@/components/app-pages/shared/photo-capture-dialog";
import {
  createPositionedPhotoFile,
  DEFAULT_PHOTO_POSITION,
  PhotoPositionEditor,
  type PhotoPosition,
} from "@/components/app-pages/shared/photo-position-editor";
import { CustomSelect } from "@/components/ui/custom-select";
import { editCat } from "@/app/actions/cats";
import { uploadCatPhoto } from "@/app/actions/cat-photo";
import { useAuth } from "@/contexts/auth-context";
import { useCatDetail } from "@/contexts/cat-detail-context";
import { useRegions } from "@/lib/hooks/use-regions";
import {
  DiscardChangesDialog,
  SaveChangesDialog,
} from "@/components/app-pages/database/database-dialogs";
import type { CatWithRegion } from "@/lib/repo/cats.repo";
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

function sexGlyph(s: string | null | undefined): string | null {
  if (s === "Male") return "♂";
  if (s === "Female") return "♀";
  return null;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-orange">
      {children}
    </label>
  );
}

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
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-1.5">
        <CustomSelect
          options={options}
          value={value}
          onChange={onChange}
          variant="white"
        />
      </div>
    </div>
  );
}

export function DatabaseGeneralScreen() {
  const { canManage } = useAuth();
  const { catId, cat, loading, error: ctxError, refresh } = useCatDetail();

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoPosition, setPhotoPosition] = useState<PhotoPosition>(
    DEFAULT_PHOTO_POSITION,
  );
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Form state
  const [color, setColor] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [sociability, setSociability] = useState("");
  const [catStatus, setCatStatus] = useState("");
  const [caretaker, setCaretaker] = useState("");
  const [notes, setNotes] = useState("");
  const [spotLastSeen, setSpotLastSeen] = useState("");
  const [isAdoptable, setIsAdoptable] = useState(false);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [regionFallbackName, setRegionFallbackName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const regions = useRegions();

  const populateForm = useCallback((catData: CatWithRegion) => {
    setColor(catData.color ?? "");
    setAge(catData.age ?? "");
    setSex(catData.sex ?? "");
    setSociability(catData.sociability ?? "");
    setCatStatus(catData.cat_status ?? "");
    setCaretaker(catData.caretaker ?? "");
    setNotes(catData.notes ?? "");
    setSpotLastSeen(catData.spot_last_seen ?? "");
    setIsAdoptable(catData.is_adoptable ?? false);
    setRegionId(catData.region_id ?? null);
    setRegionFallbackName(catData.region_name ?? "");
  }, []);

  // Hydrate form when cat from context resolves/changes
  useEffect(() => {
    if (cat) populateForm(cat);
  }, [cat, populateForm]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const displayError = error ?? ctxError;

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
        spot_last_seen: spotLastSeen || undefined,
        is_adoptable: isAdoptable,
        region_id: regionId,
      });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      await refresh();
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
    spotLastSeen,
    isAdoptable,
    regionId,
    refresh,
  ]);

  const handleCancel = useCallback(() => {
    if (cat) populateForm(cat);
  }, [cat, populateForm]);

  const handlePhotoSelect = useCallback((file: File | null) => {
    if (!file) return;
    setPhotoFile(file);
    setPhotoPosition(DEFAULT_PHOTO_POSITION);
  }, []);

  const handlePhotoUpload = useCallback(async () => {
    const file = photoFile;
    if (!file || !catId) return;
    setPhotoUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      const uploadFile = await createPositionedPhotoFile(file, photoPosition);
      fd.append("file", uploadFile);
      await uploadCatPhoto(catId, fd);
      setPhotoFile(null);
      setPhotoPosition(DEFAULT_PHOTO_POSITION);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed.");
    } finally {
      setPhotoUploading(false);
    }
  }, [catId, photoFile, photoPosition, refresh]);

  const handleToggleAdoptable = useCallback(async () => {
    if (!catId) return;
    const newVal = !isAdoptable;
    setIsAdoptable(newVal);
    try {
      const result = await editCat({ id: catId, is_adoptable: newVal });
      if (result?.serverError) {
        setIsAdoptable(!newVal);
        setError(result.serverError);
        return;
      }
    } catch (err) {
      console.error("Failed to toggle adoptable:", err);
      setIsAdoptable(!newVal);
      setError(
        err instanceof Error ? err.message : "Failed to toggle adoptable.",
      );
    }
  }, [catId, isAdoptable]);

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "—";
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
      </div>
    );
  }

  const sex_glyph = sexGlyph(cat?.sex);

  return (
    <>
      <PageContent>
        <DetailHeader
          name={cat?.name || "Unnamed"}
          lastUpdated={formatDate(cat?.last_updated_at)}
          backHref="/dashboard/database"
        />

        {displayError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {displayError}
          </div>
        ) : null}

        {/* Identity card */}
        <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-brand-dark/8">
          <div className="flex flex-col gap-5 p-5 tablet:flex-row tablet:items-center tablet:gap-6 tablet:p-6">
            <div className="relative h-32 w-32 shrink-0 self-center tablet:h-28 tablet:w-28 tablet:self-auto">
              <CatPhoto
                photoUrl={cat?.photo_url}
                name={cat?.name}
                className="h-full w-full overflow-hidden rounded-2xl ring-1 ring-brand-dark/10"
                iconClassName="h-12 w-12 text-brand-green/30"
                sizes="128px"
              />
              {canManage ? (
                <div
                  className={`group absolute inset-0 rounded-2xl transition-colors ${
                    photoUploading
                      ? "bg-brand-dark/40"
                      : "bg-transparent hover:bg-brand-dark/30"
                  }`}
                >
                  <div className="absolute inset-x-2 bottom-2 grid grid-cols-2 gap-1 opacity-100 transition-opacity tablet:opacity-0 tablet:group-hover:opacity-100 tablet:group-focus-within:opacity-100">
                    <button
                      type="button"
                      disabled={photoUploading}
                      onClick={() => setShowPhotoCapture(true)}
                      className="inline-flex h-8 items-center justify-center rounded-full bg-brand-orange text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                      aria-label="Take photo"
                    >
                      <CameraIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={photoUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex h-8 items-center justify-center rounded-full bg-white text-brand-green shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                      aria-label="Choose photo"
                    >
                      <UploadIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handlePhotoSelect(e.target.files?.[0] ?? null);
                      e.currentTarget.value = "";
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-2xl font-bold leading-tight tracking-tight text-brand-dark truncate tablet:text-3xl">
                  {cat?.name || "Unnamed"}
                </h2>
                {sex_glyph ? (
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-green/12 px-1.5 text-sm font-bold text-brand-green">
                    {sex_glyph}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {cat?.color ? (
                  <span className="inline-flex h-6 items-center rounded-full bg-brand-cream-dark/60 px-2.5 text-[11px] font-semibold text-brand-dark/75">
                    {cat.color}
                  </span>
                ) : null}
                {cat?.age ? (
                  <span className="inline-flex h-6 items-center rounded-full bg-brand-cream-dark/60 px-2.5 text-[11px] font-semibold text-brand-dark/75">
                    {cat.age}
                  </span>
                ) : null}
                {cat?.sociability ? (
                  <span className="inline-flex h-6 items-center rounded-full bg-brand-cream-dark/60 px-2.5 text-[11px] font-semibold text-brand-dark/75">
                    {cat.sociability}
                  </span>
                ) : null}
              </div>

              <p className="mt-3 flex items-baseline gap-1.5 text-xs text-brand-dark/60">
                <span className="font-bold uppercase tracking-wider text-brand-green/80 text-[10px]">
                  Last seen
                </span>
                <span className="font-semibold text-brand-dark/80">
                  {cat?.spot_last_seen || "Unknown"}
                </span>
                <span className="text-brand-dark/30">·</span>
                <span className="tabular-nums">
                  {formatDate(cat?.last_updated_at)}
                </span>
              </p>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 rounded-2xl bg-brand-cream-dark/40 px-4 py-2.5 tablet:flex-col tablet:items-end tablet:px-3 tablet:py-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-dark/60">
                Adoptable
              </span>
              <button
                type="button"
                onClick={canManage ? handleToggleAdoptable : undefined}
                disabled={!canManage}
                aria-pressed={isAdoptable}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  isAdoptable ? "bg-brand-orange" : "bg-brand-dark/15"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    isAdoptable ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="border-t border-brand-dark/8 px-5 tablet:px-6">
            <TopTabs active="General" />
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-3xl bg-white p-5 ring-1 ring-brand-dark/8 tablet:p-6">
          <div className={`grid grid-cols-1 gap-5 tablet:grid-cols-2 tablet:gap-x-6${!canManage ? " pointer-events-none opacity-60" : ""}`}>
            <FormSelect
              label="Color"
              options={CAT_COLOR_VALUES}
              value={color}
              onChange={setColor}
            />
            <FormSelect
              label="Size / Age"
              options={CAT_AGE_VALUES}
              value={age}
              onChange={setAge}
            />
            <FormSelect
              label="Sex"
              options={CAT_SEX_VALUES}
              value={sex}
              onChange={setSex}
            />
            <FormSelect
              label="Sociability"
              options={CAT_SOCIABILITY_VALUES}
              value={sociability}
              onChange={setSociability}
            />
            <FormSelect
              label="Status"
              options={CAT_STATUS_VALUES}
              value={catStatus}
              onChange={setCatStatus}
            />
            <FormSelect
              label="Region (override)"
              options={regions.map((r) => r.name)}
              value={
                regions.find((r) => r.id === regionId)?.name ??
                regionFallbackName
              }
              onChange={(name) =>
                setRegionId(regions.find((r) => r.name === name)?.id ?? null)
              }
            />
            <div>
              <FieldLabel>Caretaker</FieldLabel>
              <input
                value={caretaker}
                onChange={(e) => setCaretaker(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-full border border-brand-dark/15 bg-white px-4 text-sm text-brand-dark outline-none transition-colors placeholder:text-brand-dark/30 focus:border-brand-orange"
              />
            </div>
            <div>
              <FieldLabel>Spot Last Seen</FieldLabel>
              <input
                value={spotLastSeen}
                onChange={(e) => setSpotLastSeen(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-full border border-brand-dark/15 bg-white px-4 text-sm text-brand-dark outline-none transition-colors placeholder:text-brand-dark/30 focus:border-brand-orange"
              />
            </div>
            <div className="tablet:col-span-2">
              <FieldLabel>Notes</FieldLabel>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="mt-1.5 w-full resize-none rounded-2xl border border-brand-dark/15 bg-white px-4 py-3 text-sm text-brand-dark outline-none transition-colors placeholder:text-brand-dark/30 focus:border-brand-orange"
              />
            </div>
          </div>

          {canManage ? (
            <div className="mt-6 flex items-center justify-end gap-2 border-t border-brand-dark/8 pt-4">
              <button
                type="button"
                onClick={() => setShowDiscardDialog(true)}
                className="rounded-full border-2 border-brand-dark/15 px-5 py-2 text-sm font-bold text-brand-dark/70 transition-colors hover:border-brand-dark/40 hover:text-brand-dark"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowSaveDialog(true)}
                className="rounded-full bg-brand-orange px-6 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          ) : null}
        </div>
      </PageContent>

      <DiscardChangesDialog
        open={showDiscardDialog}
        onClose={() => setShowDiscardDialog(false)}
        onConfirm={() => {
          handleCancel();
          setShowDiscardDialog(false);
        }}
      />
      <SaveChangesDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onConfirm={() => {
          handleSave();
          setShowSaveDialog(false);
        }}
        isLoading={saving}
      />

      {photoPreview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5 backdrop-blur-[2px]"
          onClick={() => {
            if (!photoUploading) {
              setPhotoFile(null);
              setPhotoPosition(DEFAULT_PHOTO_POSITION);
            }
          }}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-2xl bg-brand-cream p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight text-brand-green">
                Position Photo
              </h2>
              <p className="mt-1 text-xs font-semibold text-brand-dark/60">
                Drag to move, then use the slider to zoom.
              </p>
            </div>

            <PhotoPositionEditor
              src={photoPreview}
              position={photoPosition}
              onChange={setPhotoPosition}
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={photoUploading}
                onClick={() => {
                  setPhotoFile(null);
                  setPhotoPosition(DEFAULT_PHOTO_POSITION);
                }}
                className="rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={photoUploading}
                onClick={handlePhotoUpload}
                className="rounded-full bg-brand-orange px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {photoUploading ? "Uploading..." : "Use Photo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPhotoCapture ? (
        <PhotoCaptureDialog
          onCapture={(file) => handlePhotoSelect(file)}
          onClose={() => setShowPhotoCapture(false)}
          onChooseFile={() => fileInputRef.current?.click()}
        />
      ) : null}
    </>
  );
}
