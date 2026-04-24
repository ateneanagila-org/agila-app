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
  clearSheetEditTimestamps,
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
        // ZIP uses relative paths (e.g. resources/ or images/) — exclude absolute URLs
        if (src && !src.startsWith("http")) imageSrc = src;
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
  // Track region per UUID so we can clear timestamps after import.
  // =IMAGE() formulas return "" from the Values API, so without clearing,
  // every cycle re-detects the same cats and re-uploads identical photos.
  const uuidToRegion = new Map<string, string>();

  for (const region of allRegions) {
    const rows = await readSheetState(region.id);
    for (const row of rows) {
      if (row.lastEditedAt && (row.raw[1] ?? "").trim() === "") {
        candidateUuids.add(row.entityId);
        uuidToRegion.set(row.entityId, region.id);
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
  const entries = [...photoMap.entries()];
  const { imported, errors } = await processBatch(entries, supabase);

  // Clear edit timestamps for successfully imported cats so the next cycle
  // doesn't re-detect them. API writes don't trigger Apps Script onEdit,
  // so col W would never be cleared otherwise.
  const erroredIds = new Set(errors.map((e) => e.catId));
  const importedByRegion = new Map<string, string[]>();
  for (const [uuid] of entries) {
    if (erroredIds.has(uuid)) continue;
    const regionId = uuidToRegion.get(uuid);
    if (!regionId) continue;
    if (!importedByRegion.has(regionId)) importedByRegion.set(regionId, []);
    importedByRegion.get(regionId)!.push(uuid);
  }
  for (const [regionId, uuids] of importedByRegion) {
    try {
      await clearSheetEditTimestamps(regionId, uuids);
    } catch (err) {
      console.error(
        `[PhotoImport] Failed to clear timestamps for region ${regionId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

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
