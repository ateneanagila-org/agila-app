// scripts/import-sheets.ts
// One-time bulk import. Run with: pnpm tsx scripts/import-sheets.ts
// Requires .env.local with all required env vars.

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { google } from "googleapis";
import { db } from "@/lib/db";
import { cats, catHealthRecords, interventions } from "@/lib/db/schema";
import {
  CATHEALTHRECORD_CONDITION_VALUES,
  CAT_COLOR_VALUES,
  CAT_AGE_VALUES,
  CAT_SEX_VALUES,
  CAT_SOCIABILITY_VALUES,
  CAT_STATUS_VALUES,
  INTERVENTION_TYPE_VALUES,
  INTERVENTION_STATUS_VALUES,
} from "@/lib/db/enums";

type InterventionType = (typeof INTERVENTION_TYPE_VALUES)[number];
type InterventionStatus = (typeof INTERVENTION_STATUS_VALUES)[number];
type ParsedIntervention = {
  type: InterventionType;
  status: InterventionStatus;
} | null;
import { parseCatalogId } from "@/lib/services/catalog.service";
import { linkCatToSystemSession } from "@/lib/services/system-session.service";
import {
  syncRegionSheetNames,
  setupUuidProtections,
} from "@/lib/services/helper.service";
import { randomUUID } from "crypto";

type ConditionValue = (typeof CATHEALTHRECORD_CONDITION_VALUES)[number];
type CatColor = (typeof CAT_COLOR_VALUES)[number];
type CatAge = (typeof CAT_AGE_VALUES)[number];
type CatSex = (typeof CAT_SEX_VALUES)[number];
type CatSociability = (typeof CAT_SOCIABILITY_VALUES)[number];
type CatStatus = (typeof CAT_STATUS_VALUES)[number];

type CatInsert = typeof cats.$inferInsert;
type ParsedRow = Omit<CatInsert, 'sex' | 'sociability'> & {
  sex: CatSex | null;
  sociability: CatSociability | null;
  condition: ConditionValue;
  neuter_date: Date | null;
  vaccination_date: Date | null;
  tnvr_intervention: ParsedIntervention;
  vet_intervention: ParsedIntervention;
};

async function connectToSheets() {
  const creds = JSON.parse(process.env.SERVICE_ACCOUNT_CREDENTIALS!);
  const auth = new google.auth.GoogleAuth({
    credentials: {
      ...creds,
      private_key: creds.private_key.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return { auth, sheets: google.sheets({ version: "v4", auth }) };
}

const VALID_COLORS = [
  "Black",
  "White",
  "Black and White",
  "Calico",
  "Tortie",
  "Torbie",
  "Orange Tabby",
  "Orange and White Tabby",
  "Gray Tabby",
  "Gray and White Tabby",
  "Brown Tabby",
  "Brown and White Tabby",
];
const VALID_AGES = ["Neonatal", "Kitten", "Juvenile", "Adult"];
const VALID_SEXES = ["Male", "Female"];
const VALID_SOCIABILITIES = ["Domesticated", "Tame", "Feral"];
const VALID_STATUSES = ["Deceased", "Fostered", "Adopted", "MIA"];

function resolveIntervention(
  raw: string,
  type: InterventionType,
): ParsedIntervention {
  const v = raw.trim().toLowerCase();
  if (v.startsWith("will have")) return { type, status: "Pending" };
  if (v.startsWith("had")) return { type, status: "Finished" };
  return null;
}

function resolveCondition(isSick: boolean, isInjured: boolean): ConditionValue {
  if (isSick && isInjured) return "Sick and Injured";
  if (isSick) return "Sick";
  if (isInjured) return "Injured";
  return "Healthy";
}

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str || str === "N/A") return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const delays = [1000, 3000, 8000, 20000, 45000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const code = (error as { code?: number }).code;
      const isQuota =
        code === 429 ||
        (error instanceof Error && /quota|rate/i.test(error.message));
      if (!isQuota || attempt === delays.length) throw error;
      const wait = delays[attempt];
      console.warn(`  ${label} hit quota — retrying in ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("unreachable");
}

function parseStandardRow(row: string[], uuid: string): ParsedRow {
  const isSick = String(row[8] ?? "").toUpperCase() === "YES";
  const isInjured = String(row[9] ?? "").toUpperCase() === "YES";
  const colorStr = String(row[3] ?? "").trim();
  const ageStr = String(row[4] ?? "").trim();
  const sexStr = String(row[5] ?? "").trim();
  const socStr = String(row[7] ?? "").trim();
  const statusStr = String(row[11] ?? "").trim();

  return {
    id: uuid,
    color: (VALID_COLORS.includes(colorStr)
      ? colorStr
      : null) as CatColor | null,
    age: (VALID_AGES.includes(ageStr) ? ageStr : null) as CatAge | null,
    sex: (VALID_SEXES.includes(sexStr) ? sexStr : null) as CatSex | null,
    sociability: (VALID_SOCIABILITIES.includes(socStr)
      ? socStr
      : null) as CatSociability | null,
    cat_status: (VALID_STATUSES.includes(statusStr)
      ? statusStr
      : null) as CatStatus | null,
    name: row[2] && row[2] !== "N/A" ? row[2] : null,
    spot_last_seen: row[14] && row[14] !== "N/A" ? row[14] : null,
    caretaker: row[12] && row[12] !== "N/A" ? row[12] : null,
    notes: row[17] && row[17] !== "N/A" ? row[17] : null,
    is_adoptable: String(row[10] ?? "").toUpperCase() === "YES",
    photo_url: null,
    paws_id: null,
    condition: resolveCondition(isSick, isInjured),
    neuter_date: parseDate(row[15]),
    vaccination_date: parseDate(row[16]),
    tnvr_intervention: resolveIntervention(String(row[19] ?? ""), "TNVR"),
    vet_intervention: resolveIntervention(
      String(row[20] ?? ""),
      "Veterinarian",
    ),
  };
}

function parseUnknownRow(row: string[], uuid: string): ParsedRow {
  const isSick = String(row[8] ?? "").toUpperCase() === "YES";
  const isInjured = String(row[9] ?? "").toUpperCase() === "YES";
  const colorStr = String(row[3] ?? "").trim();
  const ageStr = String(row[4] ?? "").trim();
  const sexStr = String(row[5] ?? "").trim();
  const socStr = String(row[7] ?? "").trim();

  return {
    id: uuid,
    color: (VALID_COLORS.includes(colorStr)
      ? colorStr
      : null) as CatColor | null,
    age: (VALID_AGES.includes(ageStr) ? ageStr : null) as CatAge | null,
    sex: (VALID_SEXES.includes(sexStr) ? sexStr : null) as CatSex | null,
    sociability: (VALID_SOCIABILITIES.includes(socStr)
      ? socStr
      : null) as CatSociability | null,
    cat_status: null,
    name: null,
    spot_last_seen: row[1] && row[1] !== "N/A" ? row[1] : null,
    caretaker: null,
    notes: null,
    is_adoptable: String(row[10] ?? "").toUpperCase() === "YES",
    photo_url: null,
    paws_id: row[2] && row[2] !== "" ? row[2] : null,
    condition: resolveCondition(isSick, isInjured),
    neuter_date: parseDate(row[11]),
    vaccination_date: parseDate(row[12]),
    tnvr_intervention: null,
    vet_intervention: null,
  };
}

async function importRegion(
  regionRecord: { id: string; name: string },
  sheets: ReturnType<typeof google.sheets>,
  resetY: boolean,
) {
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;
  const isUnknown = regionRecord.name === "UNKNOWN";

  if (resetY) {
    await withRetry(
      () =>
        sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `'${regionRecord.name}'!Y3:Y`,
        }),
      `[${regionRecord.name}] clear Y`,
    );
  }

  const response = await withRetry(
    () =>
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${regionRecord.name}'!A3:Y`,
      }),
    `[${regionRecord.name}] read`,
  );

  const rows = (response.data.values || []) as string[][];
  const rowsWithIdx = rows
    .map((r, idx) => ({ row: r, sheetRowNumber: idx + 3 }))
    .filter(({ row }) => row[0] && String(row[0]).trim() !== "");

  let maxId = Math.max(
    0,
    ...rowsWithIdx
      .map(({ row }) => parseCatalogId(String(row[0]).trim()))
      .filter((n): n is number => n !== null),
  );

  const uuidWrites: Array<{ row: number; uuid: string }> = [];
  let created = 0,
    skipped = 0,
    errors = 0;

  for (const { row, sheetRowNumber } of rowsWithIdx) {
    const existingUuid = String(row[24] ?? "").trim();
    if (UUID_RE.test(existingUuid)) {
      skipped++;
      continue;
    }

    const colA = String(row[0]).trim();
    const catalogBase = parseCatalogId(colA);
    const catalog_id =
      catalogBase !== null ? String(catalogBase) : String(++maxId);

    const uuid = randomUUID();

    try {
      const parsed = isUnknown
        ? parseUnknownRow(row, uuid)
        : parseStandardRow(row, uuid);

      const {
        condition,
        neuter_date,
        vaccination_date,
        paws_id,
        tnvr_intervention,
        vet_intervention,
        ...catFields
      } = parsed;

      await db.transaction(async (tx) => {
        await tx
          .insert(cats)
          .values({ ...catFields, catalog_id })
          .onConflictDoNothing();
        await tx
          .insert(catHealthRecords)
          .values({
            cat_id: uuid,
            condition,
            neuter_date,
            vaccination_date,
          })
          .onConflictDoNothing();
        await linkCatToSystemSession(uuid, regionRecord.id, tx);
        if (tnvr_intervention) {
          await tx
            .insert(interventions)
            .values({ cat_id: uuid, ...tnvr_intervention })
            .onConflictDoNothing();
        }
        if (vet_intervention) {
          await tx
            .insert(interventions)
            .values({ cat_id: uuid, ...vet_intervention })
            .onConflictDoNothing();
        }
      });

      uuidWrites.push({ row: sheetRowNumber, uuid });
      created++;
    } catch (error) {
      console.error(
        `  Row ${sheetRowNumber} error:`,
        error instanceof Error ? error.message : error,
      );
      errors++;
    }
  }

  if (uuidWrites.length > 0) {
    const batchData = uuidWrites.map(({ row, uuid }) => ({
      range: `'${regionRecord.name}'!Y${row}`,
      values: [[uuid]],
    }));
    await withRetry(
      () =>
        sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: { valueInputOption: "RAW", data: batchData },
        }),
      `[${regionRecord.name}] write`,
    );
  }

  return { created, skipped, errors };
}

async function main() {
  const resetY = process.argv.includes("--reset");
  console.log("Starting GSheets → DB import...");
  if (resetY) console.log("RESET MODE: clearing Y column UUIDs before import.");
  console.log("");

  console.log("Resetting Y column protections (service account only)...");
  await setupUuidProtections();
  console.log("");

  const { sheets } = await connectToSheets();
  const allRegions = await db.query.regions.findMany();
  // Guard: regions table has no unique constraint yet — deduplicate by name
  // so we don't process the same sheet tab multiple times.
  const seenNames = new Set<string>();
  const regions = allRegions.filter((r) => {
    if (seenNames.has(r.name)) return false;
    seenNames.add(r.name);
    return true;
  });
  if (regions.length < allRegions.length) {
    console.warn(
      `WARNING: ${allRegions.length - regions.length} duplicate region(s) found in DB and skipped. Clean up the regions table and add a unique constraint on name.`,
    );
  }

  let totalCreated = 0,
    totalSkipped = 0,
    totalErrors = 0;

  for (const region of regions) {
    console.log(`[${region.name}] Importing...`);
    try {
      const result = await importRegion(region, sheets, resetY);
      console.log(
        `  created: ${result.created}, skipped: ${result.skipped}, errors: ${result.errors}`,
      );
      totalCreated += result.created;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
    } catch (error) {
      console.error(
        `  Region failed:`,
        error instanceof Error ? error.message : error,
      );
      totalErrors++;
    }
  }

  console.log(
    `\nDone. Total created: ${totalCreated}, skipped: ${totalSkipped}, errors: ${totalErrors}`,
  );

  console.log("\nSyncing region sheet names to _config!B2...");
  await syncRegionSheetNames();
  console.log("Done. Run setupUuidProtection() in Apps Script to lock col Y.");

  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
