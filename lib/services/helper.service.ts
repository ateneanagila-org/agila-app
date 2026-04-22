import { google } from "googleapis";
import { eq, inArray, and, lt } from "drizzle-orm";
import { db, Transaction } from "@/lib/db";
import { gsheetSyncQueue, regions, syncAuditLog, cats } from "@/lib/db/schema";
import * as sessionsRepo from "@/lib/repo/sessions.repo";
import { isSyncFrozen } from "./system.service";
import { statusSuffix, nextCatalogId } from "./catalog.service";
import { SelectCat, SelectCatHealthRecord } from "@/lib/validation/cats";
import { SelectIntervention } from "@/lib/validation/interventions";

const MAX_RETRIES = 3;

// ==========================================
// 1. AUTHENTICATION
// ==========================================

export async function connectToSheets() {
  const serviceAccountCredentials = JSON.parse(
    process.env.SERVICE_ACCOUNT_CREDENTIALS!,
  );
  const privateKey = serviceAccountCredentials.private_key.replace(
    /\\n/g,
    "\n",
  );

  const glAuth = new google.auth.GoogleAuth({
    credentials: { ...serviceAccountCredentials, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return {
    glAuth,
    glSheets: google.sheets({ version: "v4", auth: glAuth }),
  };
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
 * Col A = catalog_id + status suffix. UUID is written to col Y separately.
 */
export function mapCatToSheetRow(
  cat: SelectCat,
  health: SelectCatHealthRecord | null,
  interventions: SelectIntervention[] = [],
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

  const catalogDisplay = cat.catalog_id
    ? `${cat.catalog_id}${statusSuffix(cat.cat_status)}`
    : "";

  return [
    catalogDisplay,                                                    // 0  (A) Catalog ID
    cat.photo_url ? `=IMAGE("${cat.photo_url}")` : "",                 // 1  (B)
    cat.name ?? "N/A",                                                 // 2  (C)
    cat.color ?? "N/A",                                                // 3  (D)
    cat.age ?? "N/A",                                                  // 4  (E)
    cat.sex ?? "Unknown",                                              // 5  (F)
    health?.neuter_date ? "YES" : "NO",                                // 6  (G)
    cat.sociability ?? "Unknown",                                      // 7  (H)
    condition.includes("Sick") ? "YES" : "NO",                        // 8  (I)
    condition.includes("Injured") ? "YES" : "NO",                     // 9  (J)
    cat.is_adoptable ? "YES" : "NO",                                   // 10 (K)
    catStatus || "Unknown",                                            // 11 (L)
    cat.caretaker ?? "N/A",                                            // 12 (M)
    new Date().toLocaleDateString(),                                   // 13 (N)
    cat.spot_last_seen ?? "N/A",                                       // 14 (O)
    health?.neuter_date?.toLocaleDateString() ?? "N/A",               // 15 (P)
    health?.vaccination_date?.toLocaleDateString() ?? "N/A",          // 16 (Q)
    cat.notes ?? "N/A",                                                // 17 (R)
    "",                                                                // 18 (S) separator
    getInterventionDisplayStatus(cat, interventions, "TNVR"),          // 19 (T)
    getInterventionDisplayStatus(cat, interventions, "Veterinarian"),  // 20 (U)
    forFaStatus,                                                       // 21 (V)
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
): string[] {
  const condition = (health?.condition ?? "") as string;
  const catalogDisplay = cat.catalog_id
    ? `${cat.catalog_id}${statusSuffix(cat.cat_status)}`
    : "";

  return [
    catalogDisplay,                                            // 0  (A)
    cat.spot_last_seen ?? "N/A",                               // 1  (B) Possible Loc
    cat.paws_id ?? "",                                         // 2  (C) PAWS ID#
    cat.color ?? "N/A",                                        // 3  (D)
    cat.age ?? "N/A",                                          // 4  (E)
    cat.sex ?? "Unknown",                                      // 5  (F)
    health?.neuter_date ? "YES" : "NO",                        // 6  (G)
    cat.sociability ?? "Unknown",                              // 7  (H)
    condition.includes("Sick") ? "YES" : "NO",                // 8  (I)
    condition.includes("Injured") ? "YES" : "NO",             // 9  (J)
    cat.is_adoptable ? "YES" : "NO",                           // 10 (K)
    health?.neuter_date?.toLocaleDateString() ?? "N/A",       // 11 (L)
    health?.vaccination_date?.toLocaleDateString() ?? "N/A",  // 12 (M)
    "", "", "", "", "", "", "", "", "",                         // 13–21 (N–V) empty
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

  const rowData = mapCatToSheetRow(
    cat,
    cat.catHealthRecords,
    cat.interventions,
  );

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
          // New cat — assign catalog_id if not yet set
          const cat = await db.query.cats.findFirst({
            where: (c, { eq }) => eq(c.id, task.entityId),
          });
          if (cat && !cat.catalog_id) {
            const colAValues = currentRows.map((r) => r[0] ?? "");
            const newId = String(nextCatalogId(colAValues));
            await db.update(cats).set({ catalog_id: newId }).where(eq(cats.id, cat.id));
            const health = await db.query.catHealthRecords.findFirst({
              where: (h, { eq }) => eq(h.cat_id, cat.id),
            });
            const interventionsList = await db.query.interventions.findMany({
              where: (i, { eq }) => eq(i.cat_id, cat.id),
              orderBy: (i, { desc }) => [desc(i.requested_at)],
            });
            const updatedCat = { ...cat, catalog_id: newId };
            const newPayload = region.name === "UNKNOWN"
              ? mapUnknownCatToSheetRow(updatedCat, health ?? null)
              : mapCatToSheetRow(updatedCat, health ?? null, interventionsList);
            currentRows.push([...newPayload, "", "", task.entityId]); // pad cols W, X, then Y
          } else {
            // catalog_id already assigned — use task payload, pad to col Y
            currentRows.push([...taskPayload, "", "", task.entityId]);
          }
        } else {
          // Update existing row, preserve col Y UUID
          const updatedRow = [...taskPayload];
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
      .where(inArray(gsheetSyncQueue.id, tasks.map((t) => t.id)));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown sync error";
    errorMessage = errMsg;
    tasksFailed = tasks.length;

    for (const task of tasks) {
      const newRetryCount = task.retryCount + 1;
      await db
        .update(gsheetSyncQueue)
        .set({
          retryCount: newRetryCount,
          lastError: errMsg,
          ...(newRetryCount >= MAX_RETRIES ? { status: "FAILED" as const } : {}),
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
// 5. CONFIG SHEET (_config tab) & SHEET PROTECTIONS
// ==========================================

const CONFIG_SPREADSHEET_ID = process.env.CATALOG_SPREADSHEET_ID!;
const CONFIG_SHEET = "_config";
const AUTHORIZED_EMAILS_CELL = "B1";

// A3:V in 0-indexed GridRange terms
const DATA_START_ROW = 2; // row 3, 0-indexed inclusive
const DATA_START_COL = 0; // col A, 0-indexed inclusive
const DATA_END_COL = 22; // col V, 0-indexed exclusive

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
  const { glAuth, glSheets } = await connectToSheets();

  const spreadsheet = await glSheets.spreadsheets.get({
    auth: glAuth,
    spreadsheetId: CONFIG_SPREADSHEET_ID,
    fields: "sheets(properties(sheetId,title),protectedRanges)",
  });

  const requests: object[] = [];

  for (const sheet of spreadsheet.data.sheets ?? []) {
    if (sheet.properties?.title === CONFIG_SHEET) continue;

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
  const { glAuth, glSheets } = await connectToSheets();

  const emails = await getAuthorizedEmails();
  if (emails.length === 0) {
    console.warn("[unfreezeSheetProtections] No authorized emails found — skipping protection restore.");
    return;
  }

  const spreadsheet = await glSheets.spreadsheets.get({
    auth: glAuth,
    spreadsheetId: CONFIG_SPREADSHEET_ID,
    fields: "sheets(properties(sheetId,title))",
  });

  const requests: object[] = [];

  for (const sheet of spreadsheet.data.sheets ?? []) {
    if (sheet.properties?.title === CONFIG_SHEET) continue;
    const sheetId = sheet.properties?.sheetId;
    if (sheetId === undefined) continue;

    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId,
            startRowIndex: DATA_START_ROW,
            startColumnIndex: DATA_START_COL,
            endColumnIndex: DATA_END_COL,
            // endRowIndex omitted — protection extends to end of sheet
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

// ==========================================
// 6. REVERSE SYNC (Reading GSheet State)
// ==========================================

export interface SheetRow {
  raw: string[];
  /** Cat UUID from column Y */
  entityId: string;
  /** ISO timestamp from column W (set by Apps Script onEdit) */
  lastEditedAt: string | null;
  /** Editor email from column X */
  editedBy: string | null;
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
    .filter((row) => row[24] && String(row[24]).trim() !== "") // require UUID in col Y
    .map((row) => ({
      raw: row as string[],
      entityId: String(row[24]).trim(),        // col Y UUID
      lastEditedAt: row[22] ? String(row[22]).trim() : null, // col W
      editedBy: row[23] ? String(row[23]).trim() : null,     // col X
    }));
}

/**
 * Clears the last_edited_at (col W) and edited_by (col X) for specific rows
 * after successful reverse sync import. Prevents re-importing the same edits.
 */
export async function clearSheetEditTimestamps(
  regionId: string,
  entityIds: string[],
): Promise<void> {
  if (entityIds.length === 0) return;

  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;

  const region = await db.query.regions.findFirst({
    where: eq(regions.id, regionId),
  });
  if (!region) return;

  // Read col Y to find row positions of imported entities
  const response = await glSheets.spreadsheets.values.get({
    auth: glAuth,
    spreadsheetId,
    range: `'${region.name}'!Y3:Y`,
  });
  const uuidColumn = response.data.values || [];

  const requests: Array<{ range: string; values: string[][] }> = [];

  for (const entityId of entityIds) {
    const rowIdx = uuidColumn.findIndex(
      (row) => String(row[0] ?? "").trim() === entityId,
    );
    if (rowIdx === -1) continue;
    const sheetRow = rowIdx + 3; // data starts at row 3
    requests.push({
      range: `'${region.name}'!W${sheetRow}:X${sheetRow}`,
      values: [["", ""]],
    });
  }

  if (requests.length > 0) {
    await glSheets.spreadsheets.values.batchUpdate({
      auth: glAuth,
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: requests },
    });
  }
}
