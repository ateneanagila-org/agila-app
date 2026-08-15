import type { CSSProperties } from "react";

/**
 * Crop-as-metadata geometry. The stored blob is the full normalized original;
 * the visible crop is this zoom/offset/rotation trio applied at render time.
 * The math here is the single source of truth shared by the editor preview
 * (PhotoPositionEditor) and the display (CatPhoto), so what you frame is exactly
 * what renders. Offsets are percentages of the square frame; zoom is 1..3.
 * Rotation is a quarter-turn CSS `transform` applied about the element's own
 * centre, so drag deltas never need axis remapping (a rightward drag is always
 * +offsetX), but the effective width/height swap at 90/270, which changes the
 * pan bounds and the cover-sizing math.
 */
export type PhotoPosition = {
  zoom: number;
  offsetX: number;
  offsetY: number;
  /** Quarter-turn rotation applied at render time. One of 0 | 90 | 180 | 270. */
  rotation: number;
};

export const DEFAULT_PHOTO_POSITION: PhotoPosition = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
};

export const PHOTO_ZOOM_MIN = 1;
export const PHOTO_ZOOM_MAX = 3;

export const PHOTO_ROTATIONS = [0, 90, 180, 270] as const;

export type ImageSize = { width: number; height: number };

/** Identity = centered cover, indistinguishable from a legacy baked crop. */
export function isIdentityPosition(p: PhotoPosition): boolean {
  return (
    p.zoom === 1 && p.offsetX === 0 && p.offsetY === 0 && p.rotation === 0
  );
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Any value that is not one of the four allowed angles becomes 0. */
export function normalizeRotation(value: unknown): number {
  return (PHOTO_ROTATIONS as readonly number[]).includes(value as number)
    ? (value as number)
    : 0;
}

/** True when a quarter turn swaps the image's effective width and height. */
function isQuarterTurn(rotation: number): boolean {
  return rotation === 90 || rotation === 270;
}

/** Post-rotation footprint of the source image. */
function effectiveSize(imageSize: ImageSize, rotation: number): ImageSize {
  return isQuarterTurn(rotation)
    ? { width: imageSize.height, height: imageSize.width }
    : imageSize;
}

/** Pull a position out of a cat-shaped row, falling back to identity. */
export function positionFromCat(cat: {
  photo_zoom?: number | null;
  photo_offset_x?: number | null;
  photo_offset_y?: number | null;
  photo_rotation?: number | null;
}): PhotoPosition {
  return {
    zoom: cat.photo_zoom ?? 1,
    offsetX: cat.photo_offset_x ?? 0,
    offsetY: cat.photo_offset_y ?? 0,
    rotation: normalizeRotation(cat.photo_rotation ?? 0),
  };
}

export function getOffsetBounds(
  imageSize: ImageSize | null,
  zoom: number,
  rotation: number = 0,
): { x: number; y: number } {
  if (!imageSize?.width || !imageSize.height) {
    return { x: 50, y: 50 };
  }

  const { width: ew, height: eh } = effectiveSize(imageSize, rotation);
  const baseScale = Math.max(1 / ew, 1 / eh);
  const width = ew * baseScale * zoom;
  const height = eh * baseScale * zoom;

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
    rotation: normalizeRotation(position.rotation),
  };
}

/**
 * CSS for an absolutely-positioned <img> inside a `relative overflow-hidden`
 * square frame, reproducing the crop. Pass the natural image size once known;
 * until then it falls back to plain centered cover. `translate(-50%, -50%)`
 * resolves against the element's own border box, so it centres correctly at
 * every rotation angle.
 */
export function getPhotoTransformStyle(
  imageSize: ImageSize | null,
  position: PhotoPosition,
): CSSProperties {
  const rotation = normalizeRotation(position.rotation);
  const bounds = getOffsetBounds(imageSize, position.zoom, rotation);
  const safe = clampPosition(position, bounds);

  if (!imageSize?.width || !imageSize.height) {
    return {
      left: "50%",
      top: "50%",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transform: `translate(-50%, -50%) scale(${safe.zoom}) rotate(${rotation}deg)`,
    };
  }

  const { width: ew, height: eh } = effectiveSize(imageSize, rotation);
  const landscape = ew >= eh;

  // Footprint the image must present to the frame AFTER rotation.
  const footprintWidth = landscape ? (ew / eh) * 100 : 100;
  const footprintHeight = landscape ? 100 : (eh / ew) * 100;

  // A quarter turn means the element's own width becomes the footprint's
  // height and vice versa, so assign them crosswise.
  const quarter = isQuarterTurn(rotation);

  return {
    left: `calc(50% + ${safe.offsetX}%)`,
    top: `calc(50% + ${safe.offsetY}%)`,
    width: `${quarter ? footprintHeight : footprintWidth}%`,
    height: `${quarter ? footprintWidth : footprintHeight}%`,
    transform: `translate(-50%, -50%) scale(${safe.zoom}) rotate(${rotation}deg)`,
  };
}
