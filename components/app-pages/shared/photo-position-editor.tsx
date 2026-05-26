"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";

export type PhotoPosition = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export const DEFAULT_PHOTO_POSITION: PhotoPosition = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

const OUTPUT_SIZE = 1200;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function photoFilename(file: File) {
  return /\.[^.]+$/.test(file.name)
    ? file.name.replace(/\.[^.]+$/, ".jpg")
    : `${file.name}.jpg`;
}

function getOffsetBounds(
  imageSize: { width: number; height: number } | null,
  zoom: number,
) {
  if (!imageSize?.width || !imageSize.height) {
    return { x: 50, y: 50 };
  }

  const baseScale = Math.max(1 / imageSize.width, 1 / imageSize.height);
  const width = imageSize.width * baseScale * zoom;
  const height = imageSize.height * baseScale * zoom;

  return {
    x: Math.max(0, ((width - 1) / 2) * 100),
    y: Math.max(0, ((height - 1) / 2) * 100),
  };
}

function clampPosition(
  position: PhotoPosition,
  bounds: { x: number; y: number },
): PhotoPosition {
  return {
    zoom: clamp(position.zoom, 1, 3),
    offsetX: clamp(position.offsetX, -bounds.x, bounds.x),
    offsetY: clamp(position.offsetY, -bounds.y, bounds.y),
  };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = src;
  });
}

export async function createPositionedPhotoFile(
  file: File,
  position: PhotoPosition,
) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.fillStyle = "#d8fcf2";
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    const bounds = getOffsetBounds(
      { width: image.naturalWidth, height: image.naturalHeight },
      position.zoom,
    );
    const safePosition = clampPosition(position, bounds);
    const baseScale = Math.max(
      OUTPUT_SIZE / image.naturalWidth,
      OUTPUT_SIZE / image.naturalHeight,
    );
    const scale = baseScale * safePosition.zoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const x =
      (OUTPUT_SIZE - width) / 2 + (safePosition.offsetX / 100) * OUTPUT_SIZE;
    const y =
      (OUTPUT_SIZE - height) / 2 + (safePosition.offsetY / 100) * OUTPUT_SIZE;

    ctx.drawImage(image, x, y, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
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
  const bounds = useMemo(
    () => getOffsetBounds(currentImageSize, position.zoom),
    [currentImageSize, position.zoom],
  );
  const previewPosition = clampPosition(position, bounds);
  const previewStyle: CSSProperties = currentImageSize
    ? {
        left: `calc(50% + ${previewPosition.offsetX}%)`,
        top: `calc(50% + ${previewPosition.offsetY}%)`,
        width:
          currentImageSize.width >= currentImageSize.height
            ? `${(currentImageSize.width / currentImageSize.height) * 100}%`
            : "100%",
        height:
          currentImageSize.width >= currentImageSize.height
            ? "100%"
            : `${(currentImageSize.height / currentImageSize.width) * 100}%`,
        transform: `translate(-50%, -50%) scale(${previewPosition.zoom})`,
      }
    : {
        left: "50%",
        top: "50%",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: `translate(-50%, -50%) scale(${previewPosition.zoom})`,
      };

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
            const nextBounds = getOffsetBounds(currentImageSize, current.zoom);
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
            min="1"
            max="3"
            step="0.05"
            value={position.zoom}
            onChange={(event) => {
              const zoom = Number(event.target.value);
              onChange((current) =>
                clampPosition(
                  { ...current, zoom },
                  getOffsetBounds(currentImageSize, zoom),
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
