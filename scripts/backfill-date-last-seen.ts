import "dotenv/config";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { cats, regions } from "@/lib/db/schema";
import { connectToSheets } from "@/lib/services/helper.service";

/**
 * One-time reconcile: seed cats.date_last_seen from the GSheet's col N (the real
 * historical sighting dates the app never imported). Null-gated → only fills
 * where the column is currently null, so it NEVER clobbers app/test data and is
 * safe to re-run. Skips UNKNOWN (no col N).
 *
 * Dry-run by default (prints what it WOULD do). Pass --apply to write.
 *   pnpm tsx scripts/backfill-date-last-seen.ts          # preview
 *   pnpm tsx scripts/backfill-date-last-seen.ts --apply  # write
 */
const APPLY = process.argv.includes("--apply");

/** Col N is written via toLocaleDateString("en-US") → "M/D/YYYY". */
function parseSheetDate(s: unknown): Date | null {
  const t = String(s ?? "").trim();
  if (!t || t === "N/A") return null;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;
  const allRegions = await db.select().from(regions);

  let scanned = 0;
  let noUuid = 0;
  let noDate = 0;
  let wouldFill = 0;
  let filled = 0;
  let alreadySet = 0;
  let notInDb = 0;

  for (const region of allRegions) {
    if (region.name === "UNKNOWN") continue; // different layout, no col N
    const res = await glSheets.spreadsheets.values.get({
      auth: glAuth,
      spreadsheetId,
      range: `'${region.name}'!A3:Y`,
    });
    const rows = res.data.values ?? [];

    for (const row of rows) {
      scanned++;
      const uuid = String(row[24] ?? "").trim(); // col Y
      if (!uuid) {
        noUuid++;
        continue;
      }
      const date = parseSheetDate(row[13]); // col N
      if (!date) {
        noDate++;
        continue;
      }

      if (APPLY) {
        const updated = await db
          .update(cats)
          .set({ date_last_seen: date })
          .where(and(eq(cats.id, uuid), isNull(cats.date_last_seen)))
          .returning({ id: cats.id });
        if (updated.length > 0) filled++;
        else {
          // Either the cat already has a date, or it isn't in the DB.
          const existing = await db.query.cats.findFirst({
            where: (c, { eq }) => eq(c.id, uuid),
            columns: { id: true },
          });
          if (existing) alreadySet++;
          else notInDb++;
        }
      } else {
        const existing = await db.query.cats.findFirst({
          where: (c, { eq }) => eq(c.id, uuid),
          columns: { date_last_seen: true },
        });
        if (!existing) notInDb++;
        else if (existing.date_last_seen === null) wouldFill++;
        else alreadySet++;
      }
    }
  }

  console.log(`\n=== Backfill date_last_seen (${APPLY ? "APPLY" : "DRY RUN"}) ===`);
  console.log(`Rows scanned (excl. UNKNOWN): ${scanned}`);
  console.log(`  skipped — no UUID (col Y):  ${noUuid}`);
  console.log(`  skipped — no/invalid col N: ${noDate}`);
  console.log(`  already had a date:         ${alreadySet}`);
  console.log(`  UUID not in DB:             ${notInDb}`);
  console.log(
    APPLY ? `  FILLED (was null):          ${filled}` : `  WOULD fill (null):          ${wouldFill}`,
  );
  if (!APPLY) console.log(`\nRe-run with --apply to write.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
