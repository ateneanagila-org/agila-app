/**
 * Read-only reconciliation report — confirms the sheet and the DB actually
 * agree after Tasks 5-6's auto-repair reconciliation. Writes nothing; this
 * is the diagnostic the handoff guide points at for "are they in sync?".
 *
 * Reports:
 *   1. Original cats present on no tab, with their effective region — split
 *      into a repairable section and an "unresolvable region" section (see
 *      below), since the two have very different remedies.
 *   2. Cats present on a tab that is not their effective region.
 *   3. Cats present on MORE THAN ONE tab at once (a duplicate listing) — the
 *      exact multi-tab drift the reconciler's `planRepairs` was written to
 *      catch. A last-writer-wins `uuid -> tab` map would silently collapse
 *      this to whichever tab was read last, so `onSheet` instead tracks
 *      every tab a UUID appears on.
 *   4. Sheet UUIDs with no matching Original cat.
 *   5. Rows whose col K holds "???" while the DB records a concrete
 *      is_adoptable — how the one known mis-recorded cat is found.
 *   6. A total: sheet UUID count vs Original cat count.
 *
 * A cat with no resolvable effective region (no override, no session) is
 * reported separately from ordinary "absent" drift: `reconcile.service.ts`'s
 * `reconcileSheetRepresentation` explicitly skips any row with a null
 * `region_id` (`if (!region_id) continue`), so nothing will ever repair
 * these — they need a manual region assignment, not another tick.
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

  // uuid -> every tab it was found on (NOT last-writer-wins — a UUID present
  // on two tabs at once must show up as a duplicate, not silently collapse
  // to whichever region happened to be read last).
  const onSheet = new Map<string, { regionId: string; colK: string }[]>();
  for (const region of allRegions) {
    const res = await glSheets.spreadsheets.values.get({
      auth: glAuth,
      spreadsheetId,
      range: `'${region.name}'!A3:Y`,
    });
    for (const row of res.data.values ?? []) {
      const uuid = String(row[24] ?? "").trim().toLowerCase();
      if (!UUID_RE.test(uuid)) continue;
      const locations = onSheet.get(uuid) ?? [];
      locations.push({ regionId: region.id, colK: String(row[10] ?? "").trim() });
      onSheet.set(uuid, locations);
    }
  }

  const expected = await findOriginalCatIdsByEffectiveRegion();
  const dbIds = new Set(expected.map((r) => r.cat_id.toLowerCase()));

  const absent: object[] = [];
  // Reconciliation explicitly skips rows with no resolvable region
  // (reconcile.service.ts: `if (!region_id) continue`), so these will never
  // clear on their own — split out so this section doesn't look "stuck".
  const unresolvableRegion: object[] = [];
  const wrongTab: object[] = [];
  const duplicateListing: object[] = [];
  for (const { cat_id, region_id } of expected) {
    const locations = onSheet.get(cat_id.toLowerCase());
    if (!locations || locations.length === 0) {
      if (region_id) {
        absent.push({ cat: cat_id.slice(0, 8), effectiveRegion: nameOf.get(region_id) });
      } else {
        unresolvableRegion.push({ cat: cat_id.slice(0, 8), effectiveRegion: "(none)" });
      }
      continue;
    }
    if (locations.length > 1) {
      duplicateListing.push({
        cat: cat_id.slice(0, 8),
        onTabs: locations.map((l) => nameOf.get(l.regionId)).join(", "),
        shouldBeOn: region_id ? nameOf.get(region_id) : "(none)",
      });
    }
    if (region_id && !locations.some((l) => l.regionId === region_id)) {
      wrongTab.push({
        cat: cat_id.slice(0, 8),
        onTab: locations.map((l) => nameOf.get(l.regionId)).join(", "),
        shouldBeOn: nameOf.get(region_id),
      });
    }
  }

  const orphans = [...onSheet.entries()].flatMap(([uuid, locations]) =>
    dbIds.has(uuid)
      ? []
      : locations.map((l) => ({ uuid: uuid.slice(0, 8), tab: nameOf.get(l.regionId) })),
  );

  // Col K holds the dropdown's "???" while the DB recorded a concrete value.
  // This is how the known mis-recorded cat is found.
  const unknownK: object[] = [];
  for (const [uuid, locations] of onSheet) {
    const flagged = locations.filter((l) => l.colK === "???");
    if (flagged.length === 0) continue;
    const [row] = await db
      .select({ is_adoptable: cats.is_adoptable })
      .from(cats)
      .where(eq(cats.id, uuid));
    if (row && row.is_adoptable !== null) {
      for (const { regionId, colK } of flagged) {
        unknownK.push({
          cat: uuid.slice(0, 8),
          tab: nameOf.get(regionId),
          colK,
          db_is_adoptable: row.is_adoptable,
        });
      }
    }
  }

  console.log(`\nSheet UUIDs: ${onSheet.size}   Original cats: ${expected.length}\n`);
  console.log("=== Original cats on NO tab ==="); console.table(absent);
  console.log("=== Original cats with NO resolvable region (reconciliation will never repair these — needs a manual region assignment) ===");
  console.table(unresolvableRegion);
  console.log("=== Cats on the WRONG tab ==="); console.table(wrongTab);
  console.log("=== Cats listed on MORE THAN ONE tab at once (duplicate listing) ==="); console.table(duplicateListing);
  console.log("=== Sheet rows with no Original cat ==="); console.table(orphans);
  console.log("=== col K '???' but DB has a concrete value ==="); console.table(unknownK);

  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
