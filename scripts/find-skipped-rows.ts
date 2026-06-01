/**
 * One-shot diagnostic — finds rows in any region sheet that HOME counts
 * but reverse-sync skips. A row is "skipped" when col A is non-empty but
 * col Y (UUID) is blank/whitespace, so parseSheetRow returns null and the
 * row never reaches the DB.
 *
 * Usage: npx tsx scripts/find-skipped-rows.ts
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { regions } from "@/lib/db/schema";
import { connectToSheets } from "@/lib/services/helper.service";

async function main() {
  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;

  const allRegions = await db.select().from(regions);
  const skipped: Array<{
    region: string;
    rowIndex: number;
    colA: string;
    colC: string;
    colY: string;
  }> = [];

  // Track every UUID's appearances. A UUID appearing in >1 sheet means
  // only one inserts; the other silently updates the same row, so HOME
  // counts both occurrences but DB has only 1 cat.
  const uuidLocations = new Map<string, Array<{ region: string; rowIndex: number; colA: string }>>();

  // Track rows where col A is populated but col Y is malformed (not a UUID)
  const malformed: Array<{ region: string; rowIndex: number; colA: string; colY: string }> = [];
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  for (const region of allRegions) {
    try {
      const res = await glSheets.spreadsheets.values.get({
        auth: glAuth,
        spreadsheetId,
        range: `'${region.name}'!A3:Y`,
      });
      const rows = res.data.values ?? [];

      rows.forEach((row, i) => {
        const colA = String(row[0] ?? "").trim();
        const colY = String(row[24] ?? "").trim();
        // HOME counts this row (col A has content) but parser skips it (col Y blank)
        if (colA !== "" && colY === "") {
          skipped.push({
            region: region.name,
            rowIndex: i + 3,
            colA,
            colC: String(row[2] ?? "").trim(),
            colY,
          });
        }
        // Col A populated, col Y populated but not a valid UUID
        if (colA !== "" && colY !== "" && !uuidRe.test(colY)) {
          malformed.push({ region: region.name, rowIndex: i + 3, colA, colY });
        }
        // Index every UUID by where it appears
        if (colY !== "") {
          if (!uuidLocations.has(colY)) uuidLocations.set(colY, []);
          uuidLocations.get(colY)!.push({ region: region.name, rowIndex: i + 3, colA });
        }
      });

      console.log(`[Scan] ${region.name}: ${rows.length} rows`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[Scan] ${region.name}: FAILED — ${msg}`);
    }
  }

  console.log(`\n=== ${skipped.length} skipped rows (col A populated, col Y blank) ===`);
  console.table(skipped);

  console.log(`\n=== ${malformed.length} malformed col Y (populated but not a UUID) ===`);
  console.table(malformed);

  const dupes = [...uuidLocations.entries()].filter(([, locs]) => locs.length > 1);
  console.log(`\n=== ${dupes.length} UUIDs appearing in multiple sheets ===`);
  for (const [uuid, locs] of dupes) {
    console.log(`  ${uuid}:`);
    for (const loc of locs) console.log(`    ${loc.region} row ${loc.rowIndex} (colA=${loc.colA})`);
  }

  console.log(`\nTotal unique UUIDs across all sheets: ${uuidLocations.size}`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
