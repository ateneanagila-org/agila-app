# GSheet Photo Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import pasted/embedded images from Google Sheets into Supabase storage, integrated into the existing sync cycle so photos are never lost and replacements are detected automatically.

**Architecture:** Reverse sync is stripped of all `photo_url` responsibility. A new photo phase (Phase 0) runs at the top of every sync cycle before reverse and forward sync. It reads the already-needed sheet state per region, detects rows where `lastEditedAt` is set and col B is `""` (pasted image, invisible to Values API), and fires a single ZIP export only when candidates are found. Extracted images are compressed via `sharp` (server-side, matching app UI constraints) and uploaded to a public Supabase `cat-photos` bucket. After upload, `refreshCatInSyncQueue` queues a forward sync so col B gets replaced with a stable `=IMAGE(supabase_url)` formula. A separate local script handles the one-time bulk backfill of all existing null-photo cats.

**Tech Stack:** `jszip` (ZIP extraction), `node-html-parser` (HTML parsing), `sharp` (server-side image compression), `@supabase/supabase-js` storage API, Google Drive API v3 (via existing `googleapis` package + added `drive.readonly` scope), Drizzle ORM.

**Cron cadence:** Unchanged at 10 minutes — single existing `/api/cron/sync` route, no new cron endpoint. The photo phase adds negligible overhead on quiet cycles (detection is in-memory, no ZIP fired) and finishes well within the 10-minute window even on heavy cycles. See Known Risks for the full analysis.

---

## File Map

| File | Change |
|---|---|
| `lib/validation/reverse-sync.ts` | Remove `photo_url` from schema and both parsers |
| `lib/services/reverse-sync.service.ts` | Remove `photo_url` from `importSheetRowToDB` |
| `lib/services/helper.service.ts` | Add `drive.readonly` scope; add `exportSpreadsheetAsZip()` |
| `lib/services/photo-import.service.ts` | **Create** — detection, ZIP parsing, compression, upload |
| `lib/scripts/import-photos.ts` | **Create** — local CLI for one-time bulk backfill |
| `app/actions/google-sheets.ts` | Add Phase 0 photo import before reverse sync |

---

## Task 1: Remove photo_url from Reverse Sync Validation

**Files:**
- Modify: `lib/validation/reverse-sync.ts`

Reverse sync no longer owns `photo_url`. The photo import service exclusively manages it. Removing it from validation prevents it from being passed to `importSheetRowToDB` at all.

- [ ] **Step 1: Remove from `sheetRowSchema`**

In `lib/validation/reverse-sync.ts`, delete the `photo_url` line from the schema:

```ts
// REMOVE this line:
photo_url: z.string().nullable(),
```

- [ ] **Step 2: Remove from `parseSheetRow`**

In `parseSheetRow`, delete the photo parsing block and its return value entry:

```ts
// REMOVE these lines:
const rawPhoto = String(row[1] ?? "").trim();
const photoMatch = rawPhoto.match(/=IMAGE\("(.+?)"\)/i);
const photo_url = photoMatch ? photoMatch[1] : rawPhoto || null;
```

And remove `photo_url` from the returned object:

```ts
// REMOVE from return:
photo_url,
```

- [ ] **Step 3: Remove from `parseUnknownSheetRow`**

In `parseUnknownSheetRow`, remove `photo_url` from the returned object:

```ts
// REMOVE from return:
photo_url: null,
```

- [ ] **Step 4: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: errors in `reverse-sync.service.ts` referencing `data.photo_url` — fixed in Task 2.

---

## Task 2: Remove photo_url from Reverse Sync Service

**Files:**
- Modify: `lib/services/reverse-sync.service.ts`

`importSheetRowToDB` currently writes `photo_url` to the DB on every import. With the schema change from Task 1, `data.photo_url` no longer exists. Remove it from the cats update.

- [ ] **Step 1: Remove from `importSheetRowToDB`**

In `lib/services/reverse-sync.service.ts`, inside `importSheetRowToDB`, find the `.set({...})` block and remove the `photo_url` line entirely:

```ts
await tx
  .update(cats)
  .set({
    name: data.name,
    color: data.color,
    age: data.age,
    sex: data.sex,
    sociability: data.sociability,
    cat_status: data.cat_status,
    spot_last_seen: data.spot_last_seen,
    caretaker: data.caretaker,
    notes: data.notes,
    is_adoptable: data.is_adoptable,
    // photo_url intentionally omitted — owned exclusively by photo-import.service.ts
    ...(data.paws_id !== undefined ? { paws_id: data.paws_id } : {}),
    last_updated_at: new Date(),
  })
  .where(eq(cats.id, data.id));
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit Tasks 1 and 2 together**

```bash
git add lib/validation/reverse-sync.ts lib/services/reverse-sync.service.ts
git commit -m "refactor: remove photo_url from reverse sync — owned by photo import service"
```

---

## Task 3: Install Dependencies

**Files:** `package.json` (updated by pnpm)

- [ ] **Step 1: Install packages**

```bash
pnpm add jszip node-html-parser sharp
```

`jszip` and `node-html-parser` ship their own TypeScript types. `sharp` also includes types since v0.31 — no `@types/` packages needed for any of them.

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add jszip, node-html-parser, sharp for photo import"
```

---

## Task 4: Add Drive Scope + ZIP Export to helper.service.ts

**Files:**
- Modify: `lib/services/helper.service.ts`

The service account already has access to the spreadsheet file (shared for Sheets API). Adding `drive.readonly` to the existing auth scopes allows the same credentials to export the file as a ZIP via Drive API v3. `google.drive` is already available from the existing `googleapis` import — no new package needed.

- [ ] **Step 1: Add `drive.readonly` to the scopes array**

In `connectToSheets` (around line 35), update the scopes:

```ts
scopes: [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.readonly",
],
```

- [ ] **Step 2: Add `exportSpreadsheetAsZip` after `connectToSheets`**

```ts
/**
 * Exports the spreadsheet as an HTML ZIP via Drive API v3.
 * ZIP contains one HTML file per sheet tab + an images/ directory.
 * Image bytes in the HTML reference images/imageN.png by filename.
 * Google resamples pasted images to cell display size on export —
 * output images are already reduced from their original resolution.
 */
export async function exportSpreadsheetAsZip(
  spreadsheetId: string,
  glAuth: InstanceType<typeof google.auth.GoogleAuth>,
): Promise<Buffer> {
  const drive = google.drive({ version: "v3", auth: glAuth });
  const response = await drive.files.export(
    { fileId: spreadsheetId, mimeType: "application/zip" },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(response.data as ArrayBuffer);
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add lib/services/helper.service.ts
git commit -m "feat: drive.readonly scope and exportSpreadsheetAsZip helper"
```

---

## Task 5: Photo Import Service

**Files:**
- Create: `lib/services/photo-import.service.ts`

**Detection logic:**
- For each region, read sheet state (col A:Y via `readSheetState`)
- A row is a candidate if: `lastEditedAt` is set AND col B (`raw[1]`) is `""`
- `col B = ""` means either a pasted image (invisible to Values API) or genuinely no photo — both return empty. The ZIP is the definitive check.
- `col B = "=IMAGE(...)"` means a stable formula — skip, no change needed.

**ZIP processing:**
- One ZIP export covers every sheet tab — no per-region export
- Parse all `.html` files; identify rows by UUID regex (position-independent, not column-index-based)
- Only process UUIDs that are in the candidate set from detection
- Compress each image with `sharp` to JPEG 1200px max / quality 80 before upload
- Upload to Supabase `cat-photos` bucket with `upsert: true` (handles replacements)
- Wrap DB update + `refreshCatInSyncQueue` in a transaction so forward sync is queued with the new URL

**For cats with no photo at all:**
- They may appear as candidates (col B = "") but won't be in the ZIP photo map
- Correctly skipped — `photo_url` stays null, no error

- [ ] **Step 1: Create the file**

```ts
import JSZip from "jszip";
import { parse as parseHtml } from "node-html-parser";
import sharp from "sharp";
import { eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { cats } from "@/lib/db/schema";
import {
  connectToSheets,
  exportSpreadsheetAsZip,
  readSheetState,
  refreshCatInSyncQueue,
} from "./helper.service";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "cat-photos";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Scans all <tr> elements in an HTML string for UUID→imageSrc pairs.
 * Matches col Y by UUID pattern and col B by <img src="images/...">.
 * Position-independent — unaffected by merged cells or col ordering.
 */
function parsePhotoMappingsFromHtml(
  html: string,
): Array<{ uuid: string; imageSrc: string }> {
  const root = parseHtml(html);
  const results: Array<{ uuid: string; imageSrc: string }> = [];

  for (const row of root.querySelectorAll("tr")) {
    let uuid: string | null = null;
    let imageSrc: string | null = null;

    for (const cell of row.querySelectorAll("td")) {
      const text = cell.text.trim();
      if (UUID_REGEX.test(text)) uuid = text;

      const img = cell.querySelector("img");
      if (img) {
        const src = img.getAttribute("src");
        if (src?.startsWith("images/")) imageSrc = src;
      }
    }

    if (uuid && imageSrc) results.push({ uuid, imageSrc });
  }

  return results;
}

/**
 * Parses all HTML files in the ZIP and returns a uuid → raw Buffer map.
 * Only loads image bytes for UUIDs in the candidate set.
 * This avoids loading images for rows that were not flagged by detection.
 */
async function buildPhotoMap(
  zip: JSZip,
  candidateUuids: Set<string>,
): Promise<Map<string, Buffer>> {
  const map = new Map<string, Buffer>();

  const htmlFileNames = Object.keys(zip.files).filter((n) =>
    n.toLowerCase().endsWith(".html"),
  );

  for (const htmlFileName of htmlFileNames) {
    const html = await zip.files[htmlFileName].async("text");

    for (const { uuid, imageSrc } of parsePhotoMappingsFromHtml(html)) {
      if (!candidateUuids.has(uuid) || map.has(uuid)) continue;
      const imageFile = zip.files[imageSrc];
      if (!imageFile) continue;
      const buffer = await imageFile.async("nodebuffer");
      map.set(uuid, buffer);
    }
  }

  return map;
}

/**
 * Compresses an image buffer to JPEG 1200px max / quality 80.
 * Matches app UI compression constraints (browser-image-compression).
 * Always outputs JPEG regardless of input format.
 */
async function compress(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}

async function uploadAndQueue(
  uuid: string,
  buffer: Buffer,
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
): Promise<void> {
  const compressed = await compress(buffer);
  const storagePath = `${uuid}/photo.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, compressed, { contentType: "image/jpeg", upsert: true });

  if (uploadError) throw new Error(uploadError.message);

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  await db.transaction(async (tx) => {
    await tx
      .update(cats)
      .set({ photo_url: publicUrl, last_updated_at: new Date() })
      .where(eq(cats.id, uuid));
    await refreshCatInSyncQueue(uuid, tx);
  });
}

async function processBatch(
  entries: [string, Buffer][],
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
): Promise<{ imported: number; errors: Array<{ catId: string; error: string }> }> {
  let imported = 0;
  const errors: Array<{ catId: string; error: string }> = [];

  const BATCH_SIZE = 10;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(([uuid, buf]) => uploadAndQueue(uuid, buf, supabase)),
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled") {
        imported++;
      } else {
        errors.push({
          catId: batch[j][0],
          error: r.reason instanceof Error ? r.reason.message : "Upload failed",
        });
      }
    }
  }

  return { imported, errors };
}

export interface PhotoImportResult {
  triggered: boolean;
  imported: number;
  errors: Array<{ catId: string; error: string }>;
}

/**
 * Phase 0 of the sync cycle. Called once per cycle before reverse sync.
 *
 * Reads sheet state for each region (same data reverse sync needs) and
 * identifies candidate rows: lastEditedAt is set AND col B is "".
 * Fires ZIP export only when candidates exist. Processes only candidate
 * UUIDs found in the ZIP photo map. Cats with no actual pasted image
 * are correctly skipped (they won't appear in the photo map).
 *
 * Known limitation: new cats added via sheet with a pasted photo and
 * photo_url still null will be caught here (col B = "", lastEditedAt set).
 * Cats whose pasted photo predates the lastEditedAt tracking system
 * require the bulk script (lib/scripts/import-photos.ts).
 */
export async function importPhotosIfNeeded(
  allRegions: { id: string; name: string }[],
): Promise<PhotoImportResult> {
  const candidateUuids = new Set<string>();

  for (const region of allRegions) {
    const rows = await readSheetState(region.id);
    for (const row of rows) {
      if (row.lastEditedAt && (row.raw[1] ?? "").trim() === "") {
        candidateUuids.add(row.entityId);
      }
    }
  }

  if (candidateUuids.size === 0) {
    return { triggered: false, imported: 0, errors: [] };
  }

  const { glAuth } = await connectToSheets();
  const zipBuffer = await exportSpreadsheetAsZip(
    process.env.CATALOG_SPREADSHEET_ID!,
    glAuth,
  );
  const zip = await JSZip.loadAsync(zipBuffer);
  const photoMap = await buildPhotoMap(zip, candidateUuids);

  if (photoMap.size === 0) {
    // All candidates had no actual image (genuinely no photo cats)
    return { triggered: true, imported: 0, errors: [] };
  }

  const supabase = await createAdminClient();
  const { imported, errors } = await processBatch([...photoMap.entries()], supabase);

  console.log(
    `[PhotoImport] triggered=true candidates=${candidateUuids.size} found=${photoMap.size} imported=${imported} errors=${errors.length}`,
    errors.length > 0 ? errors.slice(0, 5) : "",
  );

  return { triggered: true, imported, errors };
}

/**
 * Bulk import for the local script only. Targets all cats with photo_url IS NULL
 * regardless of sheet edit state — covers cats whose pasted photos predate
 * the lastEditedAt tracking system.
 *
 * Not called by the sync cycle. Run via: pnpm tsx lib/scripts/import-photos.ts
 */
export async function bulkImportAllNullPhotos(): Promise<{
  imported: number;
  errors: Array<{ catId: string; error: string }>;
}> {
  const nullPhotoCats = await db
    .select({ id: cats.id })
    .from(cats)
    .where(isNull(cats.photo_url));

  if (nullPhotoCats.length === 0) {
    console.log("[BulkImport] No cats with null photo_url — nothing to do.");
    return { imported: 0, errors: [] };
  }

  const targetIds = new Set(nullPhotoCats.map((c) => c.id));

  const { glAuth } = await connectToSheets();
  const zipBuffer = await exportSpreadsheetAsZip(
    process.env.CATALOG_SPREADSHEET_ID!,
    glAuth,
  );
  const zip = await JSZip.loadAsync(zipBuffer);
  const photoMap = await buildPhotoMap(zip, targetIds);

  if (photoMap.size === 0) {
    console.log("[BulkImport] ZIP contained no images for null-photo cats.");
    return { imported: 0, errors: [] };
  }

  const supabase = await createAdminClient();
  const { imported, errors } = await processBatch([...photoMap.entries()], supabase);

  console.log(
    `[BulkImport] targets=${targetIds.size} found=${photoMap.size} imported=${imported} errors=${errors.length}`,
  );

  return { imported, errors };
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

Common issues to fix:
- `refreshCatInSyncQueue` is imported from `helper.service.ts` — confirm it is exported there
- `readSheetState` is exported from `helper.service.ts` ✓

- [ ] **Step 3: Commit**

```bash
git add lib/services/photo-import.service.ts
git commit -m "feat: photo import service — detection, ZIP, compression, upload"
```

---

## Task 6: Local Script — One-Time Bulk Backfill

**Files:**
- Create: `lib/scripts/import-photos.ts`

Calls `bulkImportAllNullPhotos` directly via `tsx`. No Vercel timeout ceiling. Run this once to backfill all cats that have pasted photos with no `photo_url` in DB. Re-run any time after a bulk batch of cats is added to the sheet with pasted photos.

- [ ] **Step 1: Create the file**

```ts
import "dotenv/config";
import { bulkImportAllNullPhotos } from "@/lib/services/photo-import.service";

async function main() {
  console.log("[ImportPhotos] Starting bulk backfill...");
  const result = await bulkImportAllNullPhotos();
  console.log("[ImportPhotos] Done:", result);
  process.exit(0);
}

main().catch((err) => {
  console.error("[ImportPhotos] Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it**

Ensure `.env.local` has `SERVICE_ACCOUNT_CREDENTIALS`, `CATALOG_SPREADSHEET_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_SUPABASE_SERVICE_ROLE_KEY`.

```bash
pnpm tsx lib/scripts/import-photos.ts
```

Expected output:
```
[ImportPhotos] Starting bulk backfill...
[BulkImport] targets=N found=M imported=M errors=0
[ImportPhotos] Done: { imported: M, errors: [] }
```

If `found=0` and you expect photos, col Y (UUID) may be hidden in the HTML export — see Known Risks.

- [ ] **Step 3: Commit**

```bash
git add lib/scripts/import-photos.ts
git commit -m "feat: local script for bulk photo backfill"
```

---

## Task 7: Integrate Photo Phase into Sync Cycle

**Files:**
- Modify: `app/actions/google-sheets.ts`

Add Phase 0 at the top of `syncAllPendingRegions`, before reverse sync. The photo phase reads sheet state per region (same data reverse sync needs) and fires the ZIP only when candidates are found. Reverse and forward sync run after, so forward sync always writes the correct `photo_url` to col B.

- [ ] **Step 1: Add import**

At the top of `app/actions/google-sheets.ts`, add:

```ts
import { importPhotosIfNeeded } from "@/lib/services/photo-import.service";
```

- [ ] **Step 2: Update `syncAllPendingRegions`**

The full updated function:

```ts
export async function syncAllPendingRegions() {
  const pendingTasks = await db
    .selectDistinct({ regionId: gsheetSyncQueue.regionId })
    .from(gsheetSyncQueue)
    .where(eq(gsheetSyncQueue.status, "PENDING"));

  const allRegions = await db.query.regions.findMany();

  // Phase 0: Photo import — detect pasted images before reverse/forward sync.
  // Reads sheet state per region, fires ZIP only when candidates found.
  // Must run before forward sync so col B gets the correct =IMAGE(url) formula.
  try {
    await importPhotosIfNeeded(allRegions);
  } catch (error) {
    console.error(
      "[PhotoImport] Failed:",
      error instanceof Error ? error.message : error,
    );
  }

  // Phase A: Reverse sync ALL regions (text fields only — photo_url excluded)
  for (const region of allRegions) {
    try {
      await reverseSyncRegion(region.id);
    } catch (error) {
      console.error(
        `[ReverseSync] Region ${region.id} failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Phase B: Forward sync only regions with pending tasks
  await Promise.all(
    pendingTasks.map((task) => syncAndCompactRegion(task.regionId)),
  );

  // Phase C: Regenerate summary sheets
  try {
    await generateForRiSheet();
    await generateForFaSheet();
    console.log("[SummarySheets] For RI + For FA regenerated");
  } catch (error) {
    console.error(
      "[SummarySheets] Failed:",
      error instanceof Error ? error.message : error,
    );
  }
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/actions/google-sheets.ts
git commit -m "feat: integrate photo import as Phase 0 of sync cycle"
```

---

## Task 8: Manual Setup — Supabase Bucket

Must be done before running the local script or deploying.

- [ ] **Step 1: Create the bucket**

In Supabase dashboard → Storage → New bucket:
- Name: `cat-photos`
- Public: **Yes** — URL used in `=IMAGE()` in GSheets and displayed in app UI; must be accessible without auth headers.

OR via Supabase SQL editor:

```sql
insert into storage.buckets (id, name, public)
values ('cat-photos', 'cat-photos', true)
on conflict (id) do nothing;
```

- [ ] **Step 2: Verify public URL format**

Upload any test image manually, then confirm the URL pattern is accessible in a browser:
```
https://<project-ref>.supabase.co/storage/v1/object/public/cat-photos/<uuid>/photo.jpg
```

---

## Task 9: Initial Bulk Backfill and Verification

- [ ] **Step 1: Run the local script**

```bash
pnpm tsx lib/scripts/import-photos.ts
```

- [ ] **Step 2: Verify photos in DB**

```sql
select id, name, photo_url
from cats
where photo_url like '%supabase%'
limit 20;
```

Expected: rows with `photo_url` pointing to the `cat-photos` bucket.

- [ ] **Step 3: Verify queue row exists for imported cats**

`uploadAndQueue` already calls `refreshCatInSyncQueue` inside its transaction, which inserts the correct forward sync task with the full row payload. Do NOT insert manually — an empty `payload` array would cause forward sync to write nothing to col B.

In Supabase SQL editor, confirm the queue rows were created:

```sql
select entity_id, status, created_at
from gsheet_sync_queue
where status = 'PENDING'
  and entity_id in (
    select id from cats where photo_url like '%supabase%' limit 5
  );
```

Expected: rows present with `status = 'PENDING'`. Then wait up to 10 minutes for the next cron cycle (or hit the sync endpoint manually). Confirm col B in the sheet becomes `=IMAGE("https://...supabase...")` for those rows.

- [ ] **Step 4: Verify ongoing detection**

Edit any text field for one cat in the sheet (a cat that has a pasted image). Wait up to 10 minutes for the next cron cycle. Confirm:
- `photo_url` in DB updated to new Supabase URL (or unchanged if already imported)
- Col B in sheet becomes a formula after the forward sync that follows

---

## Known Risks / Decisions

| Risk | Decision |
|---|---|
| **Cron cycle overlap from slow uploads** | Per-image cost: ~50–100ms compression + ~200–500ms upload = ~300–600ms. At 10 concurrent, 20 photos takes ~4s, 50 photos ~15s. Worst realistic ongoing cycle finishes well under 60s — the 10-min interval is a large buffer. Cycle overlap can only occur if Supabase is severely throttled; both cycles operate on different candidate sets (col W cleared after processing) so data conflicts are not possible. Initial bulk import (500+ photos) runs via local script only, never via cron. |
| ZIP structure varies by spreadsheet title | `buildPhotoMap` parses ALL `.html` files — no name matching needed |
| Col Y hidden in HTML export | UUID regex is position-independent; if hidden, row stays `photo_url = null` and needs local script |
| No-photo cats trigger false positive ZIP | ZIP finds no entry for that UUID → skipped cleanly; ZIP runs once per edit event (col W cleared after) |
| New sheet-added cats with photos (photo_url = null, lastEditedAt set) | Caught by detection — `col B = "" AND lastEditedAt set` triggers ZIP regardless of photo_url state |
| Cats with pasted photos predating lastEditedAt tracking | Not caught by ongoing detection — use `lib/scripts/import-photos.ts` for backfill |
| Large ZIP on initial bulk run | Local script only — no Vercel timeout ceiling. After initial import, ZIP shrinks (formulas replace embedded images) |
| Double Sheets API read per region when candidates found | Phase 0 calls `readSheetState` per region; Phase A does too — 2N reads per cycle. At 6 regions = 12 calls. Well within Google quota; no action needed. |
| Image size inconsistency vs app UI | `sharp` compresses to JPEG 1200px / quality 80 — same constraints as app UI |
| Photo replacement via sheet (new paste over existing formula) | Col B reverts to `""`, detection catches it next cycle, new image imported and old Supabase path overwritten via `upsert: true` |
