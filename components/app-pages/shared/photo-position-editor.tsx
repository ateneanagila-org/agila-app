"use client";

import { useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  DEFAULT_PHOTO_POSITION,
  getOffsetBounds,
  getPhotoTransformStyle,
  clampPosition,
  PHOTO_ZOOM_MAX,
  PHOTO_ZOOM_MIN,
  type PhotoPosition,
} from "@/lib/photo-position";

export { DEFAULT_PHOTO_POSITION } from "@/lib/photo-position";
export type { PhotoPosition } from "@/lib/photo-position";

const MAX_DIM = 1280;

function photoFilename(file: File) {
  return /\.[^.]+$/.test(file.name)
    ? file.name.replace(/\.[^.]+$/, ".jpg")
    : `${file.name}.jpg`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = src;
  });
}

/**
 * Downscale to a sane max dimension WITHOUT cropping, so the upload payload stays
 * small (server-action body limit) while the full frame is preserved. The crop
 * is stored separately as a PhotoPosition — never baked into pixels. The server
 * re-normalizes (rotate/resize) defensively.
 */
export async function createNormalizedPhotoFile(file: File): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const w = image.naturalWidth;
    const h = image.naturalHeight;
    if (!w || !h) return file;

    const scale = Math.min(1, MAX_DIM / Math.max(w, h));
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(image, 0, 0, cw, ch);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.82);
    });
    if (!blob) return file;

    return new File([blob], photoFilename(file), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

type PhotoPositionEditorProps = {
  src: string;
  position: PhotoPosition;
  onChange: Dispatch<SetStateAction<PhotoPosition>>;
};

export function PhotoPositionEditor({
  src,
  position,
  onChange,
}: PhotoPositionEditorProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [imageSize, setImageSize] = useState<{
    src: string;
    width: number;
    height: number;
  } | null>(null);
  const currentImageSize = imageSize?.src === src ? imageSize : null;
  const previewStyle = useMemo(
    () =>
      getPhotoTransformStyle(
        currentImageSize
          ? { width: currentImageSize.width, height: currentImageSize.height }
          : null,
        position,
      ),
    [currentImageSize, position],
  );

  return (
    <div className="space-y-2">
      <div
        ref={frameRef}
        className="relative aspect-square w-full touch-none overflow-hidden rounded-2xl border border-brand-orange/30 bg-brand-cream-dark/40"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          if (!dragRef.current || !frameRef.current) return;
          const rect = frameRef.current.getBoundingClientRect();
          const dx = ((event.clientX - dragRef.current.x) / rect.width) * 100;
          const dy = ((event.clientY - dragRef.current.y) / rect.height) * 100;
          dragRef.current = { x: event.clientX, y: event.clientY };
          onChange((current) => {
            const nextBounds = getOffsetBounds(
              currentImageSize
                ? {
                    width: currentImageSize.width,
                    height: currentImageSize.height,
                  }
                : null,
              current.zoom,
            );
            return clampPosition(
              {
                ...current,
                offsetX: current.offsetX + dx,
                offsetY: current.offsetY + dy,
              },
              nextBounds,
            );
          });
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Preview"
          className="absolute max-w-none select-none"
          draggable={false}
          onLoad={(event) =>
            setImageSize({
              src,
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
          style={previewStyle}
        />
      </div>

      <div className="rounded-2xl bg-white px-3 py-2 ring-1 ring-brand-dark/8">
        <div className="flex items-center gap-3">
          <span className="w-10 text-[10px] font-bold uppercase tracking-wider text-brand-orange">
            Zoom
          </span>
          <input
            type="range"
            min={PHOTO_ZOOM_MIN}
            max={PHOTO_ZOOM_MAX}
            step="0.05"
            value={position.zoom}
            onChange={(event) => {
              const zoom = Number(event.target.value);
              onChange((current) =>
                clampPosition(
                  { ...current, zoom },
                  getOffsetBounds(
                    currentImageSize
                      ? {
                          width: currentImageSize.width,
                          height: currentImageSize.height,
                        }
                      : null,
                    zoom,
                  ),
                ),
              );
            }}
            className="w-full accent-brand-orange"
          />
          <button
            type="button"
            onClick={() => onChange(DEFAULT_PHOTO_POSITION)}
            className="rounded-full border border-brand-green px-3 py-1 text-xs font-bold text-brand-green transition-opacity hover:opacity-80"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
