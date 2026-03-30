import { google } from "googleapis";
import { eq, inArray } from "drizzle-orm";
import { db, Transaction } from "@/lib/db";
import { gsheetSyncQueue, regions } from "@/lib/db/schema";
import * as sessionsRepo from "@/lib/repo/sessions.repo";
import { SelectCat, SelectCatHealthRecord } from "@/lib/validation/cats";
import { SelectIntervention } from "@/lib/validation/interventions";

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
    const typeLabel = targetType === "TNVR" ? "TNVR " : "";
    return `Will have ${typeLabel}intervention`;
  }

  // 3. PRIORITY 2: Is there a FINISHED one?
  // (This finds the newest Finished one)
  const finished = filtered.find((i) => i.status === "Finished");
  if (finished) {
    const typeLabel = targetType === "TNVR" ? "TNVR " : "";
    return `Had ${typeLabel}intervention`;
  }

  // 4. DEFAULT: Fallback if everything is Cancelled or Unknown
  return "Will not have intervention";
}
/**
 * Maps Database records to a 21-column Spreadsheet Array (A-U)
 */
export function mapCatToSheetRow(
  cat: SelectCat,
  health: SelectCatHealthRecord | null,
  interventions: SelectIntervention[] = [],
): string[] {
  const condition = (health?.condition ?? "") as string;
  const catStatus = (cat.cat_status ?? "") as string;

  // Calculate Column U (FOR FA)
  let forFaStatus = "Not Ready for FA";
  if (["Adopted", "Deceased", "MIA"].includes(catStatus)) {
    forFaStatus = "Not Applicable";
  } else if (cat.is_adoptable) {
    if (condition.includes("Sick")) forFaStatus = "Sick & Adoptable";
    else if (condition.includes("Injured")) forFaStatus = "Injured & Adoptable";
    else forFaStatus = "Healthy & Adoptable";
  }

  // Mapping: index - column
  return [
    cat.id, // 0  (A)
    cat.photo_url ? `=IMAGE("${cat.photo_url}")` : "", // 1  (B)
    cat.name ?? "N/A", // 2  (C)
    cat.color ?? "N/A", // 3  (D)
    cat.age ?? "N/A", // 4  (E)
    cat.sex ?? "Unknown", // 5  (F)
    health?.neuter_date ? "YES" : "NO", // 6  (G)
    cat.sociability ?? "Unknown", // 7  (H)
    condition.includes("Sick") ? "YES" : "NO", // 8  (I)
    condition.includes("Injured") ? "YES" : "NO", // 9  (J)
    cat.is_adoptable ? "YES" : "NO", // 10 (K)
    catStatus || "Unknown", // 11 (L)
    cat.caretaker ?? "N/A", // 12 (M)
    new Date().toLocaleDateString(), // 13 (N)
    cat.spot_last_seen ?? "N/A", // 14 (O)
    health?.neuter_date?.toLocaleDateString() ?? "N/A", // 15 (P)
    health?.vaccination_date?.toLocaleDateString() ?? "N/A", // 16 (Q)
    cat.notes ?? "N/A", // 17 (R)

    "", // 18 (S) <-- THE BLACKED OUT SEPARATOR

    getInterventionDisplayStatus(cat, interventions, "TNVR"), // 19 (T)
    getInterventionDisplayStatus(cat, interventions, "Veterinarian"), // 20 (U)
    forFaStatus, // 21 (V)
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
 */
export async function syncAndCompactRegion(regionId: string) {
  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;

  const region = await db.query.regions.findFirst({
    where: eq(regions.id, regionId),
  });
  if (!region) return;

  const tasks = await db.query.gsheetSyncQueue.findMany({
    where: (q, { and, eq }) =>
      and(eq(q.regionId, regionId), eq(q.status, "PENDING")),
    orderBy: (q, { asc }) => [asc(q.createdAt)],
  });

  if (tasks.length === 0) return;

  // 1. READ: Get current sheet state (A3 to U)
  const response = await glSheets.spreadsheets.values.get({
    auth: glAuth,
    spreadsheetId,
    range: `'${region.name}'!A3:V`,
  });
  const currentRows = response.data.values || [];

  // 2. MODIFY: Process pending tasks in local memory
  for (const task of tasks) {
    const idx = currentRows.findIndex((r) => r[0] === task.entityId);
    const taskPayload = (task.payload ?? []) as string[];

    if (task.action === "DELETE") {
      if (idx !== -1) currentRows.splice(idx, 1);
    } else {
      // CREATE or UPDATE: Snapshot overwrite
      if (idx !== -1) currentRows[idx] = taskPayload;
      else currentRows.push(taskPayload);
    }
  }

  // 3. COMPACT & SORT: Cleanup blank rows and alphabetize by Nickname (Col C)
  const finalData = currentRows
    .filter((row) => row[0] && String(row[0]).trim() !== "")
    .sort((a, b) => String(a[2] ?? "").localeCompare(String(b[2] ?? "")));

  // 4. WRITE: Atomic wipe and re-upload
  await glSheets.spreadsheets.values.clear({
    auth: glAuth,
    spreadsheetId,
    range: `'${region.name}'!A3:V`,
  });

  if (finalData.length > 0) {
    await glSheets.spreadsheets.values.update({
      auth: glAuth,
      spreadsheetId,
      range: `'${region.name}'!A3`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: finalData },
    });
  }

  // 5. FINISH: Mark all processed tasks as COMPLETED
  await db
    .update(gsheetSyncQueue)
    .set({ status: "COMPLETED" })
    .where(
      inArray(
        gsheetSyncQueue.id,
        tasks.map((t) => t.id),
      ),
    );
}
