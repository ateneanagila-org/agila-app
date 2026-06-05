import JSZip from "jszip";
import sharp from "sharp";
import { eq, isNull } from "drizzle-orm";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { cats } from "@/lib/db/schema";
import {
  connectToSheets,
  readSheetState,
  refreshCatInSyncQueue,
  clearSheetEditTimestamps,
  type SheetRow,
} from "./helper.service";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "cat-photos";

// ==========================================
// XLSX PARSING
// ==========================================
//
// We export the spreadsheet as xlsx (~300 MB) and parse it as a ZIP.
// Why xlsx: Google's `format=zip` ignores `gid` and truncates the full
// HTML-ZIP at ~84 MB, dropping most sheets. xlsx is not size-capped and
// embeds every image regardless of sheet count.
//
// xlsx layout (relevant subset):
//   xl/workbook.xml                       — sheet name → rId
//   xl/_rels/workbook.xml.rels            — rId → worksheets/sheetN.xml
//   xl/sharedStrings.xml                  — text values, indexed by order
//   xl/worksheets/sheetN.xml              — cells; <c t="s"><v>idx</v></c>
//   xl/worksheets/_rels/sheetN.xml.rels   — sheet rId → drawings/drawingM.xml
//   xl/drawings/drawingM.xml              — image anchors (col, row → rId)
//   xl/drawings/_rels/drawingM.xml.rels   — image rId → media/imageK.ext
//   xl/media/imageK.ext                   — actual bytes
// ==========================================

async function downloadXlsx(
  glAuth: InstanceType<typeof google.auth.GoogleAuth>,
  spreadsheetId: string,
): Promise<Buffer> {
  const token = await glAuth.getAccessToken();
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) {
    throw new Error(`xlsx export failed ${res.status}: ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Parses sharedStrings.xml into an ordered array. Each <si> is one entry;
 * inline <r> rich-text is flattened by concatenating all <t> children.
 */
function parseSharedStrings(xml: string): string[] {
  const result: string[] = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRegex.exec(xml)) !== null) {
    const inner = m[1];
    let combined = "";
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tRegex.exec(inner)) !== null) {
      combined += decodeXmlEntities(tm[1]);
    }
    result.push(combined);
  }
  return result;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Map sheet display name → r:id in workbook.xml (attribute-order-independent) */
function parseWorkbookSheets(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  const sheetTagRe = /<sheet\b[^/]*\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = sheetTagRe.exec(xml)) !== null) {
    const tag = m[0];
    const nameMatch = tag.match(/\bname="([^"]*)"/);
    const ridMatch = tag.match(/\br:id="([^"]*)"/);
    if (nameMatch && ridMatch) {
      map.set(decodeXmlEntities(nameMatch[1]), ridMatch[1]);
    }
  }
  return map;
}

/** Map relationship Id → target path */
function parseRels(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    map.set(m[1], m[2]);
  }
  return map;
}

/**
 * From a worksheet XML, extract UUIDs in column Y per row.
 * Returns Map<rowNumber1Based, uuid>.
 */
function parseSheetUuidColumnY(xml: string, sharedStrings: string[]): Map<number, string> {
  const result = new Map<number, string>();
  // Match cells in col Y: <c r="Y{row}" ...>...</c>
  const cellRegex = /<c\b[^>]*\br="Y(\d+)"([^>]*)>([\s\S]*?)<\/c>/g;
  let m: RegExpExecArray | null;
  while ((m = cellRegex.exec(xml)) !== null) {
    const row = parseInt(m[1], 10);
    const attrs = m[2];
    const inner = m[3];

    let value = "";
    const typeMatch = attrs.match(/\bt="([^"]+)"/);
    const cellType = typeMatch?.[1];

    if (cellType === "s") {
      // Shared string reference
      const vMatch = inner.match(/<v>([^<]+)<\/v>/);
      if (vMatch) {
        const idx = parseInt(vMatch[1], 10);
        value = sharedStrings[idx] ?? "";
      }
    } else if (cellType === "inlineStr") {
      const tMatch = inner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
      if (tMatch) value = decodeXmlEntities(tMatch[1]);
    } else {
      // Numeric or empty — UUIDs aren't stored this way, skip
      const vMatch = inner.match(/<v>([^<]+)<\/v>/);
      if (vMatch) value = vMatch[1];
    }

    const trimmed = value.trim();
    if (trimmed) result.set(row, trimmed);
  }
  return result;
}

/**
 * From a drawing XML, find images anchored at col B (col index 1).
 * Returns Map<rowNumber1Based, embedRId>.
 *
 * Both <xdr:oneCellAnchor> and <xdr:twoCellAnchor> are handled. For two-cell,
 * we use the from/start cell as the row anchor.
 */
function parseDrawingImagesAtColB(xml: string): Map<number, string> {
  const result = new Map<number, string>();
  const anchorRegex = /<xdr:(one|two)CellAnchor\b[^>]*>([\s\S]*?)<\/xdr:(one|two)CellAnchor>/g;
  let m: RegExpExecArray | null;
  while ((m = anchorRegex.exec(xml)) !== null) {
    const inner = m[2];

    const fromMatch = inner.match(/<xdr:from>([\s\S]*?)<\/xdr:from>/);
    if (!fromMatch) continue;
    const fromInner = fromMatch[1];

    const colMatch = fromInner.match(/<xdr:col>(\d+)<\/xdr:col>/);
    const rowMatch = fromInner.match(/<xdr:row>(\d+)<\/xdr:row>/);
    if (!colMatch || !rowMatch) continue;

    const col0 = parseInt(colMatch[1], 10);
    if (col0 !== 1) continue; // col B = index 1

    const row1 = parseInt(rowMatch[1], 10) + 1; // 0-based → 1-based

    const embedMatch = inner.match(/r:embed="([^"]+)"/);
    if (!embedMatch) continue;

    result.set(row1, embedMatch[1]);
  }
  return result;
}

/** Resolves "../media/imageX.jpg" relative to "xl/drawings/drawingY.xml" → "xl/media/imageX.jpg" */
function resolveRelativePath(basePath: string, relative: string): string {
  const baseParts = basePath.split("/");
  baseParts.pop(); // drop file
  const relParts = relative.split("/");
  for (const p of relParts) {
    if (p === "..") baseParts.pop();
    else if (p !== ".") baseParts.push(p);
  }
  return baseParts.join("/");
}

async function fetchPhotosFromXlsx(
  candidateUuids: Set<string>,
  regionNamesToScan: string[],
): Promise<Map<string, Buffer>> {
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;
  const { glAuth } = await connectToSheets();
  const result = new Map<string, Buffer>();

  console.log(`[PhotoImport] Downloading xlsx export...`);
  const xlsxBuf = await downloadXlsx(glAuth, spreadsheetId);
  console.log(`[PhotoImport] xlsx downloaded: ${(xlsxBuf.length / 1_048_576).toFixed(1)} MB`);

  const zip = await JSZip.loadAsync(xlsxBuf);

  const sharedStringsXml = await zip.files["xl/sharedStrings.xml"]?.async("text") ?? "";
  const sharedStrings = parseSharedStrings(sharedStringsXml);

  const workbookXml = await zip.files["xl/workbook.xml"].async("text");
  const sheetNameToRId = parseWorkbookSheets(workbookXml);

  const workbookRelsXml = await zip.files["xl/_rels/workbook.xml.rels"].async("text");
  const workbookRels = parseRels(workbookRelsXml); // rId → "worksheets/sheetN.xml"

  // Normalized name lookup: strip non-alphanumeric chars for fuzzy matching
  // (e.g. DB has "CTC/SOM", xlsx exports as "CTCSOM")
  const normalize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const normalizedSheetMap = new Map<string, string>();
  for (const [name, rId] of sheetNameToRId) {
    normalizedSheetMap.set(normalize(name), rId);
  }

  for (const regionName of regionNamesToScan) {
    if (result.size >= candidateUuids.size) break;

    const rId = sheetNameToRId.get(regionName) ?? normalizedSheetMap.get(normalize(regionName));
    if (!rId) {
      console.warn(`[PhotoImport] No sheet found for region "${regionName}" — skipping`);
      continue;
    }
    const sheetTarget = workbookRels.get(rId);
    if (!sheetTarget) continue;

    const sheetPath = `xl/${sheetTarget.replace(/^\//, "")}`;
    const sheetEntry = zip.files[sheetPath];
    if (!sheetEntry) continue;

    const sheetXml = await sheetEntry.async("text");
    const rowToUuid = parseSheetUuidColumnY(sheetXml, sharedStrings);

    // Build reverse: uuid → row, but only for our candidates
    const candidateRowToUuid = new Map<number, string>();
    for (const [row, uuid] of rowToUuid) {
      if (candidateUuids.has(uuid) && !result.has(uuid)) {
        candidateRowToUuid.set(row, uuid);
      }
    }
    if (candidateRowToUuid.size === 0) continue;

    // Locate this sheet's drawing
    const sheetRelsPath = sheetPath.replace("/worksheets/", "/worksheets/_rels/") + ".rels";
    const sheetRelsEntry = zip.files[sheetRelsPath];
    if (!sheetRelsEntry) continue;

    const sheetRelsXml = await sheetRelsEntry.async("text");
    const sheetRels = parseRels(sheetRelsXml);
    let drawingTarget: string | undefined;
    // Drawing rel uses Type=".../drawing"; we identify by Target prefix
    for (const target of sheetRels.values()) {
      if (target.includes("/drawings/")) {
        drawingTarget = target;
        break;
      }
    }
    if (!drawingTarget) continue;

    const drawingPath = resolveRelativePath(sheetPath, drawingTarget);
    const drawingEntry = zip.files[drawingPath];
    if (!drawingEntry) continue;

    const drawingXml = await drawingEntry.async("text");
    const rowToEmbed = parseDrawingImagesAtColB(drawingXml);

    const drawingRelsPath = drawingPath.replace("/drawings/", "/drawings/_rels/") + ".rels";
    const drawingRelsXml = await zip.files[drawingRelsPath]?.async("text") ?? "";
    const drawingRels = parseRels(drawingRelsXml); // rId → "../media/imageX.ext"

    for (const [row, uuid] of candidateRowToUuid) {
      const embedRId = rowToEmbed.get(row);
      if (!embedRId) continue;

      const mediaTarget = drawingRels.get(embedRId);
      if (!mediaTarget) continue;

      const mediaPath = resolveRelativePath(drawingPath, mediaTarget);
      const mediaEntry = zip.files[mediaPath];
      if (!mediaEntry || mediaEntry.dir) continue;

      const buf = Buffer.from(await mediaEntry.async("arraybuffer"));
      result.set(uuid, buf);
    }
  }

  return result;
}

// ==========================================
// COMPRESSION + UPLOAD
// ==========================================

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
      .set({ photo_url: publicUrl })
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

// ==========================================
// PUBLIC API
// ==========================================

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
 * Only fires the xlsx export when candidates exist.
 *
 * Known limitation: cats whose pasted photo predates the lastEditedAt
 * tracking system require the bulk script (scripts/import-photos.ts).
 */
export async function importPhotosIfNeeded(
  allRegions: { id: string; name: string }[],
  sheetStates?: Map<string, SheetRow[]>,
): Promise<PhotoImportResult> {
  const candidateUuids = new Set<string>();
  const uuidToRegion = new Map<string, string>();
  const uuidToRowIndex = new Map<string, number>();
  const uuidToExpectedTimestamp = new Map<string, string | null>();

  for (const region of allRegions) {
    const rows = sheetStates?.get(region.id) ?? (await readSheetState(region.id));
    for (const row of rows) {
      if (row.lastEditedAt && (row.raw[1] ?? "").trim() === "") {
        candidateUuids.add(row.entityId);
        uuidToRegion.set(row.entityId, region.id);
        uuidToRowIndex.set(row.entityId, row.rowIndex);
        uuidToExpectedTimestamp.set(row.entityId, row.lastEditedAt);
      }
    }
  }

  if (candidateUuids.size === 0) {
    return { triggered: false, imported: 0, errors: [] };
  }

  const regionIdToName = new Map(allRegions.map((r) => [r.id, r.name]));
  const regionNamesWithCandidates = new Set<string>();
  for (const regionId of uuidToRegion.values()) {
    const name = regionIdToName.get(regionId);
    if (name) regionNamesWithCandidates.add(name);
  }
  const regionNamesToScan = allRegions
    .map((r) => r.name)
    .filter((n) => regionNamesWithCandidates.has(n));

  const photoMap = await fetchPhotosFromXlsx(candidateUuids, regionNamesToScan);

  if (photoMap.size === 0) {
    return { triggered: true, imported: 0, errors: [] };
  }

  const supabase = await createAdminClient();
  const entries = [...photoMap.entries()];
  const { imported, errors } = await processBatch(entries, supabase);

  // Clear edit timestamps for successfully imported cats so the next cycle
  // doesn't re-detect them.
  const erroredIds = new Set(errors.map((e) => e.catId));
  const importedByRegion = new Map<
    string,
    Array<{ entityId: string; rowIndex: number; expectedTimestamp: string | null }>
  >();
  for (const [uuid] of entries) {
    if (erroredIds.has(uuid)) continue;
    const regionId = uuidToRegion.get(uuid);
    if (!regionId) continue;
    const rowIndex = uuidToRowIndex.get(uuid);
    if (rowIndex === undefined) continue;
    const expectedTimestamp = uuidToExpectedTimestamp.get(uuid) ?? null;
    if (!importedByRegion.has(regionId)) importedByRegion.set(regionId, []);
    importedByRegion.get(regionId)!.push({ entityId: uuid, rowIndex, expectedTimestamp });
  }
  for (const [regionId, positional] of importedByRegion) {
    try {
      await clearSheetEditTimestamps(regionId, positional);
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
 * Deletes EVERY object in the cat-photos bucket. ONE-TIME CUTOVER USE ONLY —
 * called by reset-and-reimport before re-importing. When the sheet is re-seeded
 * with fresh col-Y UUIDs, every photo path (`${uuid}/photo.jpg`) is re-keyed, so
 * the prior objects are orphaned (upsert only overwrites the SAME path, never the
 * old one). Photos are sourced from the sheet xlsx, so wiping is safe —
 * bulkImportAllNullPhotos rebuilds the whole set from the sheet afterward.
 *
 * Files live one level deep under per-UUID prefixes, so this lists the root
 * prefixes, then lists + removes each prefix's objects in batches. Returns the
 * number of objects removed.
 */
export async function wipeAllPhotos(): Promise<{ removed: number }> {
  const supabase = await createAdminClient();
  const LIST_LIMIT = 100_000;
  const REMOVE_BATCH = 1000;

  const { data: prefixes, error: listErr } = await supabase.storage
    .from(BUCKET)
    .list("", { limit: LIST_LIMIT });
  if (listErr) throw new Error(`bucket list failed: ${listErr.message}`);
  if (!prefixes || prefixes.length === 0) return { removed: 0 };

  const paths: string[] = [];
  for (const prefix of prefixes) {
    const { data: files, error: subErr } = await supabase.storage
      .from(BUCKET)
      .list(prefix.name, { limit: LIST_LIMIT });
    if (subErr) throw new Error(`list '${prefix.name}' failed: ${subErr.message}`);
    for (const f of files ?? []) paths.push(`${prefix.name}/${f.name}`);
  }

  let removed = 0;
  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const slice = paths.slice(i, i + REMOVE_BATCH);
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(slice);
    if (rmErr) throw new Error(`remove batch failed: ${rmErr.message}`);
    removed += slice.length;
  }

  return { removed };
}

/**
 * Bulk import for the local script only. Targets all cats with photo_url IS NULL
 * regardless of sheet edit state — covers cats whose pasted photos predate
 * the lastEditedAt tracking system.
 *
 * Not called by the sync cycle. Run via: pnpm tsx scripts/import-photos.ts
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
  console.log(`[BulkImport] Fetching photos for ${targetIds.size} cats via xlsx...`);

  const allRegions = await db.query.regions.findMany();
  const regionNamesToScan = allRegions.map((r) => r.name);
  const photoMap = await fetchPhotosFromXlsx(targetIds, regionNamesToScan);

  if (photoMap.size === 0) {
    console.log("[BulkImport] No images found for null-photo cats.");
    return { imported: 0, errors: [] };
  }

  const supabase = await createAdminClient();
  const { imported, errors } = await processBatch([...photoMap.entries()], supabase);

  console.log(
    `[BulkImport] targets=${targetIds.size} found=${photoMap.size} imported=${imported} errors=${errors.length}`,
  );

  return { imported, errors };
}
