"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createCat, editCat, getCatHealthRecords } from "@/app/actions/cats";
import { uploadCatPhoto, removeCatPhoto } from "@/app/actions/cat-photo";
import { createSessionCat } from "@/app/actions/sessions";
import { useRegions } from "@/lib/hooks/use-regions";
import { CustomSelect } from "@/components/ui/custom-select";
import { CameraIcon, UploadIcon } from "@/components/app-pages/shared/icons";
import { PhotoCaptureDialog } from "@/components/app-pages/shared/photo-capture-dialog";
import {
  createPositionedPhotoFile,
  DEFAULT_PHOTO_POSITION,
  PhotoPositionEditor,
  type PhotoPosition,
} from "@/components/app-pages/shared/photo-position-editor";
import {
  CAT_COLOR_VALUES,
  CAT_AGE_VALUES,
  CAT_SEX_VALUES,
  CAT_SOCIABILITY_VALUES,
  CATHEALTHRECORD_CONDITION_VALUES,
} from "@/lib/db/enums";
import type {
  CatColor,
  CatAge,
  CatSex,
  CatSociability,
  CatHealthRecordCondition,
} from "@/lib/db/enums";
import type { SelectCat } from "@/lib/validation/cats";
import { normalizeCatField } from "@/lib/utils";

const NEUTERED_OPTIONS = ["Unknown", "Yes", "No"] as const;

/** Sheet col G semantics: true=YES, false=NO, null=??? (unknown). */
function neuteredToLabel(b: boolean | null | undefined): string {
  return b === true ? "Yes" : b === false ? "No" : "Unknown";
}
// Unknown is a real tri-state value here (sheet col G "???"), so it persists as
// null rather than being omitted — selecting Unknown actually resets the field.
function neuteredToValue(s: string): boolean | null {
  return s === "Yes" ? true : s === "No" ? false : null;
}

type CatEntryFormProps = {
  onClose: () => void;
  /** Called after successful save — parent can re-fetch data */
  onSave?: () => void;
  /** Pre-selected region ID. If provided, region dropdown is hidden. */
  regionId?: string;
  /** If provided, entry will be created under this session via createSessionCat. */
  sessionId?: string;
  /** When provided: edit mode — pre-fills fields, calls editCat on save */
  initialCat?: SelectCat;
};

function DropdownField({
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
      <label className="text-sm font-semibold text-brand-orange">{label}</label>
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

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-brand-orange">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-2xl border border-brand-orange/30 bg-white px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-brand-orange/40"
      />
    </div>
  );
}

export function CatEntryForm({
  onClose,
  onSave,
  regionId,
  sessionId,
  initialCat,
}: CatEntryFormProps) {
  const [color, setColor] = useState(
    initialCat?.color ?? (initialCat ? "Unknown" : ""),
  );
  const [age, setAge] = useState(
    initialCat?.age ?? (initialCat ? "Unknown" : ""),
  );
  const [sex, setSex] = useState(
    initialCat?.sex ?? (initialCat ? "Unknown" : ""),
  );
  const [sociability, setSociability] = useState(
    initialCat?.sociability ?? (initialCat ? "Unknown" : ""),
  );
  const [condition, setCondition] = useState(initialCat ? "Unknown" : "");
  const [neutered, setNeutered] = useState("Unknown");
  const [spotLastSeen, setSpotLastSeen] = useState(
    initialCat?.spot_last_seen ?? "",
  );
  const [caretaker, setCaretaker] = useState(initialCat?.caretaker ?? "");
  const [notes, setNotes] = useState(initialCat?.notes ?? "");
  const [name, setName] = useState(initialCat?.name ?? "");
  const [selectedRegion, setSelectedRegion] = useState("");
  const regionOptions = useRegions();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoWarning, setPhotoWarning] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoPosition, setPhotoPosition] = useState<PhotoPosition>(
    DEFAULT_PHOTO_POSITION,
  );
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const existingPhotoUrlRef = useRef<string | null>(
    initialCat?.photo_url ?? null,
  );
  const [removedExisting, setRemovedExisting] = useState(false);
  // Cat already created in DB; subsequent Save clicks only retry the photo upload.
  const [savedCatId, setSavedCatId] = useState<string | null>(
    initialCat?.id ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  useEffect(() => {
    if (!initialCat) return;
    getCatHealthRecords({ cat_id: initialCat.id }).then((res) => {
      const rec = res?.data?.[0];
      setCondition(rec?.condition ?? "Unknown");
      setNeutered(neuteredToLabel(rec?.is_neutered));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    const effectiveRegionId = regionId ?? selectedRegion;
    if (!effectiveRegionId) {
      setError("Please select a region/location.");
      return;
    }
    setSaving(true);
    setError(null);
    setPhotoWarning(null);
    try {
      // Edit mode: update existing cat
      if (initialCat) {
        const result = await editCat({
          id: initialCat.id,
          condition: normalizeCatField<CatHealthRecordCondition>(condition),
          is_neutered: neuteredToValue(neutered),
          color: normalizeCatField<CatColor>(color),
          age: normalizeCatField<CatAge>(age),
          sex: normalizeCatField<CatSex>(sex),
          sociability: normalizeCatField<CatSociability>(sociability),
          spot_last_seen: spotLastSeen || undefined,
          caretaker: caretaker || undefined,
          notes: notes || undefined,
          name: name || undefined,
        });
        if (result?.serverError) {
          setError(result.serverError);
          return;
        }
        if (photoFile) {
          try {
            const fd = new FormData();
            const uploadFile = await createPositionedPhotoFile(
              photoFile,
              photoPosition,
            );
            fd.append("file", uploadFile);
            await uploadCatPhoto(initialCat.id, fd);
          } catch (uploadErr) {
            setPhotoWarning(
              uploadErr instanceof Error
                ? `Cat saved, but photo upload failed: ${uploadErr.message}. Click Save to retry.`
                : "Cat saved, but photo upload failed. Click Save to retry.",
            );
            return;
          }
        } else if (removedExisting && existingPhotoUrlRef.current) {
          await removeCatPhoto(initialCat.id);
        }
        onSave?.();
        onClose();
        return;
      }

      let newCatId: string | undefined = savedCatId ?? undefined;

      // Skip cat-create when retrying after a photo-upload failure.
      if (!newCatId) {
        const payload = {
          region_id: effectiveRegionId,
          condition: normalizeCatField<CatHealthRecordCondition>(condition),
          is_neutered: neuteredToValue(neutered),
          color: normalizeCatField<CatColor>(color),
          age: normalizeCatField<CatAge>(age),
          sex: normalizeCatField<CatSex>(sex),
          sociability: normalizeCatField<CatSociability>(sociability),
          spot_last_seen: spotLastSeen || undefined,
          caretaker: caretaker || undefined,
          notes: notes || undefined,
          name: name || undefined,
        };

        if (sessionId) {
          const result = await createSessionCat({
            ...payload,
            session_id: sessionId,
          });
          if (result?.serverError) {
            setError(result.serverError);
            return;
          }
          if (result?.data) {
            newCatId = result.data.id;
          }
        } else {
          const result = await createCat(payload);
          if (result?.serverError) {
            setError(result.serverError);
            return;
          }
          const created = Array.isArray(result?.data)
            ? result.data[0]
            : result?.data;
          newCatId = (created as { id?: string } | undefined)?.id;
        }

        if (newCatId) setSavedCatId(newCatId);
        // Refresh parent list so the cat appears even if photo retry fails.
        onSave?.();
      }

      if (photoFile && newCatId) {
        try {
          const fd = new FormData();
          const uploadFile = await createPositionedPhotoFile(
            photoFile,
            photoPosition,
          );
          fd.append("file", uploadFile);
          await uploadCatPhoto(newCatId, fd);
        } catch (uploadErr) {
          console.error("Photo upload failed:", uploadErr);
          setPhotoWarning(
            uploadErr instanceof Error
              ? `Cat saved, but photo upload failed: ${uploadErr.message}. Click Save to retry the photo, or Skip to dismiss.`
              : "Cat saved, but photo upload failed. Click Save to retry, or Skip to dismiss.",
          );
          return;
        }
      }

      onSave?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save cat.");
    } finally {
      setSaving(false);
    }
  }, [
    regionId,
    selectedRegion,
    condition,
    neutered,
    color,
    age,
    sex,
    sociability,
    spotLastSeen,
    caretaker,
    notes,
    name,
    sessionId,
    onSave,
    onClose,
    photoFile,
    photoPosition,
    savedCatId,
    initialCat,
    removedExisting,
  ]);

  const showPhoto =
    photoPreview ??
    (existingPhotoUrlRef.current && !removedExisting
      ? existingPhotoUrlRef.current
      : null);

  const handlePhotoSelect = useCallback((file: File | null) => {
    if (!file) return;
    setPhotoFile(file);
    setRemovedExisting(false);
    setPhotoPosition(DEFAULT_PHOTO_POSITION);
  }, []);

  /** Skip photo retry: dismiss warning and close form, leaving the cat saved. */
  const handleSkipPhoto = useCallback(() => {
    onSave?.();
    onClose();
  }, [onSave, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-2xl bg-brand-cream p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-bold tracking-tight text-brand-green">
            {initialCat ? "Edit Entry" : "Add Entry"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-dark text-sm text-white transition-opacity hover:opacity-80"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Error message */}
        {error ? (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        ) : null}

        {/* Photo upload partial-failure warning */}
        {photoWarning ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {photoWarning}
          </div>
        ) : null}

        {/* Scrollable fields */}
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          <div>
            <label className="text-sm font-semibold text-brand-orange">
              Photo
            </label>
            <div className="mt-1.5">
              {photoPreview ? (
                <div className="space-y-2">
                  <PhotoPositionEditor
                    src={photoPreview}
                    position={photoPosition}
                    onChange={setPhotoPosition}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPhotoCapture(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-orange px-3 py-1 text-xs font-semibold text-brand-orange transition-opacity hover:opacity-80"
                    >
                      <CameraIcon className="h-3.5 w-3.5" />
                      Retake
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-green px-3 py-1 text-xs font-semibold text-brand-green transition-opacity hover:opacity-80"
                    >
                      <UploadIcon className="h-3.5 w-3.5" />
                      File
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoPosition(DEFAULT_PHOTO_POSITION);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      className="rounded-full border border-brand-dark/20 px-3 py-1 text-xs font-semibold text-brand-dark/70 transition-opacity hover:opacity-80"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : showPhoto ? (
                <div className="relative overflow-hidden rounded-2xl border border-brand-orange/30 bg-brand-cream-dark/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={showPhoto}
                    alt="Preview"
                    className="h-40 w-full object-contain"
                  />
                  <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 gap-1 bg-linear-to-t from-black/65 to-transparent px-2 py-2">
                    <button
                      type="button"
                      onClick={() => setShowPhotoCapture(true)}
                      className="inline-flex items-center justify-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-brand-orange transition-opacity hover:opacity-90"
                    >
                      <CameraIcon className="h-3.5 w-3.5" />
                      Take
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-brand-green transition-opacity hover:opacity-90"
                    >
                      <UploadIcon className="h-3.5 w-3.5" />
                      File
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemovedExisting(true)}
                      className="rounded-full bg-black/50 px-2 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-80"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPhotoCapture(true)}
                    className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-brand-orange/35 bg-brand-orange/8 text-brand-orange transition-colors hover:border-brand-orange hover:bg-brand-orange/12"
                    aria-label="Take cat photo"
                  >
                    <CameraIcon className="h-7 w-7" />
                    <span className="text-xs font-semibold">Take photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-green/35 bg-white text-brand-green transition-colors hover:border-brand-green hover:bg-brand-green/5"
                    aria-label="Choose cat photo"
                  >
                    <UploadIcon className="h-7 w-7" />
                    <span className="text-xs font-semibold">Choose file</span>
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  handlePhotoSelect(f);
                  e.currentTarget.value = "";
                }}
              />
            </div>
          </div>
          <TextField label="Name (optional)" value={name} onChange={setName} />
          {!regionId ? (
            <div>
              <label className="text-sm font-semibold text-brand-orange">
                Location
              </label>
              <div className="mt-1.5">
                <CustomSelect
                  options={regionOptions.map((r) => r.name)}
                  value={
                    regionOptions.find((r) => r.id === selectedRegion)?.name ??
                    ""
                  }
                  onChange={(name) => {
                    const found = regionOptions.find((r) => r.name === name);
                    if (found) setSelectedRegion(found.id);
                  }}
                  placeholder="—"
                  variant="white"
                />
              </div>
            </div>
          ) : null}
          <DropdownField
            label="Color"
            options={["Unknown", ...CAT_COLOR_VALUES]}
            value={color}
            onChange={setColor}
          />
          <DropdownField
            label="Size / Age"
            options={["Unknown", ...CAT_AGE_VALUES]}
            value={age}
            onChange={setAge}
          />
          <DropdownField
            label="Sex"
            options={["Unknown", ...CAT_SEX_VALUES]}
            value={sex}
            onChange={setSex}
          />
          <DropdownField
            label="Sociability"
            options={["Unknown", ...CAT_SOCIABILITY_VALUES]}
            value={sociability}
            onChange={setSociability}
          />
          <DropdownField
            label="Condition"
            options={["Unknown", ...CATHEALTHRECORD_CONDITION_VALUES]}
            value={condition}
            onChange={setCondition}
          />
          <DropdownField
            label="Neutered"
            options={[...NEUTERED_OPTIONS]}
            value={neutered}
            onChange={setNeutered}
          />
          <TextField
            label="Spot Last Seen"
            value={spotLastSeen}
            onChange={setSpotLastSeen}
          />
          <TextField
            label="Caretaker"
            value={caretaker}
            onChange={setCaretaker}
          />
          <div>
            <label className="text-sm font-semibold text-brand-orange">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5 h-20 w-full resize-none rounded-2xl border border-brand-orange/30 bg-white px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-brand-orange/40"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          {photoWarning ? (
            <button
              type="button"
              onClick={handleSkipPhoto}
              className="flex items-center gap-1.5 rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80"
            >
              Skip Photo
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80"
            >
              Cancel <span>✕</span>
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving
              ? photoWarning
                ? "Retrying..."
                : "Saving..."
              : photoWarning
                ? "Retry Photo"
                : "Save"}{" "}
            <span>✓</span>
          </button>
        </div>
      </div>

      {showPhotoCapture ? (
        <PhotoCaptureDialog
          onCapture={(file) => handlePhotoSelect(file)}
          onClose={() => setShowPhotoCapture(false)}
          onChooseFile={() => fileInputRef.current?.click()}
        />
      ) : null}
    </div>
  );
}
