import { google } from "googleapis";
import {
  wrapSheetsClient,
  type WrappedSheetsClient,
} from "./sheets-client.service";
import { eq, inArray } from "drizzle-orm";
import { db, Transaction } from "@/lib/db";
import {
  gsheetSyncQueue,
  regions,
  syncAuditLog,
  sessions,
  sessionCats,
} from "@/lib/db/schema";
import * as sessionsRepo from "@/lib/repo/sessions.repo";
import * as catsRepo from "@/lib/repo/cats.repo";
import * as regionsRepo from "@/lib/repo/regions.repo";
import { isSyncFrozen } from "./system.service";
import { statusSuffix, nextCatalogId, parseCatalogId, catalogDisplay } from "./catalog.service";
import { SelectCat, SelectCatHealthRecord } from "@/lib/validation/cats";
import { SelectIntervention } from "@/lib/validation/interventions";

const MAX_RETRIES = 3;

// ==========================================
// 1. AUTHENTICATION
// ==========================================

export async function connectToSheets(): Promise<{
  glAuth: InstanceType<typeof google.auth.GoogleAuth>;
  glSheets: WrappedSheetsClient;
}> {
  const serviceAccountCredentials = JSON.parse(
    process.env.SERVICE_ACCOUNT_CREDENTIALS!,
  );
  const privateKey = serviceAccountCredentials.private_key.replace(
    /\\n/g,
    "\n",
  );

  const glAuth = new google.auth.GoogleAuth({
    credentials: { ...serviceAccountCredentials, private_key: privateKey },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });

  const raw = google.sheets({ version: "v4", auth: glAuth });
  return { glAuth, glSheets: wrapSheetsClient(raw) };
}

/**
 * Exports the spreadsheet as an HTML ZIP via direct download URL.
 * More reliable than Drive API files.export for service accounts.
 * ZIP contains one HTML file per sheet tab + an images/ directory.
 * Image bytes in the HTML reference images/imageN.png by filename.
 * Google resamples pasted images to cell display size on export —
 * output images are already reduced from their original resolution.
 */
export async function exportSpreadsheetAsZip(
  spreadsheetId: string,
  glAuth: InstanceType<typeof google.auth.GoogleAuth>,
): Promise<Buffer> {
  const token = await glAuth.getAccessToken();
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=zip`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(
      `ZIP export failed: ${response.status} ${response.statusText}`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

// ==========================================
// 2. DATA MAPPING (DB -> Spreadsheet Row)
// ==========================================

/**
 * Helper to calculate "Human Readable" status for Columns S and T
 */
function getInterventionDisplayStatus(
  cat: SelectCat,
  allInterventions: SelectIntervention[],
  targetType: "TNVR" | "Veterinarian",
): string {
  if (["Adopted", "Deceased", "MIA"].includes(cat.cat_status ?? "")) {
    return "Not Applicable";
  }

  // 1. Filter the list for the specific type (TNVR or Vet)
  const filtered = allInterventions.filter((i) => i.type === targetType);
  if (filtered.length === 0) return "Will not have intervention";

  // 2. PRIORITY 1: Is there a PENDING one?
  // (Since we sorted by date in the DB, this finds the newest Pending one)
  const pending = filtered.find((i) => i.status === "Pending");
  if (pending) {
    const typeLabel = targetType === "TNVR" ? "TNVR" : "Vet";
    return `Will have ${typeLabel} intervention`;
  }

  // 3. PRIORITY 2: Is there a FINISHED one?
  // (This finds the newest Finished one)
  const finished = filtered.find((i) => i.status === "Finished");
  if (finished) {
    const typeLabel = targetType === "TNVR" ? "TNVR" : "Vet";
    return `Had ${typeLabel} intervention`;
  }

  // 4. DEFAULT: Fallback if everything is Cancelled or Unknown
  return "Will not have intervention";
}
/**
 * Maps DB records to a 22-element array (cols A–V, indices 0–21).
 * Col A = catalog number + status suffix (provided by caller; sheet is source of truth).
 * UUID is written to col Y separately.
 */
export function mapCatToSheetRow(
  cat: SelectCat,
  health: SelectCatHealthRecord | null,
  interventions: SelectIntervention[] = [],
  catalogDisplay = "",
): string[] {
  const condition = (health?.condition ?? "") as string;
  const catStatus = (cat.cat_status ?? "") as string;

  let forFaStatus = "Not Ready for FA";
  if (["Adopted", "Deceased", "MIA"].includes(catStatus)) {
    forFaStatus = "Not Applicable";
  } else if (cat.is_adoptable) {
    if (condition.includes("Sick")) forFaStatus = "Sick & Adoptable";
    else if (condition.includes("Injured")) forFaStatus = "Injured & Adoptable";
    else forFaStatus = "Healthy & Adoptable";
  }

  return [
    catalogDisplay, // 0  (A) Catalog ID
    cat.photo_url ? `=IMAGE("${cat.photo_url.replace(/"/g, "")}")` : "", // 1  (B)
    cat.name ?? "N/A", // 2  (C)
    cat.color ?? "", // 3  (D)
    cat.age ?? "", // 4  (E)
    cat.sex ?? "???", // 5  (F)
    health?.neuter_date ? "YES" : "NO", // 6  (G)
    cat.sociability ?? "???", // 7  (H)
    condition ? (condition.includes("Sick") ? "YES" : "NO") : "???", // 8  (I)
    condition ? (condition.includes("Injured") ? "YES" : "NO") : "???", // 9  (J)
    cat.is_adoptable ? "YES" : "NO", // 10 (K)
    catStatus || "None of the above", // 11 (L)
    cat.caretaker ?? "N/A", // 12 (M)
    new Date().toLocaleDateString("en-US"), // 13 (N)
    cat.spot_last_seen ?? "N/A", // 14 (O)
    health?.neuter_date?.toLocaleDateString("en-US") ?? "N/A", // 15 (P)
    health?.vaccination_date?.toLocaleDateString("en-US") ?? "N/A", // 16 (Q)
    cat.notes ?? "N/A", // 17 (R)
    "", // 18 (S) separator
    getInterventionDisplayStatus(cat, interventions, "TNVR"), // 19 (T)
    getInterventionDisplayStatus(cat, interventions, "Veterinarian"), // 20 (U)
    forFaStatus, // 21 (V)
  ];
}

/**
 * Maps DB records to a 22-element array for the UNKNOWN region sheet.
 * Col layout: A=CatalogID, B=PossibleLoc, C=PawsId, D=Color, E=Age,
 * F=Sex, G=Neutered, H=Tame, I=Sick, J=Injured, K=Adoptable,
 * L=DateOfKapon, M=DateOfVaccination, N–V=empty.
 * UUID is written to col Y separately.
 */
export function mapUnknownCatToSheetRow(
  cat: SelectCat,
  health: SelectCatHealthRecord | null,
  catalogDisplay = "",
): string[] {
  const condition = (health?.condition ?? "") as string;

  return [
    catalogDisplay, // 0  (A)
    cat.spot_last_seen ?? "N/A", // 1  (B) Possible Loc
    cat.paws_id ?? "", // 2  (C) PAWS ID#
    cat.color ?? "", // 3  (D)
    cat.age ?? "", // 4  (E)
    cat.sex ?? "???", // 5  (F)
    health?.neuter_date ? "YES" : "NO", // 6  (G)
    cat.sociability ?? "???", // 7  (H)
    condition ? (condition.includes("Sick") ? "YES" : "NO") : "???", // 8  (I)
    condition ? (condition.includes("Injured") ? "YES" : "NO") : "???", // 9  (J)
    cat.is_adoptable ? "YES" : "NO", // 10 (K)
    health?.neuter_date?.toLocaleDateString("en-US") ?? "N/A", // 11 (L)
    health?.vaccination_date?.toLocaleDateString("en-US") ?? "N/A", // 12 (M)
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "", // 13–21 (N–V) empty
  ];
}

// ==========================================
// 3. DATABASE SIDE (Queueing Updates)
// ==========================================

/**
 * Fetches the current state of a cat and queues it in gsheetSyncQueue.
 * Used inside transactions in your services.
 */
export async function refreshCatInSyncQueue(catId: string, tx: Transaction) {
  const cat = await tx.query.cats.findFirst({
    where: (cols, { eq }) => eq(cols.id, catId),
    with: {
      catHealthRecords: true,
      // Ensure we get the latest records at the top of the list
      interventions: {
        orderBy: (cols, { desc }) => [desc(cols.requested_at)],
      },
    },
  });

  if (!cat) return;

  const region = await sessionsRepo.findCatRegionByLatestSession(catId, tx);
  if (!region) return;

  // catalogDisplay defaults to "" — safe because syncAndCompactRegion's UPDATE
  // branch reads col A from the existing sheet row and recomputes the suffix,
  // so the payload value is never written verbatim for updates.
  const rowData =
    region.name === "UNKNOWN"
      ? mapUnknownCatToSheetRow(cat, cat.catHealthRecords)
      : mapCatToSheetRow(cat, cat.catHealthRecords, cat.interventions);

  await tx.insert(gsheetSyncQueue).values({
    action: "UPDATE",
    entityId: catId,
    regionId: region.id,
    payload: rowData,
  });
}

// ==========================================
// 4. WORKER SIDE (Executing Sync)
// ==========================================

/**
 * Runs the background sync for a specific region.
 * Uses the "Read-Modify-Write" strategy to ensure data integrity.
 * Includes retry logic, audit logging, and freeze checking.
 *
 * Reads A3:Y (col Y = UUID at index 24). Matches rows by UUID (col Y).
 * Writes data to A3:V, then UUIDs separately to Y3:Y.
 */
export async function syncAndCompactRegion(regionId: string) {
  const frozen = await isSyncFrozen();
  if (frozen) {
    console.log(`[Sync] Frozen — skipping region ${regionId}`);
    return;
  }

  const startedAt = new Date();
  let tasksProcessed = 0;
  let tasksFailed = 0;
  let errorMessage: string | null = null;

  const region = await db.query.regions.findFirst({
    where: eq(regions.id, regionId),
  });
  if (!region) return;

  const tasks = await db.query.gsheetSyncQueue.findMany({
    where: (q, { and, eq, lt }) =>
      and(
        eq(q.regionId, regionId),
        eq(q.status, "PENDING"),
        lt(q.retryCount, MAX_RETRIES),
      ),
    orderBy: (q, { asc }) => [asc(q.createdAt)],
  });

  if (tasks.length === 0) return;

  try {
    const { glAuth, glSheets } = await connectToSheets();
    const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;

    // 1. READ current sheet state A3:Y (col Y = UUID at index 24)
    const response = await glSheets.spreadsheets.values.get({
      auth: glAuth,
      spreadsheetId,
      range: `'${region.name}'!A3:Y`,
    });
    const currentRows: string[][] = (response.data.values || []).map(
      (r) => r as string[],
    );

    // 2. MODIFY: process tasks, matching rows by col Y (UUID)
    for (const task of tasks) {
      const idx = currentRows.findIndex((r) => r[24] === task.entityId);
      const taskPayload = (task.payload ?? []) as string[];

      if (task.action === "DELETE") {
        if (idx !== -1) currentRows.splice(idx, 1);
      } else {
        if (idx === -1) {
          // New cat — assign catalog number from sheet (not stored in DB)
          const cat = await db.query.cats.findFirst({
            where: (c, { eq }) => eq(c.id, task.entityId),
          });
          if (!cat) continue;
          const colAValues = currentRows.map((r) => r[0] ?? "");
          const num = nextCatalogId(colAValues);
          const catalogDisplay = `${num}${statusSuffix(cat.cat_status)}`;
          const health = await db.query.catHealthRecords.findFirst({
            where: (h, { eq }) => eq(h.cat_id, cat.id),
          });
          const interventionsList = await db.query.interventions.findMany({
            where: (i, { eq }) => eq(i.cat_id, cat.id),
            orderBy: (i, { desc }) => [desc(i.requested_at)],
          });
          const newPayload =
            region.name === "UNKNOWN"
              ? mapUnknownCatToSheetRow(cat, health ?? null, catalogDisplay)
              : mapCatToSheetRow(cat, health ?? null, interventionsList, catalogDisplay);
          currentRows.push([...newPayload, "", "", task.entityId]); // pad cols W, X, then Y
        } else {
          // Update existing row — recompute col A to keep the number but refresh the status suffix
          const existingNum = parseCatalogId(currentRows[idx][0] ?? "");
          const updatedRow = [...taskPayload];
          if (existingNum !== null && region.name !== "UNKNOWN") {
            // col L (index 11) = cat_status in standard rows
            updatedRow[0] = `${existingNum}${statusSuffix(taskPayload[11])}`;
          } else {
            // UNKNOWN cats: preserve col A as-is (no status suffix in that layout)
            updatedRow[0] = currentRows[idx][0] ?? "";
          }
          updatedRow[24] = task.entityId;
          currentRows[idx] = updatedRow;
        }
      }
    }

    // 3. COMPACT & SORT by Nickname (col C, index 2)
    const finalData = currentRows
      .filter((row) => row[24] && String(row[24]).trim() !== "")
      .sort((a, b) => String(a[2] ?? "").localeCompare(String(b[2] ?? "")));

    // 4. WRITE data cols A3:V (never touch W, X — Apps Script owns those)
    const dataOnly = finalData.map((r) => r.slice(0, 22));
    await glSheets.spreadsheets.values.clear({
      auth: glAuth,
      spreadsheetId,
      range: `'${region.name}'!A3:V`,
    });
    if (dataOnly.length > 0) {
      await glSheets.spreadsheets.values.update({
        auth: glAuth,
        spreadsheetId,
        range: `'${region.name}'!A3`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: dataOnly },
      });
    }

    // 5. WRITE UUIDs to col Y — separate call, never clears W/X
    const uuidColumn = finalData.map((r) => [r[24] ?? ""]);
    if (uuidColumn.length > 0) {
      await glSheets.spreadsheets.values.update({
        auth: glAuth,
        spreadsheetId,
        range: `'${region.name}'!Y3`,
        valueInputOption: "RAW",
        requestBody: { values: uuidColumn },
      });
    }

    // 6. FINISH: Mark all processed tasks as COMPLETED
    tasksProcessed = tasks.length;
    await db
      .update(gsheetSyncQueue)
      .set({ status: "COMPLETED" })
      .where(
        inArray(
          gsheetSyncQueue.id,
          tasks.map((t) => t.id),
        ),
      );
  } catch (error) {
    const errMsg =
      error instanceof Error ? error.message : "Unknown sync error";
    errorMessage = errMsg;
    tasksFailed = tasks.length;

    for (const task of tasks) {
      const newRetryCount = task.retryCount + 1;
      await db
        .update(gsheetSyncQueue)
        .set({
          retryCount: newRetryCount,
          lastError: errMsg,
          ...(newRetryCount >= MAX_RETRIES
            ? { status: "FAILED" as const }
            : {}),
        })
        .where(eq(gsheetSyncQueue.id, task.id));
    }

    console.error(`[Sync] Region ${regionId} failed:`, errMsg);
  } finally {
    await db.insert(syncAuditLog).values({
      regionId,
      direction: "FORWARD",
      tasksProcessed,
      tasksFailed,
      errorMessage,
      startedAt,
      completedAt: new Date(),
    });
  }
}

// ==========================================
// 5. SUMMARY SHEETS (For RI + For FA)
// ==========================================

const SUMMARY_DARK_GREEN = { red: 0.153, green: 0.306, blue: 0.075 }; // #274e13
const SUMMARY_WHITE = { red: 1, green: 1, blue: 1 };

function headerFormatRequest(
  sheetId: number,
  rowIndex: number,
  colCount: number,
) {
  return {
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: rowIndex,
        endRowIndex: rowIndex + 1,
        startColumnIndex: 0,
        endColumnIndex: colCount,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: SUMMARY_DARK_GREEN,
          textFormat: { bold: true, foregroundColor: SUMMARY_WHITE },
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat)",
    },
  };
}

/**
 * Regenerates the "For RI" summary sheet from DB.
 * 4 columns: TNVR catalog_id, TNVR status, Vet catalog_id, Vet status.
 * Grouped by region. Default section height 20 rows; expands with 3-row spacer if overflow.
 */
const SUMMARY_EXCLUDED_TABS = new Set([
  "_config",
  "For RI",
  "For FA",
  "UNKNOWN",
]);

async function getSpreadsheetSheets(
  glSheets: WrappedSheetsClient,
  glAuth: InstanceType<typeof google.auth.GoogleAuth>,
  spreadsheetId: string,
) {
  const res = await glSheets.spreadsheets.get({
    auth: glAuth,
    spreadsheetId,
    fields: "sheets.properties",
  });
  return res.data.sheets ?? [];
}

function sortRegionsByTabOrder(
  allRegions: { id: string; name: string }[],
  sheets: {
    properties?: { title?: string | null; sheetId?: number | null } | null;
  }[],
) {
  const orderedTabNames = sheets
    .map((s) => s.properties?.title ?? "")
    .filter((name) => !SUMMARY_EXCLUDED_TABS.has(name) && name !== "");
  const regionByName = new Map(allRegions.map((r) => [r.name, r]));
  const sorted = orderedTabNames
    .map((name) => regionByName.get(name))
    .filter((r): r is NonNullable<typeof r> => r !== undefined);
  const inTabSet = new Set(orderedTabNames);
  for (const r of allRegions) {
    if (!inTabSet.has(r.name) && !SUMMARY_EXCLUDED_TABS.has(r.name))
      sorted.push(r);
  }
  return sorted;
}

export async function generateForRiSheet(snapshot: Map<string, SheetRow[]>): Promise<void> {
  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;

  const allSheets = await getSpreadsheetSheets(glSheets, glAuth, spreadsheetId);
  const riSheetId =
    allSheets.find((s) => s.properties?.title === "For RI")?.properties
      ?.sheetId ?? null;

  const allRegions = await db.query.regions.findMany();
  const sortedRegions = sortRegionsByTabOrder(allRegions, allSheets);
  const catalogLookup = buildCatalogLookup(snapshot);

  const sheetData: string[][] = [];
  const regionHeaderIndices: number[] = [];
  const DEFAULT_HEIGHT = 20;

  sheetData.push(["Urgent for TNVR", "", "Urgent for Vet", ""]);

  for (const region of sortedRegions) {
    const catsInRegion = await db.query.cats.findMany({
      with: {
        interventions: {
          orderBy: (i, { desc }) => [desc(i.requested_at)],
        },
      },
      where: (c, { exists, eq, and }) =>
        exists(
          db
            .select()
            .from(sessionCats)
            .innerJoin(sessions, eq(sessions.id, sessionCats.session_id))
            .where(
              and(
                eq(sessions.region_id, region.id),
                eq(sessionCats.cat_id, c.id),
              ),
            ),
        ),
    });

    const tnvrCats = catsInRegion
      .filter((cat) =>
        cat.interventions.some(
          (i) => i.type === "TNVR" && i.status === "Pending",
        ),
      )
      .map((cat) => catalogDisplay(catalogLookup, cat.id, cat.cat_status));

    const vetCats = catsInRegion
      .filter((cat) =>
        cat.interventions.some(
          (i) => i.type === "Veterinarian" && i.status === "Pending",
        ),
      )
      .map((cat) => catalogDisplay(catalogLookup, cat.id, cat.cat_status));

    const maxRows = Math.max(tnvrCats.length, vetCats.length);
    const sectionRows =
      maxRows <= DEFAULT_HEIGHT ? DEFAULT_HEIGHT : maxRows + 3;

    regionHeaderIndices.push(sheetData.length);
    sheetData.push([region.name, "", region.name, ""]);

    for (let i = 0; i < sectionRows; i++) {
      sheetData.push([
        tnvrCats[i] ?? "",
        tnvrCats[i] ? "Will have TNVR intervention" : "",
        vetCats[i] ?? "",
        vetCats[i] ? "Will have Vet intervention" : "",
      ]);
    }
  }

  await glSheets.spreadsheets.values.clear({
    auth: glAuth,
    spreadsheetId,
    range: "For RI!A:AZ",
  });

  if (sheetData.length > 0) {
    await glSheets.spreadsheets.values.update({
      auth: glAuth,
      spreadsheetId,
      range: "For RI!A1",
      valueInputOption: "RAW",
      requestBody: { values: sheetData },
    });
  }

  if (riSheetId !== null) {
    const requests: object[] = [
      {
        repeatCell: {
          range: {
            sheetId: riSheetId,
            startColumnIndex: 0,
            endColumnIndex: 26,
          },
          cell: { userEnteredFormat: {} },
          fields: "userEnteredFormat",
        },
      },
      headerFormatRequest(riSheetId, 0, 4),
      ...regionHeaderIndices.map((idx) =>
        headerFormatRequest(riSheetId, idx, 4),
      ),
    ];
    await glSheets.spreadsheets.batchUpdate({
      auth: glAuth,
      spreadsheetId,
      requestBody: { requests },
    });
  }
}

/**
 * Regenerates the "For FA" summary sheet from DB.
 * 6 columns: Healthy catalog_id, status, Sick catalog_id, status, Injured catalog_id, status.
 * Grouped by region. Default section height 20 rows; expands with 3-row spacer if overflow.
 */
export async function generateForFaSheet(snapshot: Map<string, SheetRow[]>): Promise<void> {
  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;

  const allSheets = await getSpreadsheetSheets(glSheets, glAuth, spreadsheetId);
  const faSheetId2 =
    allSheets.find((s) => s.properties?.title === "For FA")?.properties
      ?.sheetId ?? null;

  const allRegions = await db.query.regions.findMany();
  const sortedRegions = sortRegionsByTabOrder(allRegions, allSheets);
  const catalogLookup = buildCatalogLookup(snapshot);

  const sheetData: string[][] = [];
  const regionHeaderIndices: number[] = [];
  const DEFAULT_HEIGHT = 20;

  sheetData.push([
    "Healthy and Adoptable",
    "",
    "Sick and Adoptable",
    "",
    "Injured and Adoptable",
    "",
  ]);

  for (const region of sortedRegions) {
    const adoptableCats = await db.query.cats.findMany({
      with: { catHealthRecords: true },
      where: (c, { eq, and, exists, isNull }) =>
        and(
          and(eq(c.is_adoptable, true), isNull(c.cat_status)),
          exists(
            db
              .select()
              .from(sessionCats)
              .innerJoin(sessions, eq(sessions.id, sessionCats.session_id))
              .where(
                and(
                  eq(sessions.region_id, region.id),
                  eq(sessionCats.cat_id, c.id),
                ),
              ),
          ),
        ),
    });

    const healthy = adoptableCats
      .filter((c) => {
        const cond =
          (c.catHealthRecords as { condition: string | null } | null)
            ?.condition ?? "";
        return !cond.includes("Sick") && !cond.includes("Injured");
      })
      .map((c) => catalogDisplay(catalogLookup, c.id, c.cat_status));

    const sick = adoptableCats
      .filter((c) =>
        (
          (c.catHealthRecords as { condition: string | null } | null)
            ?.condition ?? ""
        ).includes("Sick"),
      )
      .map((c) => catalogDisplay(catalogLookup, c.id, c.cat_status));

    const injured = adoptableCats
      .filter((c) =>
        (
          (c.catHealthRecords as { condition: string | null } | null)
            ?.condition ?? ""
        ).includes("Injured"),
      )
      .map((c) => catalogDisplay(catalogLookup, c.id, c.cat_status));

    const maxRows = Math.max(healthy.length, sick.length, injured.length);
    const sectionRows =
      maxRows <= DEFAULT_HEIGHT ? DEFAULT_HEIGHT : maxRows + 3;

    regionHeaderIndices.push(sheetData.length);
    sheetData.push([region.name, "", region.name, "", region.name, ""]);

    for (let i = 0; i < sectionRows; i++) {
      sheetData.push([
        healthy[i] ?? "",
        healthy[i] ? "Healthy & Adoptable" : "",
        sick[i] ?? "",
        sick[i] ? "Sick & Adoptable" : "",
        injured[i] ?? "",
        injured[i] ? "Injured & Adoptable" : "",
      ]);
    }
  }

  await glSheets.spreadsheets.values.clear({
    auth: glAuth,
    spreadsheetId,
    range: "For FA!A:AZ",
  });

  if (sheetData.length > 0) {
    await glSheets.spreadsheets.values.update({
      auth: glAuth,
      spreadsheetId,
      range: "For FA!A1",
      valueInputOption: "RAW",
      requestBody: { values: sheetData },
    });
  }

  if (faSheetId2 !== null) {
    const requests: object[] = [
      {
        repeatCell: {
          range: {
            sheetId: faSheetId2,
            startColumnIndex: 0,
            endColumnIndex: 26,
          },
          cell: { userEnteredFormat: {} },
          fields: "userEnteredFormat",
        },
      },
      headerFormatRequest(faSheetId2, 0, 6),
      ...regionHeaderIndices.map((idx) =>
        headerFormatRequest(faSheetId2, idx, 6),
      ),
    ];
    await glSheets.spreadsheets.batchUpdate({
      auth: glAuth,
      spreadsheetId,
      requestBody: { requests },
    });
  }
}

// ==========================================
// 6. CONFIG SHEET (_config tab) & SHEET PROTECTIONS
// ==========================================

const CONFIG_SPREADSHEET_ID = process.env.CATALOG_SPREADSHEET_ID!;
const CONFIG_SHEET = "_config";
const AUTHORIZED_EMAILS_CELL = "B1";
const REGION_SHEET_NAMES_CELL = "B2";

// A3:V in 0-indexed GridRange terms
const DATA_START_ROW = 2; // row 3, 0-indexed inclusive
const DATA_START_COL = 0; // col A, 0-indexed inclusive
const DATA_END_COL = 22; // col V, 0-indexed exclusive

// Y3:Y in 0-indexed GridRange terms
const UUID_START_COL = 24; // col Y, 0-indexed inclusive
const UUID_END_COL = 25; // col Z, 0-indexed exclusive

/**
 * Writes the authorized editors list to the _config sheet (B1).
 * Read by Apps Script Protection.gs during unfreezeMode() to restore
 * manager/admin-only edit access after app recovery.
 */
export async function setAuthorizedEmails(emails: string[]): Promise<void> {
  const { glAuth, glSheets } = await connectToSheets();

  await glSheets.spreadsheets.values.update({
    auth: glAuth,
    spreadsheetId: CONFIG_SPREADSHEET_ID,
    range: `${CONFIG_SHEET}!${AUTHORIZED_EMAILS_CELL}`,
    valueInputOption: "RAW",
    requestBody: { values: [[emails.join(",")]] },
  });
}

/**
 * Derives the authorized editors list from the DB (Administrator + Manager roles),
 * fetches their emails via the Supabase admin client, then writes to _config!B1.
 *
 * Called automatically (fire-and-forget) whenever a profile's auth_role changes.
 */
export async function syncSheetEditors(): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");

  const managerProfiles = await db.query.profiles.findMany({
    where: (cols, { inArray }) =>
      inArray(cols.auth_role, ["Administrator", "Manager"]),
  });

  if (managerProfiles.length === 0) {
    await setAuthorizedEmails([]);
    return;
  }

  const supabase = await createAdminClient();
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  const managerIds = new Set(managerProfiles.map((p) => p.id));
  const emails = users
    .filter((u) => managerIds.has(u.id) && !!u.email)
    .map((u) => u.email as string);

  await setAuthorizedEmails(emails);
}

/**
 * Writes region sheet names to _config!B2 so Apps Script Protection.gs
 * knows which tabs are region data sheets vs. static summary sheets.
 * Call whenever a region is created or deleted.
 */
export async function syncRegionSheetNames(): Promise<void> {
  const regions = await db.query.regions.findMany();
  const names = regions.map((r) => r.name);

  const { glAuth, glSheets } = await connectToSheets();

  await glSheets.spreadsheets.values.update({
    auth: glAuth,
    spreadsheetId: CONFIG_SPREADSHEET_ID,
    range: `${CONFIG_SHEET}!${REGION_SHEET_NAMES_CELL}`,
    valueInputOption: "RAW",
    requestBody: { values: [[names.join(",")]] },
  });
}

/**
 * Reads the authorized editors list from the _config sheet (B1).
 */
export async function getAuthorizedEmails(): Promise<string[]> {
  const { glAuth, glSheets } = await connectToSheets();

  const response = await glSheets.spreadsheets.values.get({
    auth: glAuth,
    spreadsheetId: CONFIG_SPREADSHEET_ID,
    range: `${CONFIG_SHEET}!${AUTHORIZED_EMAILS_CELL}`,
  });

  const value = response.data.values?.[0]?.[0];
  if (!value) return [];
  return String(value)
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/**
 * Removes A3:V protections from all regional sheet tabs.
 * Called during freeze — lets all users with sheet access edit freely.
 */
export async function freezeSheetProtections(): Promise<void> {
  const regions = await db.query.regions.findMany();
  const regionNames = new Set<string>(regions.map((r) => r.name));

  const { glAuth, glSheets } = await connectToSheets();

  const spreadsheet = await glSheets.spreadsheets.get({
    auth: glAuth,
    spreadsheetId: CONFIG_SPREADSHEET_ID,
    fields: "sheets(properties(sheetId,title),protectedRanges)",
  });

  const requests: object[] = [];

  for (const sheet of spreadsheet.data.sheets ?? []) {
    if (!regionNames.has(sheet.properties?.title ?? "")) continue;

    for (const pr of sheet.protectedRanges ?? []) {
      const range = pr.range;
      if (
        range?.startRowIndex === DATA_START_ROW &&
        range?.startColumnIndex === DATA_START_COL
      ) {
        requests.push({
          deleteProtectedRange: { protectedRangeId: pr.protectedRangeId },
        });
      }
    }
  }

  if (requests.length > 0) {
    await glSheets.spreadsheets.batchUpdate({
      auth: glAuth,
      spreadsheetId: CONFIG_SPREADSHEET_ID,
      requestBody: { requests },
    });
  }
}

/**
 * Adds A3:V protection to all regional sheet tabs, restricting edits
 * to the managers/admins listed in _config!B1.
 * Called during unfreeze — re-locks sheets after app recovery.
 */
export async function unfreezeSheetProtections(): Promise<void> {
  const regions = await db.query.regions.findMany();
  const regionNames = new Set<string>(regions.map((r) => r.name));

  const { glAuth, glSheets } = await connectToSheets();

  const serviceAccountEmail = JSON.parse(
    process.env.SERVICE_ACCOUNT_CREDENTIALS!,
  ).client_email as string;
  const managerEmails = await getAuthorizedEmails();
  const emails = [
    serviceAccountEmail,
    ...managerEmails.filter((e) => e !== serviceAccountEmail),
  ];

  const spreadsheet = await glSheets.spreadsheets.get({
    auth: glAuth,
    spreadsheetId: CONFIG_SPREADSHEET_ID,
    fields: "sheets(properties(sheetId,title),protectedRanges)",
  });

  const requests: object[] = [];

  for (const sheet of spreadsheet.data.sheets ?? []) {
    if (!regionNames.has(sheet.properties?.title ?? "")) continue;
    const sheetId = sheet.properties?.sheetId;
    if (sheetId === undefined) continue;

    // Delete ALL existing A3:V protections first to avoid stacking
    for (const pr of sheet.protectedRanges ?? []) {
      const range = pr.range;
      if (
        range?.startRowIndex === DATA_START_ROW &&
        range?.startColumnIndex === DATA_START_COL
      ) {
        requests.push({
          deleteProtectedRange: { protectedRangeId: pr.protectedRangeId },
        });
      }
    }

    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId,
            startRowIndex: DATA_START_ROW,
            startColumnIndex: DATA_START_COL,
            endColumnIndex: DATA_END_COL,
          },
          description: "App-managed data — edit via app only",
          editors: { users: emails },
        },
      },
    });
  }

  if (requests.length > 0) {
    await glSheets.spreadsheets.batchUpdate({
      auth: glAuth,
      spreadsheetId: CONFIG_SPREADSHEET_ID,
      requestBody: { requests },
    });
  }
}

/**
 * Sets up Y column (UUID) protections on all region sheets, restricted to the
 * service account only — blocks all human edits but allows forward sync writes.
 * Replaces the GAS setupUuidProtection() which had no editors (broken for API writes).
 */
export async function setupUuidProtections(): Promise<void> {
  const regions = await db.query.regions.findMany();
  const regionNames = new Set<string>(regions.map((r) => r.name));

  const { glAuth, glSheets } = await connectToSheets();
  const serviceAccountEmail = JSON.parse(
    process.env.SERVICE_ACCOUNT_CREDENTIALS!,
  ).client_email as string;

  const spreadsheet = await glSheets.spreadsheets.get({
    auth: glAuth,
    spreadsheetId: CONFIG_SPREADSHEET_ID,
    fields: "sheets(properties(sheetId,title),protectedRanges)",
  });

  const requests: object[] = [];

  for (const sheet of spreadsheet.data.sheets ?? []) {
    if (!regionNames.has(sheet.properties?.title ?? "")) continue;
    const sheetId = sheet.properties?.sheetId;
    if (sheetId === undefined) continue;

    for (const pr of sheet.protectedRanges ?? []) {
      const range = pr.range;
      if (
        range?.startColumnIndex === UUID_START_COL &&
        range?.endColumnIndex === UUID_END_COL
      ) {
        requests.push({
          deleteProtectedRange: { protectedRangeId: pr.protectedRangeId },
        });
      }
    }

    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId,
            startRowIndex: DATA_START_ROW,
            startColumnIndex: UUID_START_COL,
            endColumnIndex: UUID_END_COL,
          },
          description: "UUID column — service account only",
          editors: { users: [serviceAccountEmail] },
        },
      },
    });
  }

  if (requests.length > 0) {
    await glSheets.spreadsheets.batchUpdate({
      auth: glAuth,
      spreadsheetId: CONFIG_SPREADSHEET_ID,
      requestBody: { requests },
    });
  }
}

// ==========================================
// 7. REVERSE SYNC (Reading GSheet State)
// ==========================================

export interface SheetRow {
  raw: string[];
  /** Cat UUID from column Y */
  entityId: string;
  /** ISO timestamp from column W (set by Apps Script onEdit) */
  lastEditedAt: string | null;
  /** Editor email from column X */
  editedBy: string | null;
  /** 1-based sheet row position (data starts at row 3, so first data row is 3) */
  rowIndex: number;
}

/**
 * Reads the full sheet state for a region, including timestamp columns W and X.
 * Returns parsed rows with metadata for comparison against DB state.
 */
export async function readSheetState(regionId: string): Promise<SheetRow[]> {
  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;

  const region = await db.query.regions.findFirst({
    where: eq(regions.id, regionId),
  });
  if (!region) return [];

  // Read A3:Y — col Y (index 24) is UUID, col W (22) is last_edited_at, col X (23) is edited_by
  const response = await glSheets.spreadsheets.values.get({
    auth: glAuth,
    spreadsheetId,
    range: `'${region.name}'!A3:Y`,
  });

  const rows = response.data.values || [];

  return rows
    .map((row, i) => ({ row, rowIndex: i + 3 })) // capture position BEFORE filtering
    .filter(({ row }) => row[24] && String(row[24]).trim() !== "")
    .map(({ row, rowIndex }) => ({
      raw: row as string[],
      entityId: String(row[24]).trim(), // col Y UUID
      lastEditedAt: row[22] ? String(row[22]).trim() : null, // col W
      editedBy: row[23] ? String(row[23]).trim() : null, // col X
      rowIndex,
    }));
}

/**
 * Reads sheet state for every region in one paced pass. The wrapped client
 * spaces calls automatically, so for N regions this takes roughly N * 1.2s.
 *
 * Per-region failures (after the wrapper's retries are exhausted) are logged
 * and the region maps to an empty array — the cron should make progress on
 * healthy regions even if one is broken.
 */
export async function readAllRegionSheetStates(
  regionList: { id: string; name: string }[],
): Promise<Map<string, SheetRow[]>> {
  const result = new Map<string, SheetRow[]>();
  for (const region of regionList) {
    try {
      const rows = await readSheetState(region.id);
      result.set(region.id, rows);
    } catch (error) {
      console.error(
        `[ReadAllRegionSheetStates] region ${region.name} (${region.id}) failed:`,
        error instanceof Error ? error.message : error,
      );
      result.set(region.id, []);
    }
  }
  return result;
}

/**
 * Builds a uuid → col-A display string map from a snapshot.
 * Used by summary regen to get catalog numbers without a DB read.
 */
export function buildCatalogLookup(
  snapshot: Map<string, SheetRow[]>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const rows of snapshot.values()) {
    for (const r of rows) {
      const colA = String(r.raw[0] ?? "").trim();
      if (r.entityId && colA) out.set(r.entityId, colA);
    }
  }
  return out;
}

/**
 * Clears the last_edited_at (col W) and edited_by (col X) for specific rows
 * after successful reverse sync / photo import. Prevents re-importing the
 * same edits.
 *
 * Two call shapes:
 *   - With known row positions (from a shared readSheetState pass): no
 *     additional Sheets read needed.
 *   - With only entity IDs (legacy / standalone paths): one extra read of
 *     col Y to locate row positions.
 */

export async function clearSheetEditTimestamps(
  regionId: string,
  entityIds: string[],
): Promise<void>;
export async function clearSheetEditTimestamps(
  regionId: string,
  entries: Array<{
    entityId: string;
    rowIndex: number;
    expectedTimestamp: string | null;
  }>,
): Promise<void>;
export async function clearSheetEditTimestamps(
  regionId: string,
  arg:
    | string[]
    | Array<{
        entityId: string;
        rowIndex: number;
        expectedTimestamp: string | null;
      }>,
): Promise<void> {
  if (arg.length === 0) return;

  const region = await db.query.regions.findFirst({
    where: eq(regions.id, regionId),
  });
  if (!region) return;

  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;

  let positional: Array<{ rowIndex: number }>;
  if (typeof arg[0] === "string") {
    // Legacy path — must read col Y to find positions
    const response = await glSheets.spreadsheets.values.get({
      auth: glAuth,
      spreadsheetId,
      range: `'${region.name}'!Y3:Y`,
    });
    const uuidColumn = response.data.values || [];
    positional = [];
    for (const entityId of arg as string[]) {
      const rowIdx = uuidColumn.findIndex(
        (row) => String(row[0] ?? "").trim() === entityId,
      );
      if (rowIdx === -1) continue;
      positional.push({ rowIndex: rowIdx + 3 });
    }
  } else {
    // Filter out entries with no snapshot W (nothing to clear — user may have
    // added a W timestamp since the snapshot, which we must preserve).
    const verifyable = (
      arg as Array<{
        entityId: string;
        rowIndex: number;
        expectedTimestamp: string | null;
      }>
    ).filter((e) => e.expectedTimestamp !== null && e.expectedTimestamp !== "");

    if (verifyable.length === 0) return;

    // Re-read col W for the region. Skip clear for rows whose W has changed
    // since the snapshot — those represent edits made during the cron tick that
    // the next tick must process.
    const wResponse = await glSheets.spreadsheets.values.get({
      auth: glAuth,
      spreadsheetId,
      range: `'${region.name}'!W3:W`,
    });
    const wColumn = wResponse.data.values || [];

    let skippedDueToChange = 0;
    positional = [];
    for (const entry of verifyable) {
      const currentW = String(wColumn[entry.rowIndex - 3]?.[0] ?? "").trim();
      const expected = String(entry.expectedTimestamp).trim();
      if (currentW === expected) {
        positional.push({ rowIndex: entry.rowIndex });
      } else {
        skippedDueToChange++;
      }
    }

    if (skippedDueToChange > 0) {
      console.log(
        `[ClearTimestamps] region=${region.name} skipped ${skippedDueToChange} rows — W changed since snapshot (re-edited during cron tick)`,
      );
    }
  }

  if (positional.length === 0) return;

  const requests = positional.map((p) => ({
    range: `'${region.name}'!W${p.rowIndex}:X${p.rowIndex}`,
    values: [["", ""]],
  }));

  await glSheets.spreadsheets.values.batchUpdate({
    auth: glAuth,
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data: requests },
  });
}

/**
 * Assigns catalog numbers (col A) to any rows that are missing one.
 * Runs after reverse-sync CREATEs so volunteer-added rows always get numbered.
 * Numbers sequentially from the current region max + 1.
 * Includes the status suffix (e.g. "5m" for MIA) from DB cat_status.
 *
 * Note: operates on the pre-sync snapshot. Rows added by volunteers mid-tick
 * (after readAllRegionSheetStates ran) will be caught on the next cron tick.
 * This is acceptable — Apps Script already has the UUID; the cat is in DB;
 * only col A is blank for one tick.
 *
 * Returns how many rows were backfilled.
 */
export async function backfillCatalogIds(
  regionId: string,
  snapshot: SheetRow[],
): Promise<number> {
  const unnumberedRows = snapshot.filter((r) => {
    const colA = String(r.raw[0] ?? "").trim();
    return !colA || parseCatalogId(colA) === null;
  });

  if (unnumberedRows.length === 0) return 0;

  const region = await regionsRepo.findRegionById(regionId);
  if (!region) return 0;

  const currentMax = Math.max(
    0,
    ...snapshot
      .map((r) => parseCatalogId(String(r.raw[0] ?? "").trim()))
      .filter((n): n is number => n !== null),
  );

  const catIds = unnumberedRows.map((r) => r.entityId);
  const catRecords = await catsRepo.findCatsByIds(catIds);
  const catStatusById = new Map(catRecords.map((c) => [c.id, c.cat_status]));

  let nextNum = currentMax;
  const updates = unnumberedRows.map((r) => {
    const catStatus = catStatusById.get(r.entityId);
    const display = `${++nextNum}${statusSuffix(catStatus)}`;
    return {
      range: `'${region.name}'!A${r.rowIndex}`,
      values: [[display]],
    };
  });

  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;

  await glSheets.spreadsheets.values.batchUpdate({
    auth: glAuth,
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data: updates },
  });

  return unnumberedRows.length;
}
