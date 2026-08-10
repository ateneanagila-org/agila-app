# Cat Photo Lightbox + Lossless Crop — Design Spec

**Date:** 2026-06-24
**Status:** Approved design, pre-implementation

## Problem

Two gaps in the cat-photo experience:

1. **No focused view.** `CatPhoto` is a passive image everywhere. To see a photo
   larger a user has to open the raw image in a new browser tab. We want an
   in-app focused modal (Messenger-style lightbox).
2. **No way to re-edit a stored photo.** The zoom/crop editor
   (`PhotoPositionEditor`) only runs when a *new* file is picked. Once a photo is
   uploaded the crop is baked into a 1200² JPEG and the source is discarded — a
   bad crop (head cut off, too tight) can only be fixed by re-uploading. There is
   no path to re-crop, and no way to ever zoom *out* because the original is gone.

A third option considered — make the lightbox download the image so the user
edits and re-uploads — is rejected. It is too clunky for the non-technical
stewards who will own this app after handoff.

## Constraint that shapes the solution

Supabase storage is capped at **1 GB**; ~116 MB is already used. A naive "store
the original *and* the baked crop" approach doubles per-cat storage and roughly
halves remaining headroom — not acceptable for a rarely-used edit feature. See
the companion storage analysis for the full long-term picture.

## Solution: original + crop-as-metadata

Stop baking a crop. Store **one** blob per cat — the full normalized original —
and represent the crop as **three numbers** on the `cats` row. Rendering applies
the crop with a CSS transform (the exact math `PhotoPositionEditor` already uses
for its live preview).

This keeps storage at one blob per cat (≈ flat vs today), makes editing lossless
and instant (change three numbers, no re-upload, no re-bake, no JPEG-of-JPEG
decay), and leaves the storage GC and path convention untouched.

### Why crop-as-metadata over the alternatives

| Approach | Storage | Edit quality | Cleanup paths |
|---|---|---|---|
| Two blobs (original + baked) | **2×** | lossless | GC + merge must track 2 paths |
| Re-edit the baked square | flat | poor — pan/zoom-in only, never zoom out | unchanged |
| **Original + metadata (chosen)** | **flat** | lossless | unchanged (one path per cat) |

## Data model

Add three columns to `cats` (next to `photo_url`):

- `photo_zoom` — `real`, default `1`
- `photo_offset_x` — `real`, default `0`
- `photo_offset_y` — `real`, default `0`

`drizzle-kit push`. Defaults backfill all existing rows to identity (no
transform), so legacy photos render exactly as they do today.

Add the three columns to the `cats.repo` projection and the `Cat`/`SelectCat`
type so every surface that already spreads a cat object gets them for free.

## Storage model shift

`${catId}/photo.jpg` changes meaning from "baked 1200² crop" to "full normalized
original":

- `uploadCatPhoto` runs sharp `rotate()` + `resize({ width: 1280, withoutEnlargement: true })`
  + `jpeg({ quality: 80 })` — **no crop**. Bounded size (~250–350 KB), comparable
  to today's baked crop.
- The crop the user framed at upload time is saved as the three position columns,
  **not** rendered into the pixels.

Path convention is unchanged (`${catId}/photo.jpg`), so `reconcileCatPhotos` GC
and the reference-aware cleanup in `cat-photo-storage.ts` need no changes.

## Rendering

Extract the editor's preview-transform math into a shared module
(`lib/photo-position.ts` or similar) exporting:

- `getPhotoTransformStyle(naturalSize, position)` → CSS for the positioned `<img>`
- `getOffsetBounds` / `clampPosition` (moved out of `photo-position-editor.tsx`)

Consumers: `PhotoPositionEditor` (preview) and `CatPhoto` (display) — single
source of truth so the editor preview and the rendered result always match.

`CatPhoto` gains an optional `position?: PhotoPosition` prop (defaults identity):

- **Identity** (`zoom 1, offset 0,0`) → plain `object-cover`, current behavior.
  Covers all legacy photos and any un-adjusted upload. No natural-size read, no
  layout flash.
- **Adjusted** → raw `<img>` positioned via `getPhotoTransformStyle`; natural
  dimensions read on `onLoad` (brief `object-cover` fallback → snap on load,
  minor).

`CatPhoto` stays a **dumb image** — it does not own click/lightbox behavior.
Parent surfaces wire interactivity. This guarantees we never intercept a click on
a photo that already sits inside a navigable card, row, or selection button.

## Lightbox: view + action hub

New component `PhotoLightbox`:

- Focused overlay showing the **full original** (`object-contain`) so the whole
  frame is visible.
- Dismiss via backdrop click and `Esc`; focus trap; scroll lock.
- Action bar, shown only when `canEdit`: **Take · Choose · Edit crop · Remove**.
  - **Take** → existing `PhotoCaptureDialog`.
  - **Choose** → file input.
  - **Edit crop** → `PhotoPositionEditor` inline on the current original →
    `editCatPhotoPosition`.
  - **Remove** → `removeCatPhoto`.
- `canEdit = false` → pure viewer, no action bar.

Props: `{ photoUrl, name, position, canEdit, catId, onChanged }`.

## Server actions

- `uploadCatPhoto(catId, formData)` — `formData` carries `file` **+ position**
  (`zoom`, `offsetX`, `offsetY`). Server normalizes (rotate/resize, **no crop**),
  uploads as `photo.jpg`, sets `photo_url` (cache-busted) **and** the three
  position columns. `refreshCatInSyncQueue` (photo_url changed → sheet update).
  No `last_updated_at` bump (unchanged — photo is app-owned).
- `editCatPhotoPosition(catId, position)` — **new**. Updates only the three
  position columns. **No `photo_url` change and no sync queue** — position is
  app-only metadata that never reaches the sheet. Lightweight, instant.
- `removeCatPhoto(catId)` — existing; also reset the three columns to defaults.

All three keep the existing auth gate: `MANAGER_OR_ADMIN`, or the volunteer owns
a `session_cats` row joined to a `session_users` row for the current user.

## Upload / session-form flow

`cat-entry-form` keeps its current Take/Choose + inline `PhotoPositionEditor`
flow for *new* files. Add one capability: when the cat already has a saved photo
and no new file is picked, expose an **"Adjust"** control that opens the editor on
the existing original → `editCatPhotoPosition`. This gives volunteers lossless
re-crop inside their own workflow without a re-upload.

## Merge integration

In the crossref merge flow (`sessions-approval-crossref-screen.tsx`
`buildMergeDiff` + apply, and `session-dialogs.tsx` `MergeDetailsDialog`), the
photo is a user-chosen field. Bundle the position trio with `photo_url`:

- When the survivor adopts the *other* cat's photo, also copy that cat's
  `photo_zoom` / `photo_offset_x` / `photo_offset_y` — otherwise the survivor
  shows the new blob under the wrong crop.
- The New/Current comparison thumbnails must each render with their own cat's
  position, so the manager compares the actual framing.

This is a merge-apply change only. **No GC change, no second storage path.**

## Surface inventory (every cat-photo surface)

Governing rule: lightbox is opt-in only where the photo is a **standalone**
element. Anywhere the photo already sits inside a button/Link, that action wins.

| # | Surface | File | Wrapper today | Lightbox | Actions | RBAC |
|---|---|---|---|---|---|---|
| 1 | DB detail · General | `database-general-screen` | standalone, 2-btn overlay | **Yes** — replace overlay w/ **pencil** | Take · Choose · Edit crop · Remove | `canManage`; volunteer view-only |
| 2 | DB detail · Medical | `database-medical-screen` | standalone header | **Yes** — expand | full hub (managers) | `canManage`; volunteer view-only |
| 3 | DB detail · Interventions | `database-interventions-screen` | standalone header | **Yes** — expand | full hub (managers) | `canManage`; volunteer view-only |
| 4 | Catalog detail (public) | `catalog-detail-screen` | standalone | **Yes** — view-only | none | public |
| 5 | Session cat form | `cat-entry-form` | preview + inline editor | **Keep** flow; add **Adjust** to re-crop saved original | Take · Choose · Edit crop | volunteer on own session (server-enforced) |
| 6 | Session create/edit cat row | `sessions-create-screen` | photo inside `button → setEditingCat` | **No** — opens form | — | volunteer workflow |
| 7 | Merge dialog New/Current | `session-dialogs` | photo inside selection button | **No** — click = pick photo | — | manager/admin |
| 8 | Validation review | `sessions-approval-validation-screen` | standalone 80px | **Yes** — full hub | Take · Choose · Edit crop · Remove | manager/admin (catch bad volunteer crops) |
| 9 | Crossref candidate cards | `sessions-approval-crossref-screen` | navigable cards | **No** — navigates | — | manager/admin |
| 10 | Review queue rows | `sessions-manager-screen` | row `→ href` | **No** — navigates | — | manager/admin |
| 11 | All list cards | `cat-card` (compact/default/wide) | whole card = `<Link>` | **No** — navigates | — | per-list |

**Edit crop reaches three workflow tiers:** volunteer fixes own crop in the
session form (#5); manager fixes any crop at validation (#8); manager fixes any
crop anytime on DB detail (#1–3).

**Iconography:** editable frame → **pencil** badge; view-only frame →
**expand/maximize** badge. Both open the lightbox. On standalone surfaces the
whole photo is the click target.

## RBAC (defense in depth)

- UI: `PhotoLightbox` hides the action bar entirely when `canEdit` is false — no
  failed clicks. Surfaces compute `canEdit`: DB detail = `canManage`;
  validation = `canManage` (always true there); catalog/merge = `false`; session
  form = participant (true; server re-checks ownership).
- Server: the three actions remain the real gate with the existing
  `MANAGER_OR_ADMIN || owns-session-cat` check.

## Legacy photos (the ~377 imported)

`photo.jpg` is a pre-cropped blob; position defaults to identity → renders
`object-cover`, identical to today. Editing a legacy photo re-positions over the
cropped blob (pan/zoom-in only, no true original to recover) — same code path, no
branch. New uploads going forward get the full original and true lossless edit.

## Accepted trade-offs / known regressions

- **Sheet shows the uncropped original.** New uploads send the full original to
  the sheet `=IMAGE()`; the crop (position metadata) does not sync. Arguably more
  informative; accepted.
- **Brief cover→transform snap** on first load of an adjusted photo (natural size
  read on `onLoad`). Minor.
- **Legacy edit is limited** (no recoverable original). Expected.

## Testing

- Transform-helper parity: editor preview vs `CatPhoto` display produce the same
  framing for a given position.
- `uploadCatPhoto` stores normalized original (no crop) + sets position columns;
  enqueues a sync.
- `editCatPhotoPosition` updates only the three columns; does **not** touch
  `photo_url` and does **not** enqueue a sync.
- `removeCatPhoto` clears `photo_url` and resets position to defaults.
- Merge carries the position trio when the survivor adopts the other cat's photo.

## Out of scope (YAGNI)

- Multiple photos per cat / galleries. If that becomes a real requirement,
  promote to a `cat_photos` table with `cats.photo_url` as the primary pointer
  and per-row position — a clean migration done when the need is concrete, not
  now.
