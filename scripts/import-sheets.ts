// scripts/import-sheets.ts
// One-time bulk import. Run with: pnpm tsx scripts/import-sheets.ts
// Requires .env.local with all required env vars.

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { google } from "googleapis";
import { db } from "@/lib/db";
import { cats, catHealthRecords } from "@/lib/db/schema";
import {
  CATHEALTHRECORD_CONDITION_VALUES,
  CAT_COLOR_VALUES,
  CAT_AGE_VALUES,
  CAT_SEX_VALUES,
  CAT_SOCIABILITY_VALUES,
  CAT_STATUS_VALUES,
} from "@/lib/db/enums";
import { parseCatalogId } from "@/lib/services/catalog.service";
import { linkCatToSystemSession } from "@/lib/services/system-session.service";
import { syncRegionSheetNames } from "@/lib/services/helper.service";
import { randomUUID } from "crypto";

type ConditionValue = (typeof CATHEALTHRECORD_CONDITION_VALUES)[number];
type CatColor = (typeof CAT_COLOR_VALUES)[number];
type CatAge = (typeof CAT_AGE_VALUES)[number];
type CatSex = (typeof CAT_SEX_VALUES)[number];
type CatSociability = (typeof CAT_SOCIABILITY_VALUES)[number];
type CatStatus = (typeof CAT_STATUS_VALUES)[number];

type CatInsert = typeof cats.$inferInsert;
type ParsedRow = CatInsert & {
  condition: ConditionValue;
  neuter_date: Date | null;
  vaccination_date: Date | null;
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

function resolveCondition(isSick: boolean, isInjured: boolean): ConditionValue {
  if (isSick && isInjured) return "Sick and Injured";
  if (isSick) return "Sick";
  if (isInjured) return "Injured";
  return "Healthy";
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
    color: (VALID_COLORS.includes(colorStr) ? colorStr : null) as CatColor | null,
    age: (VALID_AGES.includes(ageStr) ? ageStr : null) as CatAge | null,
    sex: (VALID_SEXES.includes(sexStr) ? sexStr : "Unknown") as CatSex,
    sociability: (VALID_SOCIABILITIES.includes(socStr) ? socStr : "Unknown") as CatSociability,
    cat_status: (VALID_STATUSES.includes(statusStr) ? statusStr : null) as CatStatus | null,
    name: row[2] && row[2] !== "N/A" ? row[2] : null,
    spot_last_seen: row[14] && row[14] !== "N/A" ? row[14] : null,
    caretaker: row[12] && row[12] !== "N/A" ? row[12] : null,
    notes: row[17] && row[17] !== "N/A" ? row[17] : null,
    is_adoptable: String(row[10] ?? "").toUpperCase() === "YES",
    photo_url: null,
    paws_id: null,
    condition: resolveCondition(isSick, isInjured),
    neuter_date: row[15] && row[15] !== "N/A" ? new Date(row[15]) : null,
    vaccination_date: row[16] && row[16] !== "N/A" ? new Date(row[16]) : null,
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
    color: (VALID_COLORS.includes(colorStr) ? colorStr : null) as CatColor | null,
    age: (VALID_AGES.includes(ageStr) ? ageStr : null) as CatAge | null,
    sex: (VALID_SEXES.includes(sexStr) ? sexStr : "Unknown") as CatSex,
    sociability: (VALID_SOCIABILITIES.includes(socStr) ? socStr : "Unknown") as CatSociability,
    cat_status: null,
    name: null,
    spot_last_seen: row[1] && row[1] !== "N/A" ? row[1] : null,
    caretaker: null,
    notes: null,
    is_adoptable: String(row[10] ?? "").toUpperCase() === "YES",
    photo_url: null,
    paws_id: row[2] && row[2] !== "" ? row[2] : null,
    condition: resolveCondition(isSick, isInjured),
    neuter_date: row[11] && row[11] !== "N/A" ? new Date(row[11]) : null,
    vaccination_date: row[12] && row[12] !== "N/A" ? new Date(row[12]) : null,
  };
}

async function importRegion(
  regionRecord: { id: string; name: string },
  sheets: ReturnType<typeof google.sheets>,
) {
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;
  const isUnknown = regionRecord.name === "UNKNOWN";

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${regionRecord.name}'!A3:X`,
  });

  const rows = (response.data.values || []) as string[][];
  const dataRows = rows.filter((r) => r[0] && String(r[0]).trim() !== "");

  let maxId = Math.max(
    0,
    ...dataRows
      .map((r) => parseCatalogId(String(r[0]).trim()))
      .filter((n): n is number => n !== null),
  );

  const uuidWrites: Array<{ row: number; uuid: string }> = [];
  let created = 0,
    errors = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const colA = String(row[0]).trim();
    const catalogBase = parseCatalogId(colA);
    const catalog_id =
      catalogBase !== null ? String(catalogBase) : String(++maxId);

    const uuid = randomUUID();
    const sheetRowNumber = i + 3;

    try {
      const parsed = isUnknown
        ? parseUnknownRow(row, uuid)
        : parseStandardRow(row, uuid);

      const { condition, neuter_date, vaccination_date, paws_id, ...catFields } =
        parsed;

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
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: batchData },
    });
  }

  return { created, errors };
}

async function main() {
  console.log("Starting GSheets → DB import...\n");

  const { sheets } = await connectToSheets();
  const allRegions = await db.query.regions.findMany();

  let totalCreated = 0,
    totalErrors = 0;

  for (const region of allRegions) {
    console.log(`[${region.name}] Importing...`);
    try {
      const result = await importRegion(region, sheets);
      console.log(`  created: ${result.created}, errors: ${result.errors}`);
      totalCreated += result.created;
      totalErrors += result.errors;
    } catch (error) {
      console.error(
        `  Region failed:`,
        error instanceof Error ? error.message : error,
      );
      totalErrors++;
    }
  }

  console.log(`\nDone. Total created: ${totalCreated}, errors: ${totalErrors}`);

  console.log("\nSyncing region sheet names to _config!B2...");
  await syncRegionSheetNames();
  console.log("Done. Run setupUuidProtection() in Apps Script to lock col Y.");

  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
