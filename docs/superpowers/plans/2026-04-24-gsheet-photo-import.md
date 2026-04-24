# GSheet Photo Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import pasted/embedded images from Google Sheets into a Supabase storage bucket, and guard the reverse sync from wiping existing `photo_url` values on text-only edits.

**Architecture:** The reverse sync guard is a one-line patch in `importSheetRowToDB`. The photo import is a separate service (`photo-import.service.ts`) that exports the entire spreadsheet as an HTML ZIP via the Drive API, parses all HTML files for UUID→image mappings (matching by UUID regex, not column index), uploads each image buffer to a public Supabase bucket, and updates `cats.photo_url`. A cron route triggers it on demand or on a schedule.

**Tech Stack:** `jszip` (ZIP extraction), `node-html-parser` (HTML parsing), `@supabase/supabase-js` storage API, Google Drive API v3 (already authenticated via service account), Drizzle ORM, Next.js App Router API routes.

---

## File Map

| File | Change |
|---|---|
| `lib/services/reverse-sync.service.ts` | Patch `importSheetRowToDB` — skip `photo_url` update when incoming is null |
| `lib/services/helper.service.ts` | Add `drive.readonly` scope; add `exportSpreadsheetAsZip()` |
| `lib/services/photo-import.service.ts` | **Create** — core photo import logic |
| `app/api/cron/photo-import/route.ts` | **Create** — HTTP trigger for photo import |
| `vercel.json` | **Create** — cron schedule config |

---

## Task 1: Guard — Don't Null Out Existing Photo URLs

**Files:**
- Modify: `lib/services/reverse-sync.service.ts` (line ~286)

When col B is a pasted image, `parseSheetRow` returns `photo_url: null`. The current code unconditionally writes that null to the DB, wiping a previously-imported photo the moment any other field on that cat is edited in the sheet.

- [ ] **Step 1: Apply the guard**

In `lib/services/reverse-sync.service.ts`, inside `importSheetRowToDB`, find the `cats` update block and change the `photo_url` line:

```ts
// BEFORE (line ~286):
photo_url: data.photo_url,

// AFTER:
...(data.photo_url !== null ? { photo_url: data.photo_url } : {}),
```

The full `.set({...})` block becomes:

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
    ...(data.photo_url !== null ? { photo_url: data.photo_url } : {}),
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

- [ ] **Step 3: Commit**

```bash
git add lib/services/reverse-sync.service.ts
git commit -m "fix: preserve photo_url on reverse sync text-only edits"
```

---

## Task 2: Install Dependencies

**Files:** `package.json` (updated by pnpm)

- [ ] **Step 1: Install packages**

```bash
pnpm add jszip node-html-parser
```

- [ ] **Step 2: Verify types are available**

```bash
pnpm tsc --noEmit
```

`jszip` and `node-html-parser` both ship their own types — no `@types/` packages needed.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add jszip and node-html-parser for photo import"
```

---

## Task 3: Add Drive Scope + ZIP Export to helper.service.ts

**Files:**
- Modify: `lib/services/helper.service.ts`

The service account is already shared on the spreadsheet. Adding `drive.readonly` scope lets the same credentials export the file as a ZIP via Drive API.

- [ ] **Step 1: Add `drive.readonly` scope to `connectToSheets`**

Find the `scopes` array in `connectToSheets` (around line 35) and add the Drive scope:

```ts
scopes: [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.readonly",
],
```

- [ ] **Step 2: Add `exportSpreadsheetAsZip` export at end of Section 1**

After the closing brace of `connectToSheets`, add:

```ts
/**
 * Exports the spreadsheet as an HTML ZIP archive via Drive API.
 * The ZIP contains one HTML file per sheet tab and an images/ directory.
 * Used by the photo import service to extract pasted in-cell images.
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

Expected: no errors. (`google.drive` is already available from the existing `googleapis` import.)

- [ ] **Step 4: Commit**

```bash
git add lib/services/helper.service.ts
git commit -m "feat: add Drive export scope and exportSpreadsheetAsZip helper"
```

---

## Task 4: Photo Import Service

**Files:**
- Create: `lib/services/photo-import.service.ts`

**How the ZIP parsing works:**

Google Sheets HTML ZIP export contains:
- One HTML file per visible sheet tab (naming varies by spreadsheet title/tab name)
- An `images/` directory with PNG files referenced by the HTML (`<img src="images/image1.png">`)

Rather than relying on column position (fragile due to merged cells or hidden cols), we identify rows by UUID: any `<td>` containing a UUID-format string (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) is col Y. Any `<td>` containing an `<img src="images/...">` is col B. Both in the same `<tr>` = a match.

- [ ] **Step 1: Create the file**

Create `lib/services/photo-import.service.ts`:

```ts
import JSZip from "jszip";
import { parse as parseHtml } from "node-html-parser";
import { eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { cats } from "@/lib/db/schema";
import { connectToSheets, exportSpreadsheetAsZip } from "./helper.service";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "cat-photos";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parses all <tr> elements in an HTML string for UUID→imageSrc pairs.
 * Identifies col Y by UUID pattern, col B by <img src="images/...">.
 * Position-independent — not brittle to merged cells or col order.
 */
function parsePhotoMappingsFromHtml(
  html: string,
): Array<{ uuid: string; imageSrc: string }> {
  const root = parseHtml(html);
  const rows = root.querySelectorAll("tr");
  const results: Array<{ uuid: string; imageSrc: string }> = [];

  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    let uuid: string | null = null;
    let imageSrc: string | null = null;

    for (const cell of cells) {
      const text = cell.text.trim();
      if (UUID_REGEX.test(text)) {
        uuid = text;
      }
      const img = cell.querySelector("img");
      if (img) {
        const src = img.getAttribute("src");
        if (src?.startsWith("images/")) {
          imageSrc = src;
        }
      }
    }

    if (uuid && imageSrc) {
      results.push({ uuid, imageSrc });
    }
  }

  return results;
}

/**
 * Walks all HTML files in the ZIP and builds a uuid → image Buffer map.
 * Processes every sheet tab so we don't need to find the right HTML file.
 */
async function buildPhotoMap(
  zip: JSZip,
): Promise<Map<string, { buffer: Buffer; ext: string }>> {
  const map = new Map<string, { buffer: Buffer; ext: string }>();

  const htmlFileNames = Object.keys(zip.files).filter((name) =>
    name.toLowerCase().endsWith(".html"),
  );

  for (const htmlFileName of htmlFileNames) {
    const html = await zip.files[htmlFileName].async("text");
    const pairs = parsePhotoMappingsFromHtml(html);

    for (const { uuid, imageSrc } of pairs) {
      if (map.has(uuid)) continue; // first match wins
      const imageFile = zip.files[imageSrc];
      if (!imageFile) continue;
      const buffer = await imageFile.async("nodebuffer");
      const ext = imageSrc.split(".").pop() ?? "png";
      map.set(uuid, { buffer, ext });
    }
  }

  return map;
}

export interface PhotoImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ catId: string; error: string }>;
}

/**
 * Runs photo import across all regions (uses single ZIP export shared across all).
 * Call this for initial bulk import and for the daily photo sync cron.
 */
export async function importPhotosForAllRegions(): Promise<{
  totalImported: number;
  totalSkipped: number;
  totalErrors: number;
}> {
  // Photo map is global (all sheets), so one call covers all regions.
  // We reuse importPhotosForRegion with a sentinel "all" approach by
  // calling the internal logic directly once instead of per-region.

  const allNullPhotoCats = await db
    .select({ id: cats.id })
    .from(cats)
    .where(isNull(cats.photo_url));

  if (allNullPhotoCats.length === 0) {
    return { totalImported: 0, totalSkipped: 0, totalErrors: 0 };
  }

  const targetIds = new Set(allNullPhotoCats.map((c) => c.id));

  const { glAuth } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;

  const zipBuffer = await exportSpreadsheetAsZip(spreadsheetId, glAuth);
  const zip = await JSZip.loadAsync(zipBuffer);
  const photoMap = await buildPhotoMap(zip);

  const supabase = await createAdminClient();

  let totalImported = 0;
  let totalSkipped = 0;
  const errors: Array<{ catId: string; error: string }> = [];

  for (const [uuid, { buffer, ext }] of photoMap.entries()) {
    if (!targetIds.has(uuid)) {
      totalSkipped++;
      continue;
    }

    try {
      const storagePath = `${uuid}/photo.${ext}`;
      const contentType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType, upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

      await db
        .update(cats)
        .set({ photo_url: publicUrl, last_updated_at: new Date() })
        .where(eq(cats.id, uuid));

      totalImported++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      errors.push({ catId: uuid, error: msg });
    }
  }

  console.log(
    `[PhotoImport] imported=${totalImported} skipped=${totalSkipped} errors=${errors.length}`,
    errors.length > 0 ? errors.slice(0, 5) : "",
  );

  return { totalImported, totalSkipped, totalErrors: errors.length };
}
```

> **Note:** `importPhotosForRegion` is kept for future per-region use but the initial import should call `importPhotosForAllRegions` — one ZIP export covers every tab.

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

Fix any type errors before continuing. Common issues:
- `isNull` import from `drizzle-orm` (already imported in the file)
- `JSZip.loadAsync` — method is on the instance, not the class. `JSZip` is default-exported as a class; `new JSZip()` is not needed for `loadAsync` since it's a static method: `JSZip.loadAsync(zipBuffer)` ✓

- [ ] **Step 3: Commit**

```bash
git add lib/services/photo-import.service.ts
git commit -m "feat: photo import service — ZIP export + Supabase upload"
```

---

## Task 5: Cron Route

**Files:**
- Create: `app/api/cron/photo-import/route.ts`

Same auth pattern as the existing `app/api/cron/sync/route.ts`.

- [ ] **Step 1: Create the route**

```ts
import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { importPhotosForAllRegions } from "@/lib/services/photo-import.service";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  after(async () => {
    try {
      const result = await importPhotosForAllRegions();
      console.log("[Cron PhotoImport]", result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[Cron PhotoImport] Failed:", message);
    }
  });

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
```

- [ ] **Step 2: Type-check + build**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/photo-import/route.ts
git commit -m "feat: cron route for photo import"
```

---

## Task 6: vercel.json — Cron Schedule

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create vercel.json**

This schedules the photo import daily at 3 AM UTC (low-traffic, after the normal sync crons):

```json
{
  "crons": [
    {
      "path": "/api/cron/photo-import",
      "schedule": "0 3 * * *"
    }
  ]
}
```

> If you already manage the sync cron elsewhere (e.g. Vercel dashboard), add the photo-import entry to the same place instead, and skip this file.

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "chore: add daily photo import cron schedule"
```

---

## Task 7: Manual Setup — Supabase Bucket

This must be done before the first cron run. Do it in Supabase dashboard or via SQL.

- [ ] **Step 1: Create the bucket**

In Supabase dashboard → Storage → New bucket:
- Name: `cat-photos`
- Public: **Yes** (the URL is used in `=IMAGE()` in GSheets and displayed in the app — must be publicly accessible without a signed URL)

OR via Supabase SQL editor:

```sql
insert into storage.buckets (id, name, public)
values ('cat-photos', 'cat-photos', true)
on conflict (id) do nothing;
```

- [ ] **Step 2: Confirm public URL format**

After uploading one test image manually, verify the public URL pattern:
```
https://<project-ref>.supabase.co/storage/v1/object/public/cat-photos/<uuid>/photo.png
```

This should be directly accessible in a browser tab without any auth headers.

---

## Task 8: Initial Bulk Import — Manual Trigger

After deploying, trigger the import once to backfill all cats that currently have `photo_url IS NULL`.

- [ ] **Step 1: Deploy to production**

Push the branch and confirm deployment completes.

- [ ] **Step 2: Trigger the cron manually**

```bash
curl -X POST https://<your-domain>/api/cron/photo-import \
  -H "Authorization: Bearer $CRON_SECRET"
```

- [ ] **Step 3: Verify in DB**

Run in Supabase SQL editor:

```sql
select id, name, photo_url
from cats
where photo_url is not null
  and photo_url like '%supabase%'
limit 20;
```

Expected: rows with `photo_url` pointing to `cat-photos` bucket.

- [ ] **Step 4: Verify in GSheet (forward sync)**

After the DB update, the next forward sync will write `=IMAGE("supabase_url")` into col B — replacing the invisible pasted image with a stable formula. Confirm one row updates correctly in the sheet.

---

## Known Risks / Decisions

| Risk | Mitigation |
|---|---|
| Google ZIP structure varies by spreadsheet title | `buildPhotoMap` parses ALL `.html` files in the ZIP — no name matching needed |
| Col Y might be hidden in the HTML export | UUID regex scan is position-independent; if col Y is hidden the row is simply skipped and stays `photo_url = null` |
| Large spreadsheet → slow ZIP export | One export covers all regions; runs in `after()` so it doesn't block the HTTP response |
| Forward sync overwrites pasted images with formula | ✓ Intended — after import, col B becomes a stable `=IMAGE(supabase_url)` formula which Values API CAN read going forward |
| Service account needs Drive API access | `drive.readonly` scope added in Task 3; service account already has file access via Sheets sharing |
