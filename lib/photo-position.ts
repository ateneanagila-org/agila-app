import type { CSSProperties } from "react";

/**
 * Crop-as-metadata geometry. The stored blob is the full normalized original;
 * the visible crop is this zoom/offset trio applied at render time. The math
 * here is the single source of truth shared by the editor preview
 * (PhotoPositionEditor) and the display (CatPhoto), so what you frame is exactly
 * what renders. Offsets are percentages of the square frame; zoom is 1..3.
 */
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

export const PHOTO_ZOOM_MIN = 1;
export const PHOTO_ZOOM_MAX = 3;

export type ImageSize = { width: number; height: number };

/** Identity = centered cover, indistinguishable from a legacy baked crop. */
export function isIdentityPosition(p: PhotoPosition): boolean {
  return p.zoom === 1 && p.offsetX === 0 && p.offsetY === 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Pull a position out of a cat-shaped row, falling back to identity. */
export function positionFromCat(cat: {
  photo_zoom?: number | null;
  photo_offset_x?: number | null;
  photo_offset_y?: number | null;
}): PhotoPosition {
  return {
    zoom: cat.photo_zoom ?? 1,
    offsetX: cat.photo_offset_x ?? 0,
    offsetY: cat.photo_offset_y ?? 0,
  };
}

export function getOffsetBounds(
  imageSize: ImageSize | null,
  zoom: number,
): { x: number; y: number } {
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

export function clampPosition(
  position: PhotoPosition,
  bounds: { x: number; y: number },
): PhotoPosition {
  return {
    zoom: clamp(position.zoom, PHOTO_ZOOM_MIN, PHOTO_ZOOM_MAX),
    offsetX: clamp(position.offsetX, -bounds.x, bounds.x),
    offsetY: clamp(position.offsetY, -bounds.y, bounds.y),
  };
}

/**
 * CSS for an absolutely-positioned <img> inside a `relative overflow-hidden`
 * square frame, reproducing the crop. Pass the natural image size once known;
 * until then it falls back to plain centered cover.
 */
export function getPhotoTransformStyle(
  imageSize: ImageSize | null,
  position: PhotoPosition,
): CSSProperties {
  const bounds = getOffsetBounds(imageSize, position.zoom);
  const safe = clampPosition(position, bounds);

  if (!imageSize?.width || !imageSize.height) {
    return {
      left: "50%",
      top: "50%",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transform: `translate(-50%, -50%) scale(${safe.zoom})`,
    };
  }

  const landscape = imageSize.width >= imageSize.height;
  return {
    left: `calc(50% + ${safe.offsetX}%)`,
    top: `calc(50% + ${safe.offsetY}%)`,
    width: landscape
      ? `${(imageSize.width / imageSize.height) * 100}%`
      : "100%",
    height: landscape
      ? "100%"
      : `${(imageSize.height / imageSize.width) * 100}%`,
    transform: `translate(-50%, -50%) scale(${safe.zoom})`,
  };
}
