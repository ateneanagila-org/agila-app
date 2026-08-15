"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Crop, Pencil, Maximize2 } from "lucide-react";
import {
  CameraIcon,
  CloseIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/app-pages/shared/icons";
import { CatPhoto } from "@/components/app-pages/shared/cat-photo";
import { PhotoCaptureDialog } from "@/components/app-pages/shared/photo-capture-dialog";
import {
  PhotoPositionEditor,
  createNormalizedPhotoFile,
} from "@/components/app-pages/shared/photo-position-editor";
import {
  DEFAULT_PHOTO_POSITION,
  type PhotoPosition,
} from "@/lib/photo-position";
import {
  uploadCatPhoto,
  removeCatPhoto,
  editCatPhotoPosition,
} from "@/app/actions/cat-photo";

type PhotoLightboxProps = {
  catId: string;
  photoUrl?: string | null;
  name?: string | null;
  position?: PhotoPosition | null;
  /** Action bar (Take/Choose/Edit/Remove) only renders when true. */
  canEdit?: boolean;
  onClose: () => void;
  /** Called after any successful mutation so the parent can refresh. */
  onChanged?: () => void;
};

type Mode = "view" | "crop";

export function PhotoLightbox({
  catId,
  photoUrl,
  name,
  position,
  canEdit = false,
  onClose,
  onChanged,
}: PhotoLightboxProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCapture, setShowCapture] = useState(false);

  // Crop session: a freshly picked file (upload path) OR null (re-crop existing).
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [cropPosition, setCropPosition] = useState<PhotoPosition>(
    DEFAULT_PHOTO_POSITION,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Object URL lifecycle for the pending (newly picked) file.
  useEffect(() => {
    if (!pendingFile) {
      setPendingUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const beginCropNewFile = useCallback((file: File) => {
    setPendingFile(file);
    setCropPosition(DEFAULT_PHOTO_POSITION);
    setError(null);
    setMode("crop");
  }, []);

  const beginRecropExisting = useCallback(() => {
    setPendingFile(null);
    setCropPosition(position ?? DEFAULT_PHOTO_POSITION);
    setError(null);
    setMode("crop");
  }, [position]);

  const cancelCrop = useCallback(() => {
    setPendingFile(null);
    setMode("view");
    setError(null);
  }, []);

  const handleSaveCrop = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (pendingFile) {
        const fd = new FormData();
        const normalized = await createNormalizedPhotoFile(pendingFile);
        fd.append("file", normalized);
        fd.append("photo_zoom", String(cropPosition.zoom));
        fd.append("photo_offset_x", String(cropPosition.offsetX));
        fd.append("photo_offset_y", String(cropPosition.offsetY));
        fd.append("photo_rotation", String(cropPosition.rotation));
        await uploadCatPhoto(catId, fd);
      } else {
        await editCatPhotoPosition(catId, cropPosition);
      }
      setPendingFile(null);
      setMode("view");
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }, [catId, pendingFile, cropPosition, onChanged]);

  const handleRemove = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await removeCatPhoto(catId);
      onChanged?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed.");
      setBusy(false);
    }
  }, [catId, onChanged, onClose]);

  const cropSrc = pendingUrl ?? photoUrl ?? "";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-brand-dark/90 backdrop-blur-sm">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-brand-green-foreground">
        <p className="truncate font-heading text-lg font-bold tracking-tight">
          {name || "Cat"}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
          aria-label="Close"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Stage — tapping the empty area dismisses (view mode only, so crop edits
          aren't lost). The image/editor are children, so target !== currentTarget. */}
      <div
        className="flex min-h-0 flex-1 items-center justify-center px-4 pb-2"
        onClick={(e) => {
          if (mode === "view" && e.target === e.currentTarget) onClose();
        }}
      >
        {mode === "crop" ? (
          <div className="w-full max-w-md">
            <PhotoPositionEditor
              src={cropSrc}
              position={cropPosition}
              onChange={setCropPosition}
            />
          </div>
        ) : photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={name || "Cat"}
            className="max-h-full max-w-full select-none rounded-lg object-contain"
            draggable={false}
          />
        ) : (
          <div className="rounded-2xl bg-white/10 px-6 py-10 text-sm text-white/70">
            No photo yet.
          </div>
        )}
      </div>

      {error ? (
        <p
          className="mx-4 mb-2 rounded-lg bg-red-500/90 px-3 py-2 text-center text-xs font-medium text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {error}
        </p>
      ) : null}

      {/* Action bar */}
      {canEdit ? (
        <div
          className="flex items-center justify-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1"
          onClick={(e) => e.stopPropagation()}
        >
          {mode === "crop" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={cancelCrop}
                className="rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/25 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !cropSrc}
                onClick={handleSaveCrop}
                className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-6 py-2.5 text-sm font-bold text-brand-orange-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </>
          ) : (
            <>
              <LightboxAction
                label="Take"
                onClick={() => setShowCapture(true)}
                disabled={busy}
              >
                <CameraIcon className="h-5 w-5" />
              </LightboxAction>
              <LightboxAction
                label="Choose"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <UploadIcon className="h-5 w-5" />
              </LightboxAction>
              {photoUrl ? (
                <LightboxAction
                  label="Edit crop"
                  onClick={beginRecropExisting}
                  disabled={busy}
                >
                  <Crop className="h-5 w-5" />
                </LightboxAction>
              ) : null}
              {photoUrl ? (
                <LightboxAction
                  label="Remove"
                  onClick={handleRemove}
                  disabled={busy}
                  danger
                >
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <TrashIcon className="h-5 w-5" />
                  )}
                </LightboxAction>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) beginCropNewFile(f);
        }}
      />

      {showCapture ? (
        <PhotoCaptureDialog
          onCapture={(file) => {
            setShowCapture(false);
            beginCropNewFile(file);
          }}
          onClose={() => setShowCapture(false)}
          onChooseFile={() => {
            setShowCapture(false);
            fileInputRef.current?.click();
          }}
        />
      ) : null}
    </div>
  );
}

function LightboxAction({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-w-16 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
        danger
          ? "bg-red-500/20 text-red-100 hover:bg-red-500/30"
          : "bg-white/15 text-white hover:bg-white/25"
      }`}
    >
      {children}
      {label}
    </button>
  );
}

type CatPhotoButtonProps = {
  catId: string;
  photoUrl?: string | null;
  name?: string | null;
  position?: PhotoPosition | null;
  canEdit?: boolean;
  onChanged?: () => void;
  className?: string;
  iconClassName?: string;
  sizes?: string;
  fit?: "cover" | "contain";
};

/**
 * A CatPhoto that opens the focused lightbox on click. Shows a pencil badge when
 * editable, an expand badge when view-only. Sizing/rounding goes on `className`
 * (applied to the button); the inner photo fills it.
 */
export function CatPhotoButton({
  catId,
  photoUrl,
  name,
  position,
  canEdit = false,
  onChanged,
  className = "",
  iconClassName,
  sizes,
  fit = "contain",
}: CatPhotoButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative block cursor-zoom-in overflow-hidden ${className}`}
        aria-label={canEdit ? "View or edit photo" : "View photo"}
      >
        <CatPhoto
          photoUrl={photoUrl}
          name={name}
          position={position}
          className="h-full w-full"
          iconClassName={iconClassName}
          sizes={sizes}
          fit={fit}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-dark/55 text-white opacity-90 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100"
        >
          {canEdit ? (
            <Pencil className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </span>
      </button>

      {open ? (
        <PhotoLightbox
          catId={catId}
          photoUrl={photoUrl}
          name={name}
          position={position}
          canEdit={canEdit}
          onClose={() => setOpen(false)}
          onChanged={onChanged}
        />
      ) : null}
    </>
  );
}
