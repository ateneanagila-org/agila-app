/**
 * Read-only reconciliation report — confirms the sheet and the DB actually
 * agree after Tasks 5-6's auto-repair reconciliation. Writes nothing; this
 * is the diagnostic the handoff guide points at for "are they in sync?".
 *
 * Reports:
 *   1. Original cats present on no tab, with their effective region.
 *   2. Cats present on a tab that is not their effective region.
 *   3. Sheet UUIDs with no matching Original cat.
 *   4. Rows whose col K holds "???" while the DB records a concrete
 *      is_adoptable — how the one known mis-recorded cat is found.
 *   5. A total: sheet UUID count vs Original cat count.
 *
 * Usage: pnpm tsx scripts/reconcile-sheet.ts
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { regions, cats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { connectToSheets } from "@/lib/services/helper.service";
import { findOriginalCatIdsByEffectiveRegion } from "@/lib/repo/cats.repo";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;
  const allRegions = await db.select().from(regions);
  const nameOf = new Map(allRegions.map((r) => [r.id, r.name]));

  // uuid -> { regionId, colK }
  const onSheet = new Map<string, { regionId: string; colK: string }>();
  for (const region of allRegions) {
    const res = await glSheets.spreadsheets.values.get({
      auth: glAuth,
      spreadsheetId,
      range: `'${region.name}'!A3:Y`,
    });
    for (const row of res.data.values ?? []) {
      const uuid = String(row[24] ?? "").trim().toLowerCase();
      if (!UUID_RE.test(uuid)) continue;
      onSheet.set(uuid, {
        regionId: region.id,
        colK: String(row[10] ?? "").trim(),
      });
    }
  }

  const expected = await findOriginalCatIdsByEffectiveRegion();
  const dbIds = new Set(expected.map((r) => r.cat_id.toLowerCase()));

  const absent: object[] = [];
  const wrongTab: object[] = [];
  for (const { cat_id, region_id } of expected) {
    const found = onSheet.get(cat_id.toLowerCase());
    if (!found) {
      absent.push({
        cat: cat_id.slice(0, 8),
        effectiveRegion: region_id ? nameOf.get(region_id) : "(none)",
      });
    } else if (region_id && found.regionId !== region_id) {
      wrongTab.push({
        cat: cat_id.slice(0, 8),
        onTab: nameOf.get(found.regionId),
        shouldBeOn: nameOf.get(region_id),
      });
    }
  }

  const orphans = [...onSheet.keys()]
    .filter((u) => !dbIds.has(u))
    .map((u) => ({ uuid: u.slice(0, 8), tab: nameOf.get(onSheet.get(u)!.regionId) }));

  // Col K holds the dropdown's "???" while the DB recorded a concrete value.
  // This is how the known mis-recorded cat is found.
  const unknownK: object[] = [];
  for (const [uuid, { regionId, colK }] of onSheet) {
    if (colK !== "???") continue;
    const [row] = await db
      .select({ is_adoptable: cats.is_adoptable })
      .from(cats)
      .where(eq(cats.id, uuid));
    if (row && row.is_adoptable !== null) {
      unknownK.push({
        cat: uuid.slice(0, 8),
        tab: nameOf.get(regionId),
        colK,
        db_is_adoptable: row.is_adoptable,
      });
    }
  }

  console.log(`\nSheet UUIDs: ${onSheet.size}   Original cats: ${expected.length}\n`);
  console.log("=== Original cats on NO tab ==="); console.table(absent);
  console.log("=== Cats on the WRONG tab ==="); console.table(wrongTab);
  console.log("=== Sheet rows with no Original cat ==="); console.table(orphans);
  console.log("=== col K '???' but DB has a concrete value ==="); console.table(unknownK);

  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
