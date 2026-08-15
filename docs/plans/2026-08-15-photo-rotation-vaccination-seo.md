# P4 — Photo Rotation, Vaccination Visibility & Basic SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rotation control to the photo editor, replace the rejected vaccination-expiry badge with three read-only vaccination surfaces, give the public catalog a real SEO foundation, and close an unauthenticated database call on `/api/health`.

**Architecture:** Rotation follows the existing crop-as-metadata precedent — a fourth stored field with all geometry in `lib/photo-position.ts`, shared by the editor preview and the display. Vaccination adds one pure module and three read-only consumers, writing nothing. SEO converts only the catalog **detail** page to a server component (the listing stays client-rendered) and adds `sitemap.ts`, `robots.ts`, and a styled `not-found.tsx`.

**Tech Stack:** Next.js 16.1.1 (App Router), React 19.2.3, TypeScript strict, Tailwind CSS 4, Drizzle ORM + postgres.js, Supabase Postgres + Storage, Zod 4, next-safe-action 8, Jest (`testEnvironment: "node"`).

**Spec:** [docs/specs/2026-08-15-photo-rotation-vaccination-seo-design.md](../specs/2026-08-15-photo-rotation-vaccination-seo-design.md)

## Global Constraints

- **pnpm only.** Never npm.
- **Never run `pnpm dev` to verify.** Type-check with `pnpm tsc --noEmit`; test with `pnpm jest __tests__`.
- **Do NOT run `pnpm drizzle-kit push`.** The schema push is reserved for the human partner. Task 2 stops after editing `lib/db/schema.ts` and says so.
- **Services must never call `db.*` directly** — new queries go in `lib/repo/`. Pre-existing violations in `app/actions/cat-photo.ts` are extended in place, not refactored, and no *new* violation is introduced.
- **Never hardcode hex values.** Use brand tokens (`brand-green`, `brand-orange`, `brand-cream`, `brand-dark`, `brand-mint`, `brand-cream-dark`) or Tailwind semantic classes.
- **Do not write patterns that trigger setState linter errors** (synchronous calls that cascade renders).
- **Rotation is app-only metadata.** It must never reach the Google Sheet and must never enqueue a sync task. The sheet always shows the uncropped, unrotated original.
- **Allowed rotation angles are exactly `0 | 90 | 180 | 270`.** Any other value normalises to `0`.
- **`VACCINATION_EXPIRY_MONTHS = 12`**, and the 12-month boundary is **closed**: exactly 12 months is `vaccinated`, not `expired`.
- **Vaccination states are exactly `"unknown" | "vaccinated" | "expired"`**; UI labels are exactly `Unknown`, `Vaccinated`, `Expired`.
- **`expired` renders as a neutral state label only** — never an alarm chip, never a red badge, never styling that implies the app assessed the animal.
- **Vaccination writes nothing.** No schema change, no interventions, no sync, no cron.
- Mobile/desktop split point is the `tablet` (768px) breakpoint; mobile uses `tablet:hidden`, desktop uses `hidden tablet:block`.

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `lib/photo-position.ts` (modify) | All rotation + crop geometry. Single source of truth for editor and display. |
| `lib/db/schema.ts` (modify) | Adds `cats.photo_rotation`. |
| `lib/repo/cats.repo.ts` (modify) | Adds `photo_rotation` to `catReadColumns`. |
| `app/actions/cat-photo.ts` (modify) | Persists rotation on upload, re-crop, and photo removal. |
| `components/app-pages/shared/photo-position-editor.tsx` (modify) | Rotate buttons; passes rotation to bounds. |
| `lib/vaccination.ts` (create) | Vaccination state derivation. Pure, no I/O. |
| `components/app-pages/database/database-medical-screen.tsx` (modify) | Relative-age line under the date field. |
| `components/app-pages/database/database-list-screen.tsx` (modify) | Derives the `vaccination` filter field. |
| `components/app-pages/shared/cat-filter-toolbar.tsx` (modify) | `FilterableCat` gains `vaccination`. |
| `lib/hooks/filter-sort-configs.ts` (modify) | Adds the `Vaccination` filter. |
| `components/app-pages/catalog/catalog-detail-screen.tsx` (modify) | Becomes a server component; tri-state vaccination row. |
| `app/(public)/catalog/[id]/page.tsx` (modify) | Server fetch, `generateMetadata`, `notFound()`. |
| `app/layout.tsx` (modify) | `metadataBase`, OpenGraph, Twitter. |
| `app/not-found.tsx` (create) | Styled 404 mirroring `app/error.tsx`. |
| `app/sitemap.ts` (create) | Home + adoptable cats. |
| `app/robots.ts` (create) | Allow public, disallow private. |
| `app/api/health/route.ts` (modify) | Cached check, no error leak. |
| `app/api/cron/sync/route.ts` (modify) | Constant-time token compare. |

---

## Task 1: Rotation geometry

Pure functions only. No UI, no database. This task is the foundation for Task 3.

**Files:**
- Modify: `lib/photo-position.ts`
- Test: `__tests__/lib/photo-position.test.ts`

**Interfaces:**
- Produces:
  - `type PhotoPosition = { zoom: number; offsetX: number; offsetY: number; rotation: number }` — `rotation` is **required**, not optional. This is deliberate: an optional field lets `clampPosition` silently drop it and still typecheck, which is the exact bug this task guards against.
  - `PHOTO_ROTATIONS: readonly [0, 90, 180, 270]`
  - `normalizeRotation(value: unknown): number` — returns one of the four angles, `0` for anything else
  - `getOffsetBounds(imageSize: ImageSize | null, zoom: number, rotation?: number): { x: number; y: number }` — third parameter is new and defaults to `0`
  - `getPhotoTransformStyle(imageSize: ImageSize | null, position: PhotoPosition): CSSProperties` — unchanged signature
  - `positionFromCat(cat: { photo_zoom?, photo_offset_x?, photo_offset_y?, photo_rotation? }): PhotoPosition`

**Background the implementer needs:**

The stored blob is the full original; the visible crop is `zoom`/`offsetX`/`offsetY` applied at render time via an absolutely-positioned `<img>` inside a square `relative overflow-hidden` frame. `offsetX`/`offsetY` are percentages of the **frame**, driving the element's `left`/`top`.

Rotation is a CSS `transform` about the element's own centre. Two consequences that the geometry depends on:

1. **Drag deltas need no remapping.** Because `left`/`top` position the element *in frame space*, a rightward drag is `+offsetX` at every angle. Do not add axis-swapping logic.
2. **Sizing and bounds do change.** At 90° and 270° the element's post-rotation footprint has its width and height swapped, so the cover calculation must use the swapped ("effective") size.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/lib/photo-position.test.ts`:

```ts
import {
  DEFAULT_PHOTO_POSITION,
  isIdentityPosition,
  positionFromCat,
  getOffsetBounds,
  clampPosition,
  getPhotoTransformStyle,
  normalizeRotation,
} from "@/lib/photo-position";

describe("normalizeRotation", () => {
  it("passes through the four allowed angles", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(180)).toBe(180);
    expect(normalizeRotation(270)).toBe(270);
  });

  it("falls back to 0 for anything else", () => {
    expect(normalizeRotation(45)).toBe(0);
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(-90)).toBe(0);
    expect(normalizeRotation("90")).toBe(0);
    expect(normalizeRotation(null)).toBe(0);
    expect(normalizeRotation(undefined)).toBe(0);
    expect(normalizeRotation(NaN)).toBe(0);
  });
});

describe("isIdentityPosition with rotation", () => {
  it("false when only rotation is non-zero", () => {
    expect(
      isIdentityPosition({ zoom: 1, offsetX: 0, offsetY: 0, rotation: 90 }),
    ).toBe(false);
  });

  it("true when rotation is 0 and the rest is identity", () => {
    expect(isIdentityPosition(DEFAULT_PHOTO_POSITION)).toBe(true);
    expect(DEFAULT_PHOTO_POSITION.rotation).toBe(0);
  });
});

describe("positionFromCat with rotation", () => {
  it("reads a stored rotation", () => {
    expect(
      positionFromCat({
        photo_zoom: 2,
        photo_offset_x: 10,
        photo_offset_y: -5,
        photo_rotation: 270,
      }),
    ).toEqual({ zoom: 2, offsetX: 10, offsetY: -5, rotation: 270 });
  });

  it("treats a null or absent photo_rotation as 0 (legacy rows)", () => {
    expect(positionFromCat({}).rotation).toBe(0);
    expect(positionFromCat({ photo_rotation: null }).rotation).toBe(0);
  });
});

describe("clampPosition preserves rotation", () => {
  it("carries rotation through untouched", () => {
    const clamped = clampPosition(
      { zoom: 5, offsetX: 999, offsetY: -999, rotation: 180 },
      { x: 10, y: 10 },
    );
    expect(clamped.rotation).toBe(180);
    expect(clamped.zoom).toBe(3);
    expect(clamped.offsetX).toBe(10);
    expect(clamped.offsetY).toBe(-10);
  });
});

describe("getOffsetBounds with rotation", () => {
  it("swaps width and height at 90 and 270", () => {
    const landscape = { width: 200, height: 100 };
    const at0 = getOffsetBounds(landscape, 1, 0);
    const at90 = getOffsetBounds(landscape, 1, 90);
    const at270 = getOffsetBounds(landscape, 1, 270);
    // Unrotated 2:1 landscape has horizontal pan room and none vertically.
    expect(at0.x).toBeCloseTo(50);
    expect(at0.y).toBeCloseTo(0);
    // Rotated a quarter turn, that room moves to the vertical axis.
    expect(at90.x).toBeCloseTo(0);
    expect(at90.y).toBeCloseTo(50);
    expect(at270).toEqual(at90);
  });

  it("does not swap at 0 and 180", () => {
    const landscape = { width: 200, height: 100 };
    expect(getOffsetBounds(landscape, 1, 180)).toEqual(
      getOffsetBounds(landscape, 1, 0),
    );
  });

  it("defaults to no rotation when the argument is omitted", () => {
    const landscape = { width: 200, height: 100 };
    expect(getOffsetBounds(landscape, 1)).toEqual(
      getOffsetBounds(landscape, 1, 0),
    );
  });
});

describe("getPhotoTransformStyle rotation coverage", () => {
  // The invariant: at zoom 1 the rendered image must fully cover the square
  // frame at every angle. Frame is 1x1 in these units; width/height come back
  // as percentage strings of that frame.
  const pct = (v: unknown) => Number(String(v).replace("%", ""));

  const covers = (
    imageSize: { width: number; height: number },
    rotation: number,
  ) => {
    const style = getPhotoTransformStyle(imageSize, {
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      rotation,
    });
    const w = pct(style.width);
    const h = pct(style.height);
    // Post-rotation footprint: a quarter turn swaps the axes.
    const swapped = rotation === 90 || rotation === 270;
    const footprintW = swapped ? h : w;
    const footprintH = swapped ? w : h;
    return footprintW >= 99.99 && footprintH >= 99.99;
  };

  it.each([0, 90, 180, 270])("landscape source covers at %i degrees", (r) => {
    expect(covers({ width: 200, height: 100 }, r)).toBe(true);
  });

  it.each([0, 90, 180, 270])("portrait source covers at %i degrees", (r) => {
    expect(covers({ width: 100, height: 200 }, r)).toBe(true);
  });

  it.each([0, 90, 180, 270])("square source covers at %i degrees", (r) => {
    expect(covers({ width: 150, height: 150 }, r)).toBe(true);
  });

  it("preserves the image's natural aspect ratio in the CSS box", () => {
    const style = getPhotoTransformStyle(
      { width: 200, height: 100 },
      { zoom: 1, offsetX: 0, offsetY: 0, rotation: 90 },
    );
    expect(pct(style.width) / pct(style.height)).toBeCloseTo(2);
  });

  it("includes a rotate() in the transform when rotated", () => {
    const style = getPhotoTransformStyle(
      { width: 200, height: 100 },
      { zoom: 1.5, offsetX: 0, offsetY: 0, rotation: 90 },
    );
    expect(String(style.transform)).toContain("rotate(90deg)");
    expect(String(style.transform)).toContain("scale(1.5)");
  });

  it("omits rotate() work at 0 degrees but still returns a valid transform", () => {
    const style = getPhotoTransformStyle(
      { width: 200, height: 100 },
      { zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 },
    );
    expect(String(style.transform)).toContain("rotate(0deg)");
  });

  it("falls back to centered cover before the natural size is known", () => {
    const style = getPhotoTransformStyle(null, {
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      rotation: 90,
    });
    expect(style.objectFit).toBe("cover");
    expect(String(style.transform)).toContain("rotate(90deg)");
  });
});
```

**Also update the existing literals in this file.** `rotation` is required, so every
existing `{ zoom, offsetX, offsetY }` object literal in
`__tests__/lib/photo-position.test.ts` needs `rotation: 0` added. The type-check in
Step 2 will list them.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm jest __tests__/lib/photo-position.test.ts
pnpm tsc --noEmit
```

Expected: FAIL — `normalizeRotation` is not exported, and `tsc` reports missing
`rotation` on the object literals.

- [ ] **Step 3: Implement the geometry**

In `lib/photo-position.ts`:

```ts
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

export const PHOTO_ROTATIONS = [0, 90, 180, 270] as const;

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
```

Update `isIdentityPosition`:

```ts
export function isIdentityPosition(p: PhotoPosition): boolean {
  return p.zoom === 1 && p.offsetX === 0 && p.offsetY === 0 && p.rotation === 0;
}
```

Update `positionFromCat`:

```ts
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
```

Update `getOffsetBounds` to take rotation and measure against the effective size:

```ts
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
```

Update `clampPosition` so rotation survives:

```ts
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
```

Update `getPhotoTransformStyle`. The element is sized in its **own** (pre-rotation)
axes, but the cover decision is made against the **effective** (post-rotation)
footprint, so the two percentages are assigned crosswise on a quarter turn:

```ts
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
```

Update the file's top doc comment to mention rotation, and note that `translate`
resolves against the element's own border box, so it centres correctly at every
angle.

- [ ] **Step 4: Run tests and type-check**

```bash
pnpm jest __tests__/lib/photo-position.test.ts
pnpm tsc --noEmit
```

Expected: PASS, **and `tsc` must be completely clean.** Making `rotation` required
does not break application code: every consumer obtains a `PhotoPosition` from
`positionFromCat`, `DEFAULT_PHOTO_POSITION`, or a `{ ...current }` spread, all of
which carry the field. The only literals that need updating are the ones in this
task's own test file (Step 1).

If `tsc` reports errors anywhere else, do not wave them through as "expected" —
investigate. `app/actions/cat-photo.ts:128` declares its own inline
`{ zoom, offsetX, offsetY }` parameter type that is structurally separate from
`PhotoPosition`; it is untouched here and extended in Task 2, so it should not
error in this task.

- [ ] **Step 5: Commit**

```bash
git add lib/photo-position.ts __tests__/lib/photo-position.test.ts
git commit -m "feat(photo): rotation geometry in photo-position

Adds a required rotation field to PhotoPosition, normalizeRotation, and
effective-size handling so a quarter turn still covers the square frame.
Drag deltas deliberately need no remapping: offsets drive left/top in frame
space, so a rightward drag is +offsetX at every angle."
```

---

## Task 2: Persist rotation

Adds the column and threads it through storage and reads. No UI.

**Files:**
- Modify: `lib/db/schema.ts` (the `cats` table, beside `photo_offset_y`)
- Modify: `lib/repo/cats.repo.ts` (`catReadColumns`)
- Modify: `app/actions/cat-photo.ts` (`readPosition`, `editCatPhotoPosition`, `removeCatPhoto`)

**Interfaces:**
- Consumes: `normalizeRotation` from `lib/photo-position.ts` (Task 1).
- Produces: `cats.photo_rotation` column; `editCatPhotoPosition(catId, position: { zoom: number; offsetX: number; offsetY: number; rotation: number })`.

- [ ] **Step 1: Add the schema column**

In `lib/db/schema.ts`, directly after `photo_offset_y` in the `cats` table:

```ts
  // Quarter-turn rotation applied at render time, alongside the crop trio above.
  // App-owned and never synced: the sheet always shows the uncropped, unrotated
  // original. 0 is identity, so every pre-existing row is unaffected.
  photo_rotation: integer("photo_rotation").default(0).notNull(),
```

`integer` is already imported in this file. Confirm before adding an import.

- [ ] **Step 2: Add the column to reads**

In `lib/repo/cats.repo.ts`, inside `catReadColumns`, directly after
`photo_offset_y: cats.photo_offset_y,`:

```ts
  photo_rotation: cats.photo_rotation,
```

- [ ] **Step 3: Persist on upload and re-crop**

In `app/actions/cat-photo.ts`, extend `readPosition` (it currently returns the
three position columns):

```ts
import { normalizeRotation } from "@/lib/photo-position";

/** Parse + clamp a position from FormData (zoom 1..3, offsets ±2000, rotation 0|90|180|270). */
function readPosition(formData: FormData) {
  const num = (v: FormDataEntryValue | null, fallback: number) => {
    const n = typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };
  const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, v));
  // Offsets are percentages of the frame and legitimately exceed 100 for zoomed
  // non-square images (bounds grow with aspect × zoom). The renderer re-clamps to
  // the true per-image bounds, so this is only an abuse guard against absurd values.
  return {
    photo_zoom: clamp(num(formData.get("photo_zoom"), 1), 1, 3),
    photo_offset_x: clamp(num(formData.get("photo_offset_x"), 0), -2000, 2000),
    photo_offset_y: clamp(num(formData.get("photo_offset_y"), 0), -2000, 2000),
    photo_rotation: normalizeRotation(num(formData.get("photo_rotation"), 0)),
  };
}
```

Extend `editCatPhotoPosition`:

```ts
export async function editCatPhotoPosition(
  catId: string,
  position: {
    zoom: number;
    offsetX: number;
    offsetY: number;
    rotation: number;
  },
): Promise<void> {
  await assertCanEditCatPhoto(catId);

  const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, Number.isFinite(v) ? v : 0));

  // ±2000 is an abuse guard only; offsets legitimately exceed 100 for zoomed
  // non-square images and the renderer re-clamps to true per-image bounds.
  await db
    .update(cats)
    .set({
      photo_zoom: clamp(position.zoom, 1, 3),
      photo_offset_x: clamp(position.offsetX, -2000, 2000),
      photo_offset_y: clamp(position.offsetY, -2000, 2000),
      photo_rotation: normalizeRotation(position.rotation),
    })
    .where(eq(cats.id, catId));
}
```

- [ ] **Step 4: Reset rotation when a photo is removed**

This is easy to miss and produces a confusing bug — a newly uploaded photo
inheriting the previous photo's angle. In `removeCatPhoto`, the `.set(...)` that
clears the photo currently resets the trio. Add rotation:

```ts
      .set({
        photo_url: null,
        photo_zoom: 1,
        photo_offset_x: 0,
        photo_offset_y: 0,
        photo_rotation: 0,
      })
```

- [ ] **Step 5: Type-check and run the suite**

```bash
pnpm tsc --noEmit
pnpm jest __tests__
```

Expected: no errors originating in the three files above. Errors may remain in
`photo-position-editor.tsx` and other components that construct a `PhotoPosition`;
those are Task 3.

If `__tests__/actions/cat-photo.test.ts` asserts the exact `.set(...)` payload,
update those expectations to include `photo_rotation`.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts lib/repo/cats.repo.ts app/actions/cat-photo.ts __tests__/actions/cat-photo.test.ts
git commit -m "feat(photo): persist photo_rotation

Adds cats.photo_rotation (default 0, so existing rows are identity), threads it
through catReadColumns, upload, and re-crop, and resets it on photo removal so a
new photo cannot inherit the old angle."
```

- [ ] **Step 7: STOP and report the pending schema push**

**Do not run `pnpm drizzle-kit push`.** Report to the controller that
`lib/db/schema.ts` changed and the human partner must run:

```bash
pnpm drizzle-kit push
```

before Task 3's manual verification will work against a real database. Tasks 3–9
do not depend on the push having run, and the Jest suite is fully mocked, so
implementation can continue.

---

## Task 3: Rotate controls in the photo editor

**Files:**
- Modify: `components/app-pages/shared/photo-position-editor.tsx`
- Modify: any component `tsc` flags for constructing a `PhotoPosition` without `rotation`

**Interfaces:**
- Consumes: `PhotoPosition`, `normalizeRotation`, `getOffsetBounds(imageSize, zoom, rotation)`, `clampPosition`, `DEFAULT_PHOTO_POSITION` from `lib/photo-position.ts`.

- [ ] **Step 1: Pass rotation to every bounds call**

In `photo-position-editor.tsx` there are two `getOffsetBounds(...)` calls — one in
`onPointerMove`, one in the zoom slider's `onChange`. Both currently pass two
arguments. Add the rotation:

```ts
// in onPointerMove
const nextBounds = getOffsetBounds(
  currentImageSize
    ? { width: currentImageSize.width, height: currentImageSize.height }
    : null,
  current.zoom,
  current.rotation,
);
```

```ts
// in the zoom slider onChange
getOffsetBounds(
  currentImageSize
    ? { width: currentImageSize.width, height: currentImageSize.height }
    : null,
  zoom,
  current.rotation,
)
```

The zoom handler's callback receives `current`, so `current.rotation` is in scope.
**Do not change the drag arithmetic** — `offsetX + dx` / `offsetY + dy` is correct at
every angle, because offsets drive `left`/`top` in frame space.

- [ ] **Step 2: Add the rotate buttons**

Add a rotate helper above the returned JSX:

```ts
const rotateBy = (delta: number) =>
  onChange((current) => {
    const rotation = normalizeRotation(
      (((current.rotation + delta) % 360) + 360) % 360,
    );
    return clampPosition(
      { ...current, rotation },
      getOffsetBounds(
        currentImageSize
          ? { width: currentImageSize.width, height: currentImageSize.height }
          : null,
        current.zoom,
        rotation,
      ),
    );
  });
```

Re-clamping with the **new** rotation matters: a quarter turn moves the available
pan room between the axes, so an offset that was legal before the turn can be out of
bounds after it.

In the control bar, between the zoom slider and the Reset button:

```tsx
<button
  type="button"
  onClick={() => rotateBy(-90)}
  aria-label="Rotate left"
  title="Rotate left"
  className="rounded-full border border-brand-green px-2.5 py-1 text-xs font-bold text-brand-green transition-opacity hover:opacity-80"
>
  ⟲
</button>
<button
  type="button"
  onClick={() => rotateBy(90)}
  aria-label="Rotate right"
  title="Rotate right"
  className="rounded-full border border-brand-green px-2.5 py-1 text-xs font-bold text-brand-green transition-opacity hover:opacity-80"
>
  ⟳
</button>
```

The existing Reset button already resets rotation, because it assigns
`DEFAULT_PHOTO_POSITION` wholesale and that constant now carries `rotation: 0`.

- [ ] **Step 3: Send rotation with the save**

Find every place that builds the upload `FormData` or calls `editCatPhotoPosition`
(search for `photo_offset_x` and `editCatPhotoPosition` across `components/` and
`app/`). Wherever the trio is sent, add rotation alongside it:

```ts
formData.append("photo_rotation", String(position.rotation));
```

```ts
await editCatPhotoPosition(catId, {
  zoom: position.zoom,
  offsetX: position.offsetX,
  offsetY: position.offsetY,
  rotation: position.rotation,
});
```

- [ ] **Step 4: Confirm the tree is clean**

```bash
pnpm tsc --noEmit
```

Tasks 1 and 2 should already have left this green. If anything is flagged for a
`PhotoPosition` missing `rotation`, fix it by spreading `DEFAULT_PHOTO_POSITION` or
adding `rotation: 0` — **do not make the field optional**, which would let
`clampPosition` silently drop the angle.

- [ ] **Step 5: Verify**

```bash
pnpm tsc --noEmit
pnpm jest __tests__
pnpm lint
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add components/ app/
git commit -m "feat(photo): rotate-left/right controls in the position editor

Re-clamps offsets against the new rotation, since a quarter turn moves the
available pan room between axes. Drag arithmetic is unchanged by design."
```

---

## Task 4: Vaccination state module

Pure functions. No UI, no database, no writes.

**Files:**
- Modify: `lib/utils.ts` — the two generic elapsed-time helpers
- Create: `lib/vaccination.ts` — vaccination policy only
- Test: `__tests__/lib/utils.test.ts` (create)
- Test: `__tests__/lib/vaccination.test.ts` (create)

**Why the split.** `monthsSince` and `formatMonthsAgo` are generic date utilities with
nothing vaccination-specific about them. A search of the codebase found no reusable
relative-time helper and no date library — the only elapsed-time math is an inline
`daysSince` buried in a `useMemo` at `components/app-pages/sessions/sessions-screen.tsx:113`.
That is exactly how `formatDate` accumulated nine local copies before it was extracted
into `lib/utils.ts`, whose doc comment now tells new code to use it "rather than adding
a tenth." Burying month arithmetic inside a domain module repeats that mistake, so the
generic half goes next to `formatDate` and only the policy stays in `lib/vaccination.ts`.

**Interfaces:**
- Produces from `lib/utils.ts`:
  - `monthsSince(date: Date, now?: Date): number`
  - `formatMonthsAgo(date: Date | string, now?: Date): string`
- Produces from `lib/vaccination.ts`:
  - `VACCINATION_EXPIRY_MONTHS: 12`
  - `type VaccinationState = "unknown" | "vaccinated" | "expired"`
  - `getVaccinationState(date: Date | string | null | undefined, now?: Date): VaccinationState`
  - `VACCINATION_LABELS: Record<VaccinationState, string>` — `{ unknown: "Unknown", vaccinated: "Vaccinated", expired: "Expired" }`
  - `VACCINATION_FILTER_OPTIONS: readonly string[]` — `["Vaccinated", "Expired", "Unknown"]`

**Do NOT migrate the inline `daysSince`** in `sessions-screen.tsx`. It is unrelated to
P4 and out of scope. Note that it divides milliseconds (`/86400000`), which is fine for
days but would be wrong for months — months have unequal lengths, so `monthsSince` must
be calendar-aware, as specified below.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/vaccination.test.ts`:

Create `__tests__/lib/utils.test.ts` for the generic helpers:

**Test dates use local-time constructors (`new Date(2026, 7, 15)`), not `"...Z"`
strings, on purpose.** `monthsSince` reads `getFullYear`/`getMonth`/`getDate`, which are
local-time accessors, while `new Date("...Z")` parses as UTC. Mixing the two makes every
assertion depend on the runner's timezone — the suite would pass in Manila (UTC+8) and
fail anywhere west of UTC. Month arguments are 0-indexed.


```ts
import { monthsSince, formatMonthsAgo } from "@/lib/utils";

const NOW = new Date(2026, 7, 15);

describe("monthsSince", () => {
  it("counts whole elapsed months", () => {
    expect(monthsSince(new Date(2026, 5, 15), NOW)).toBe(2);
    expect(monthsSince(new Date(2025, 5, 15), NOW)).toBe(14);
  });

  it("does not count a month until the day-of-month is reached", () => {
    expect(monthsSince(new Date(2026, 6, 20), NOW)).toBe(0);
    expect(monthsSince(new Date(2026, 6, 15), NOW)).toBe(1);
  });

  it("never returns a negative count for a future date", () => {
    expect(monthsSince(new Date(2027, 0, 15), NOW)).toBe(0);
  });

  it("is calendar-aware, not millisecond division", () => {
    // Feb is short; ms-division would under-count this as 0.
    expect(monthsSince(new Date(2026, 0, 31), new Date(2026, 2, 1))).toBe(1);
  });
});

describe("formatMonthsAgo", () => {
  it("is singular at one month", () => {
    expect(formatMonthsAgo(new Date(2026, 6, 15), NOW)).toBe(
      "1 month ago",
    );
  });

  it("is plural beyond one month", () => {
    expect(formatMonthsAgo(new Date(2025, 5, 15), NOW)).toBe(
      "14 months ago",
    );
  });

  it("reads as this month when under a month old", () => {
    expect(formatMonthsAgo(new Date(2026, 7, 1), NOW)).toBe(
      "this month",
    );
  });

  it("accepts an ISO string as well as a Date", () => {
    expect(formatMonthsAgo("2026-07-15T00:00:00", NOW)).toBe("1 month ago");
  });

  it("returns Unknown for an unparseable date", () => {
    expect(formatMonthsAgo("not-a-date", NOW)).toBe("Unknown");
  });
});
```

Then create `__tests__/lib/vaccination.test.ts` for the policy:

```ts
import {
  VACCINATION_EXPIRY_MONTHS,
  VACCINATION_LABELS,
  getVaccinationState,
} from "@/lib/vaccination";

const NOW = new Date(2026, 7, 15);

describe("getVaccinationState", () => {
  it("is unknown when there is no date", () => {
    expect(getVaccinationState(null, NOW)).toBe("unknown");
    expect(getVaccinationState(undefined, NOW)).toBe("unknown");
  });

  it("is unknown for an unparseable date", () => {
    expect(getVaccinationState("not-a-date", NOW)).toBe("unknown");
  });

  it("is vaccinated inside the window", () => {
    expect(getVaccinationState(new Date(2026, 5, 15), NOW)).toBe(
      "vaccinated",
    );
  });

  it("is expired outside the window", () => {
    expect(getVaccinationState(new Date(2025, 0, 10), NOW)).toBe(
      "expired",
    );
  });

  it("treats exactly 12 months as vaccinated — the boundary is closed", () => {
    expect(getVaccinationState(new Date(2025, 7, 15), NOW)).toBe(
      "vaccinated",
    );
  });

  it("treats one day past 12 months as expired", () => {
    expect(getVaccinationState(new Date(2025, 7, 14), NOW)).toBe(
      "expired",
    );
  });

  it("accepts an ISO string as well as a Date", () => {
    expect(getVaccinationState("2026-06-15T00:00:00", NOW)).toBe("vaccinated");
  });

  it("uses a 12-month window", () => {
    expect(VACCINATION_EXPIRY_MONTHS).toBe(12);
  });
});

describe("VACCINATION_LABELS", () => {
  it("uses the codebase's Unknown convention", () => {
    expect(VACCINATION_LABELS).toEqual({
      unknown: "Unknown",
      vaccinated: "Vaccinated",
      expired: "Expired",
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm jest __tests__/lib/utils.test.ts __tests__/lib/vaccination.test.ts
```

Expected: FAIL — `monthsSince` is not exported from `@/lib/utils`, and
`Cannot find module '@/lib/vaccination'`.

- [ ] **Step 3a: Add the generic helpers to `lib/utils.ts`**

Append to `lib/utils.ts`, after the existing `formatDate`:

```ts
/**
 * Whole months elapsed, not counting a month until its day-of-month is reached.
 *
 * Calendar-aware on purpose. Dividing milliseconds (as the inline `daysSince` in
 * sessions-screen.tsx does) is fine for days but wrong for months, which have
 * unequal lengths — Jan 31 → Mar 1 is one whole month by the calendar and zero by
 * a 30-day approximation.
 */
export function monthsSince(date: Date, now: Date = new Date()): number {
  let months =
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth());
  if (now.getDate() < date.getDate()) months -= 1;
  return Math.max(0, months);
}

/** Human-readable elapsed months: "this month", "1 month ago", "14 months ago". */
export function formatMonthsAgo(
  value: Date | string,
  now: Date = new Date(),
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const months = monthsSince(date, now);
  if (months < 1) return "this month";
  return months === 1 ? "1 month ago" : `${months} months ago`;
}
```

- [ ] **Step 3b: Create `lib/vaccination.ts`**

```ts
/**
 * Vaccination state derivation.
 *
 * The database stores exactly one untyped `cat_health_records.vaccination_date`
 * (sheet col Q, "Date of Vaccination"). There is no vaccine type and no dose
 * number, and in practice the value is a TNVR clinic date — 68 of the 71
 * populated rows equal that cat's neuter date.
 *
 * The 12-month window below is therefore AGILA's own annual TNVR cadence, not a
 * clinical titre. It is deliberately confined to this module and surfaced only as
 * a state label and a filter option — never as an alarm chip or a per-cat verdict
 * rendered over the animal. If a vaccine-type field ever arrives, this is the one
 * place to revisit.
 */

export const VACCINATION_EXPIRY_MONTHS = 12;

export type VaccinationState = "unknown" | "vaccinated" | "expired";

export const VACCINATION_LABELS: Record<VaccinationState, string> = {
  unknown: "Unknown",
  vaccinated: "Vaccinated",
  expired: "Expired",
};

/** Filter options, ordered most-to-least actionable. */
export const VACCINATION_FILTER_OPTIONS = [
  VACCINATION_LABELS.vaccinated,
  VACCINATION_LABELS.expired,
  VACCINATION_LABELS.unknown,
] as const;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * `unknown` means no usable date — never "not vaccinated". 83% of live cats have
 * no date at all, so conflating absence with a negative would misreport most of
 * the census.
 */
export function getVaccinationState(
  value: Date | string | null | undefined,
  now: Date = new Date(),
): VaccinationState {
  const date = toDate(value);
  if (!date) return "unknown";

  const months = monthsSince(date, now);

  // Closed boundary: exactly VACCINATION_EXPIRY_MONTHS still counts as current.
  // The day-of-month check is required, not decorative. `monthsSince` truncates
  // to whole completed months, so "exactly 12 months" and "12 months + 1 day"
  // BOTH return 12 — a plain `<= 12` cannot tell them apart and would report a
  // day-past-expiry cat as vaccinated. Requiring the day to match makes
  // `months === 12 && sameDay` mean precisely "on the anniversary".
  if (months < VACCINATION_EXPIRY_MONTHS) return "vaccinated";
  if (months === VACCINATION_EXPIRY_MONTHS && now.getDate() === date.getDate()) {
    return "vaccinated";
  }
  return "expired";
}
```

`monthsSince` is imported from `@/lib/utils` (Step 3a) — it is generic date math and
does not belong to this module. Import it at the top of `lib/vaccination.ts`:

```ts
import { monthsSince } from "@/lib/utils";
```

- [ ] **Step 4: Run the tests**

```bash
pnpm jest __tests__/lib/utils.test.ts __tests__/lib/vaccination.test.ts
pnpm tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts lib/vaccination.ts __tests__/lib/utils.test.ts __tests__/lib/vaccination.test.ts
git commit -m "feat(vaccination): state derivation module + shared month helpers

unknown/vaccinated/expired from the single untyped vaccination_date. The
12-month window is AGILA's TNVR cadence, not a titre, and lives only here.
Boundary is closed: exactly 12 months is still vaccinated."
```

---

## Task 5: Vaccination surfaces

Three read-only consumers. Nothing writes.

**Files:**
- Modify: `components/app-pages/database/database-medical-screen.tsx`
- Modify: `components/app-pages/shared/cat-filter-toolbar.tsx` (the `FilterableCat` type)
- Modify: `components/app-pages/database/database-list-screen.tsx` (`addMedicalAndInterventionInfo`)
- Modify: `lib/hooks/filter-sort-configs.ts` (`DATABASE_LIST_CONFIG`)
- Modify: `components/app-pages/catalog/catalog-detail-screen.tsx`

**Interfaces:**
- Consumes from `lib/vaccination.ts` (Task 4): `getVaccinationState`, `VACCINATION_LABELS`, `VACCINATION_FILTER_OPTIONS`.
- Consumes from `lib/utils.ts` (Task 4): `formatMonthsAgo`.

- [ ] **Step 1: Relative-age line on the medical screen**

`database-medical-screen.tsx` already renders a `Vaccination Date` field with a
`DateInputRow`. Directly under that `DateInputRow`, add a muted read-only line
sourced from the **saved** record (`healthRecord`), not the in-progress form state —
it describes what is stored, so it must not flicker while someone types:

```tsx
{healthRecord?.vaccination_date ? (
  <p className="mt-1.5 text-xs text-brand-dark/50">
    Recorded {formatMonthsAgo(healthRecord.vaccination_date)}
  </p>
) : null}
```

Import `formatMonthsAgo` from `@/lib/utils` (NOT from `@/lib/vaccination` — it is a
generic date helper living beside `formatDate`). The component already has
`healthRecord` in scope (it drives `populateForm`). Do not add a chip, a colour, or
an icon — this is a factual statement with no verdict attached.

- [ ] **Step 2: Widen `FilterableCat`**

In `components/app-pages/shared/cat-filter-toolbar.tsx`:

```ts
export type FilterableCat = CatWithRegion & {
  condition?: string | null;
  intervention_type?: readonly string[] | string | null;
  intervention_status?: readonly string[] | string | null;
  vaccination?: string | null;
};
```

- [ ] **Step 3: Derive the field during enrichment**

In `database-list-screen.tsx`, `addMedicalAndInterventionInfo` already receives the
health records. Add one derived field to the returned object, beside `condition`:

```ts
      vaccination:
        VACCINATION_LABELS[
          getVaccinationState(healthByCatId.get(cat.id)?.vaccination_date ?? null)
        ],
```

Import `getVaccinationState` and `VACCINATION_LABELS` from `@/lib/vaccination`.
No new query is needed — `loadFilterData` already fetches every health record.

- [ ] **Step 4: Register the filter**

In `lib/hooks/filter-sort-configs.ts`, add to `DATABASE_LIST_CONFIG.filters`,
directly after the `Medical Condition` entry:

```ts
    {
      label: "Vaccination",
      key: "vaccination",
      options: [...VACCINATION_FILTER_OPTIONS],
    },
```

Import `VACCINATION_FILTER_OPTIONS` from `@/lib/vaccination`. Do **not** add it to
`PUBLIC_CATALOG_CONFIG` — the public catalog has no health enrichment, so the filter
would match nothing.

- [ ] **Step 5: Tri-state the catalog row**

In `catalog-detail-screen.tsx`, the health fields currently read:

```tsx
const isVaccinated = !!healthRecord?.vaccination_date;
// ...
{ label: "Vaccinated", value: <YesNoBadge value={isVaccinated} /> },
```

`YesNoBadge` renders a boolean, so absence displays as a definite **No** for the
~83% of live cats with no record. Replace with a three-state value:

```tsx
const vaccinationState = getVaccinationState(
  healthRecord?.vaccination_date ?? null,
);
```

```tsx
{
  label: "Vaccinated",
  value:
    vaccinationState === "unknown" ? (
      <span className="text-sm text-brand-dark/45">
        {VACCINATION_LABELS.unknown}
      </span>
    ) : (
      <span className="text-sm font-semibold text-brand-dark/80">
        {VACCINATION_LABELS[vaccinationState]}
      </span>
    ),
},
```

Delete the now-unused `isVaccinated`. Leave `Neutered`, `Sick`, and `Injured` on
`YesNoBadge` — this task changes only the vaccination row. The `expired` case must
render in the same neutral weight as `vaccinated`; no red, no warning colour.

- [ ] **Step 6: Verify**

```bash
pnpm tsc --noEmit
pnpm jest __tests__
pnpm lint
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add components/ lib/hooks/filter-sort-configs.ts
git commit -m "feat(vaccination): relative-age line, list filter, tri-state catalog row

The public catalog previously rendered a missing vaccination date as a definite
'No' for ~83% of live cats. It now distinguishes Unknown from Vaccinated and
Expired, all in neutral weight."
```

---

## Task 6: Site metadata and a real 404 page

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/(public)/(home)/page.tsx` metadata export (the file exists; add to it)
- Create: `app/not-found.tsx`

**Interfaces:**
- Produces: `metadataBase` resolved from `NEXT_PUBLIC_SITE_URL`, so later tasks can return relative OG image URLs.

- [ ] **Step 1: Extend the root metadata**

In `app/layout.tsx`, replace the existing `metadata` export. Keep the title
template and description exactly as they are:

```ts
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SITE_DESCRIPTION =
  "Cat census and adoption catalog for AGILA at Ateneo de Manila University, Quezon City.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: "%s | AGILA CATalog",
    default: "AGILA CATalog",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "AGILA CATalog",
    title: "AGILA CATalog",
    description: SITE_DESCRIPTION,
    locale: "en_PH",
  },
  twitter: {
    card: "summary_large_image",
    title: "AGILA CATalog",
    description: SITE_DESCRIPTION,
  },
};
```

`NEXT_PUBLIC_SITE_URL` already exists and is used by `app/auth/callback/route.ts`.
The localhost fallback exists so a build without the variable does not throw in
`new URL(...)`.


- [ ] **Step 1b: Give the public landing page its own metadata**

`app/(public)/(home)/page.tsx` renders the public adoption catalog at `/` — the
highest-value page on the site — and currently has **no metadata export at all**, so
it inherits only the site-wide default title and description. Add:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Adopt a Cat in Quezon City",
  description:
    "Meet campus cats available for adoption and fostering, based at Ateneo de Manila University in Quezon City and open to adopters across Metro Manila.",
  openGraph: {
    type: "website",
    title: "Adopt a Cat in Quezon City",
    description:
      "Meet campus cats available for adoption and fostering, based at Ateneo de Manila University in Quezon City and open to adopters across Metro Manila.",
  },
};
```

The root `title.template` turns this into `Adopt a Cat in Quezon City | AGILA CATalog`.

**On the geographic targeting.** Ateneo de Manila is in Loyola Heights, Quezon City, so
the location is factual, not keyword padding. Adoption is open to the public, but cat
adoption still requires someone to physically collect the animal — so Metro Manila is
the real catchment and the ceiling. Deliberately NOT targeting nationwide terms: those
are dominated by established rescues with far more domain authority, and a click from
outside the travel radius is a bounce, which hurts local-intent ranking. The wording
separates where the cats are ("based at ... in Quezon City") from who may adopt them
("open to adopters across Metro Manila") so neither claim overreaches.

**Do not use the word "rescued"** anywhere in metadata copy.

- [ ] **Step 2: Create the 404 page**

Create `app/not-found.tsx`. It mirrors `app/error.tsx` — same card, logo, spacing,
and brand tokens — but is a **server component**: no `"use client"`, no Supabase
session check, no `reset` button, no database read. Crawlers and scanners hit 404s
constantly, so this path stays cheap.

```tsx
import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand-cream px-4 py-8 mobile:px-6 tablet:py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-brand-dark/8 mobile:p-7 tablet:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green shadow-sm tablet:h-16 tablet:w-16">
          <Image
            src="/logos/white-no-text.png"
            alt="AGILA"
            width={40}
            height={40}
            className="h-8 w-8 object-contain tablet:h-9 tablet:w-9"
          />
        </div>

        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.25em] text-brand-orange tablet:mt-6">
          404
        </p>
        <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight text-brand-dark mobile:text-3xl">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-dark/65">
          This page doesn&apos;t exist, or the cat you were looking for is no
          longer in the catalog.
        </p>

        <div className="mt-6 flex flex-col gap-2.5 tablet:mt-7">
          <Link
            href="/"
            className="flex w-full items-center justify-center rounded-2xl bg-brand-green px-6 py-3.5 text-sm font-bold text-brand-green-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            Back home
          </Link>
        </div>

        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-dark/40">
          Ateneo de Manila University
        </p>
      </div>
    </main>
  );
}
```

There is deliberately no "Try again" button: `reset()` exists in `error.tsx` because
an error boundary can retry, and a 404 has nothing to retry.

- [ ] **Step 3: Verify**

```bash
pnpm tsc --noEmit
pnpm lint
pnpm jest __tests__
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx "app/(public)/(home)/page.tsx" app/not-found.tsx
git commit -m "feat(seo): metadataBase, OpenGraph/Twitter defaults, styled 404

The app had no not-found.tsx, so unmatched routes rendered Next's default page.
Kept as a static server component: no session check, no DB read."
```

---

## Task 7: Server-render the catalog detail page

The largest single change, and mostly deletion. The only interactive element in the
287-line screen is `CatPhotoButton`, which is already an independent client
component.

**Files:**
- Modify: `app/(public)/catalog/[id]/page.tsx`
- Modify: `components/app-pages/catalog/catalog-detail-screen.tsx`

**Interfaces:**
- Consumes: `repo.findAdoptableCats(filters)` and `repo.findCatHealthRecords(filters)` from `lib/repo/cats.repo.ts`; `getLinks()` from `lib/services/system.service.ts`.
- Produces: `CatalogDetailScreen` props change from `{ catId: string; adoptFosterUrl: string }` to `{ cat: CatWithRegion; healthRecord: SelectCatHealthRecord | null; adoptFosterUrl: string }`.

- [ ] **Step 1: Rewrite the page**

Replace `app/(public)/catalog/[id]/page.tsx` entirely:

```tsx
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogDetailScreen } from "@/components/app-pages/catalog/catalog-detail-screen";
import { getLinks } from "@/lib/services/system.service";
import * as repo from "@/lib/repo/cats.repo";

type PageProps = {
  params: Promise<{ id: string }>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * cache() dedupes this between generateMetadata and the page body, so the
 * request costs one query rather than two. The UUID guard matters: the id comes
 * straight from the URL, and handing a non-UUID to Postgres throws rather than
 * returning no rows.
 */
const getCat = cache(async (id: string) => {
  if (!UUID_RE.test(id)) return null;
  // Database errors deliberately propagate. Swallowing them into `null` makes
  // notFound() fire, so a transient outage becomes a 404 — indistinguishable
  // from a permanently deleted cat. Crawlers deindex on 404 and retry on 5xx,
  // which would defeat the SEO work this page exists for. 404 is reserved for a
  // non-UUID id or a genuinely empty result.
  const rows = await repo.findAdoptableCats({ id, is_adoptable: true });
  return rows[0] ?? null;
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const cat = await getCat(id);
  if (!cat) return { title: "Cat not found" };

  const name = cat.name?.trim() || "Unnamed cat";
  const traits = [cat.age, cat.color, cat.sex].filter(Boolean).join(" · ");
  // Kept short: search results truncate around 155 characters, and the cat's own
  // traits are what earns the click. The home page carries the Metro Manila reach.
  const description = traits
    ? `${name} — ${traits}. Available for adoption or fostering through AGILA at Ateneo de Manila University, Quezon City.`
    : `${name} is available for adoption or fostering through AGILA at Ateneo de Manila University, Quezon City.`;
  const images = cat.photo_url ? [cat.photo_url] : undefined;

  return {
    title: name,
    description,
    openGraph: { type: "article", title: name, description, images },
    twitter: { card: "summary_large_image", title: name, description, images },
  };
}

export default async function CatalogDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [cat, links] = await Promise.all([getCat(id), getLinks()]);

  if (!cat) notFound();

  const healthRecords = await repo
    .findCatHealthRecords({ cat_id: cat.id })
    .catch(() => []);

  return (
    <CatalogDetailScreen
      cat={cat}
      healthRecord={healthRecords[0] ?? null}
      adoptFosterUrl={links.adoptFoster}
    />
  );
}
```

- [ ] **Step 2: Convert the screen to a server component**

In `components/app-pages/catalog/catalog-detail-screen.tsx`:

1. Delete the `"use client"` directive on line 1.
2. Delete the `useState`, `useEffect`, `useCallback` import and all three `useState`
   declarations (`cat`, `healthRecord`, `loading`).
3. Delete `fetchData`, the `useEffect` that calls it, and the `Loader2` loading
   branch. Remove the now-unused `Loader2` import.
4. Delete the `getAdoptableCats` / `getAdoptableCatHealthRecord` imports and the
   "cat could not be found" branch — the page calls `notFound()` before rendering,
   so the screen can assume a cat exists.
5. Change the props:

```tsx
import type { CatWithRegion } from "@/lib/repo/cats.repo";
import type { SelectCatHealthRecord } from "@/lib/validation/cats";

type CatalogDetailScreenProps = {
  cat: CatWithRegion;
  healthRecord: SelectCatHealthRecord | null;
  adoptFosterUrl: string;
};

export function CatalogDetailScreen({
  cat,
  healthRecord,
  adoptFosterUrl,
}: CatalogDetailScreenProps) {
```

Everything from `const sex = sexGlyph(cat.sex);` onward stays as it is —
including the Task 5 vaccination change, which is plain JSX and works unchanged in
a server component.

`CatPhotoButton` is already `"use client"` in `photo-lightbox`, so it keeps working
as a client island inside this now-server component. Do not add `"use client"` back.

- [ ] **Step 3: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: PASS. If `tsc` reports that a hook is still imported or that
`CatalogDetailScreen` is called with `catId`, a deletion in Step 2 was missed.

- [ ] **Step 4: Verify**

```bash
pnpm jest __tests__
pnpm lint
pnpm build
```

`pnpm build` matters here specifically: converting a client component to a server
component surfaces accidental client-only usage (event handlers, browser globals) as
a build error rather than a type error.

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/catalog/[id]/page.tsx" components/app-pages/catalog/catalog-detail-screen.tsx
git commit -m "feat(seo): server-render the catalog detail page

Adds per-cat generateMetadata and replaces the soft-404 (HTTP 200 with an empty
body) with a real notFound(). cache() dedupes the fetch between metadata and
body; a UUID guard keeps a malformed id from throwing in Postgres. Net deletion:
the screen loses its fetch, loading, and not-found machinery."
```

---

## Task 8: Sitemap and robots

**Files:**
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`

**Interfaces:**
- Consumes: `repo.findAdoptableCats` from `lib/repo/cats.repo.ts`.

- [ ] **Step 1: Create the sitemap**

Create `app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";
import * as repo from "@/lib/repo/cats.repo";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Re-generated hourly rather than per-request; the catalog changes slowly and
// this endpoint is hit by crawlers, not people.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  try {
    const cats = await repo.findAdoptableCats({ is_adoptable: true });
    return [
      ...staticEntries,
      ...cats.map((cat) => ({
        url: `${SITE_URL}/catalog/${cat.id}`,
        lastModified: cat.last_updated_at ?? undefined,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch (error) {
    // A database blip must not take the sitemap down entirely — an empty
    // sitemap tells crawlers the catalog is gone.
    console.error("[Sitemap] Failed to load adoptable cats:", error);
    return staticEntries;
  }
}
```

Only adoptable cats are listed: non-adoptable cats are not adoption content, and
their detail pages `notFound()` anyway, so listing them would advertise 404s.

- [ ] **Step 2: Create robots**

Create `app/robots.ts`:

```ts
import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/login", "/api", "/auth"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
```

This is crawl hygiene, not a security boundary — those routes are gated server-side
regardless. It keeps the dashboard and auth callbacks out of search results.

- [ ] **Step 3: Verify**

```bash
pnpm tsc --noEmit
pnpm lint
pnpm build
```

Expected: `pnpm build` lists `/sitemap.xml` and `/robots.txt` in its route map.

- [ ] **Step 4: Commit**

```bash
git add app/sitemap.ts app/robots.ts
git commit -m "feat(seo): sitemap and robots

Sitemap lists only adoptable cats and degrades to static entries if the cat
query fails. Robots disallows /dashboard, /login, /api, /auth."
```

---

## Task 9: Health endpoint hardening

**Files:**
- Modify: `app/api/health/route.ts`
- Modify: `app/api/cron/sync/route.ts`
- Test: `__tests__/api/health.test.ts` (create)
- Test: `__tests__/api/cron-auth.test.ts` (create)

**Note:** `__tests__/api/` does not exist yet — create it. There is currently no
test covering the cron route's authorization, so Step 4 adds one rather than
relying on an existing assertion.

**Interfaces:**
- Consumes: nothing from earlier tasks. This task is independent and may run in any order.

**Background:** `/api/health` is unauthenticated. It runs `SELECT 1` on the shared
pool for every caller — and P3 raised that pool's `max` to 12 to stop the Admin page
exhausting it, so an unauthenticated endpoint that takes a connection per request
can exhaust it from outside. It also returns the raw Postgres error message, which
routinely carries host, port, and database name.

The Cloudflare Worker calls `GET /api/health` before each cron tick and branches on
the **status code**, not the body, so neither change affects it.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/health.test.ts`:

```ts
const mockExecute = jest.fn();

jest.mock("@/lib/db", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    jest.resetModules();
    mockExecute.mockReset();
  });

  it("returns 200 and healthy when the database responds", async () => {
    mockExecute.mockResolvedValue([{ "?column?": 1 }]);
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "healthy" });
  });

  it("returns 503 without leaking the database error", async () => {
    mockExecute.mockRejectedValue(
      new Error("connect ECONNREFUSED db.internal.example:5432"),
    );
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("unhealthy");
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(body)).not.toContain("db.internal.example");
  });

  it("serves a second call from cache without querying again", async () => {
    mockExecute.mockResolvedValue([{ "?column?": 1 }]);
    const { GET } = await import("@/app/api/health/route");
    await GET();
    await GET();
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm jest __tests__/api/health.test.ts
```

Expected: FAIL — the current route leaks the error string and queries on every call.

- [ ] **Step 3: Rewrite the health route**

Replace `app/api/health/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * This endpoint is unauthenticated by necessity — the Cloudflare Worker polls it
 * before each cron tick. Two consequences are handled here:
 *
 * 1. It must not consume a pooled connection per request. The pool's max is 12
 *    (see lib/db/index.ts), so an uncached check is a trivial way for anyone to
 *    exhaust it. The result is cached briefly; the worker polls once per tick
 *    and never notices.
 * 2. It must not return the underlying error. Postgres connection failures carry
 *    the host, port, and database name. The message is logged server-side and
 *    the caller gets a bare status — the worker branches on the status code.
 */
const CACHE_TTL_MS = 10_000;

let cached: { at: number; healthy: boolean } | null = null;

export async function GET() {
  const now = Date.now();

  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.healthy
      ? NextResponse.json({ status: "healthy", cached: true })
      : NextResponse.json({ status: "unhealthy" }, { status: 503 });
  }

  try {
    await db.execute(sql`SELECT 1`);
    cached = { at: now, healthy: true };
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    cached = { at: now, healthy: false };
    console.error(
      "[Health] Database check failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ status: "unhealthy" }, { status: 503 });
  }
}
```

The cache is per-instance, which is the right scope: it bounds what any single
instance can be made to do.

- [ ] **Step 4: Constant-time token comparison on the cron route**

In `app/api/cron/sync/route.ts`, replace the token check. Keep the existing
behaviour exactly — unset secret still fails closed — and keep the retirement check
below it unchanged:

```ts
import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison. Defence-in-depth rather than a live vulnerability —
 * remote timing attacks on a hosted endpoint are impractical — but it removes the
 * question permanently. The length guard is required: timingSafeEqual throws on
 * buffers of different lengths.
 */
function tokenMatches(header: string | null, secret: string | undefined) {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
```

and in `POST`:

```ts
  if (!tokenMatches(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
```

- [ ] **Step 5: Cover the cron authorization matrix**

Create `__tests__/api/cron-auth.test.ts`. The route pulls in several services at
module load, so all of them are mocked; the assertions are only about the gate.

```ts
const mockIsSyncRetired = jest.fn();

jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");
  return { ...actual, after: jest.fn() };
});
jest.mock("@/lib/services/sync-cron.service", () => ({
  syncAllPendingRegions: jest.fn(),
}));
jest.mock("@/lib/services/system.service", () => ({
  isSyncRetired: (...args: unknown[]) => mockIsSyncRetired(...args),
  setSyncFrozen: jest.fn(),
  shouldRunPhotoGc: jest.fn().mockResolvedValue(false),
  markPhotoGcRun: jest.fn(),
}));
jest.mock("@/lib/services/discord.service", () => ({ sendSyncAlert: jest.fn() }));
jest.mock("@/lib/services/photo-import.service", () => ({
  reconcileCatPhotos: jest.fn(),
}));

const SECRET = "test-cron-secret";

const post = async (authorization?: string) => {
  const { POST } = await import("@/app/api/cron/sync/route");
  const { NextRequest } = await import("next/server");
  const request = new NextRequest("https://example.test/api/cron/sync", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
  return POST(request);
};

describe("POST /api/cron/sync authorization", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.resetModules();
    mockIsSyncRetired.mockReset().mockResolvedValue(true);
    process.env.CRON_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.CRON_SECRET = original;
  });

  it("rejects a missing header", async () => {
    expect((await post()).status).toBe(401);
  });

  it("rejects a wrong token", async () => {
    expect((await post("Bearer wrong-secret")).status).toBe(401);
  });

  it("rejects a correct token with the wrong scheme", async () => {
    expect((await post(SECRET)).status).toBe(401);
  });

  it("rejects a token of a different length without throwing", async () => {
    // timingSafeEqual throws on mismatched buffer lengths — the guard must
    // catch this before it reaches the comparison.
    expect((await post("Bearer short")).status).toBe(401);
  });

  it("rejects everything when CRON_SECRET is unset — fails closed", async () => {
    delete process.env.CRON_SECRET;
    expect((await post(`Bearer ${SECRET}`)).status).toBe(401);
    expect((await post()).status).toBe(401);
  });

  it("accepts the correct token", async () => {
    const res = await post(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    // Retired short-circuit keeps the test off the sync path entirely.
    await expect(res.json()).resolves.toMatchObject({ retired: true });
  });
});
```

- [ ] **Step 6: Verify**

```bash
pnpm jest __tests__
pnpm tsc --noEmit
pnpm lint
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add app/api/health/route.ts app/api/cron/sync/route.ts __tests__/api/
git commit -m "fix(api): stop health endpoint leaking DB errors and consuming the pool

/api/health is unauthenticated: it ran SELECT 1 per request against a pool with
max 12, and returned raw Postgres error text (host, port, database name). Now
cached for 10s and returns a bare status. Cron token moves to timingSafeEqual."
```

---

## Final Verification

- [ ] **Full suite and build**

```bash
pnpm jest __tests__
pnpm tsc --noEmit
pnpm lint
pnpm build
```

- [ ] **Confirm the schema push is done**

Task 2 changed `lib/db/schema.ts`. Confirm the human partner has run
`pnpm drizzle-kit push` before any manual verification against a real database.

- [ ] **Manual checks** (from the spec's Testing section)

1. Rotate a landscape photo through all four angles — confirm it covers the frame
   at every step and that dragging moves it the direction pushed.
2. Repeat with a portrait photo.
3. Rotate, save, reload — confirm the rotation persists and the display matches the
   editor preview exactly.
4. Delete a rotated photo, upload a new one — confirm the new photo is unrotated.
5. Confirm the sheet's col B photo is unchanged after a rotation.
6. Filter the database list by each of the three vaccination states.
7. Open a cat with no vaccination date in the public catalog — confirm it reads
   `Unknown`, not `No`.
8. Request a non-adoptable cat's catalog URL — confirm a real 404 status and the
   styled 404 page.
9. Request a nonsense route — confirm the same page appears.
10. Check a cat page's rendered `<title>` and OG tags in view-source.
11. Fetch `/sitemap.xml` and `/robots.txt`.
12. Confirm the Cloudflare Worker's health poll and cron tick still succeed
    end-to-end.
