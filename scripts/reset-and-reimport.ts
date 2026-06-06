import "dotenv/config";
import { db } from "@/lib/db";
import { cats, gsheetSyncQueue, syncAuditLog } from "@/lib/db/schema";
import { fullReverseSync } from "@/lib/services/reverse-sync.service";
import {
  refreshCatInSyncQueue,
  syncAndCompactRegion,
  generateForRiSheet,
  generateForFaSheet,
  type SheetRow,
} from "@/lib/services/helper.service";
import { isSyncFrozen } from "@/lib/services/system.service";
import {
  bulkImportAllNullPhotos,
  wipeAllPhotos,
} from "@/lib/services/photo-import.service";

async function main() {
  console.log("[Reset] Starting full reset and reimport...");

  // Step 0 (opt-in): Wipe the photo bucket. Re-seeding fresh col-Y UUIDs re-keys
  // every photo path, so prior objects would orphan (upsert only overwrites the
  // same path). Photos rebuild from the sheet xlsx in Step 4, so this is safe.
  // Gated behind --wipe-photos so routine reruns don't nuke a populated bucket;
  // pass it at cutover (new UUIDs) for a clean, orphan-free storage state.
  if (process.argv.includes("--wipe-photos")) {
    console.log("[Reset] --wipe-photos set — wiping photo bucket...");
    const { removed } = await wipeAllPhotos();
    console.log(`[Reset] Removed ${removed} photo object(s) from storage`);
  } else {
    console.log(
      "[Reset] Skipping photo-bucket wipe (pass --wipe-photos at cutover to clear orphans).",
    );
  }

  // Step 1: Wipe all cat data (cascades to catHealthRecords, interventions, sessionCats)
  console.log("[Reset] Deleting all cats...");
  const deleted = await db.delete(cats).returning({ id: cats.id });
  console.log(`[Reset] Deleted ${deleted.length} cats (cascades: health records, interventions, session_cats)`);

  // Step 2: Clear sync queue and audit log
  console.log("[Reset] Clearing sync queue and audit log...");
  await db.delete(gsheetSyncQueue);
  await db.delete(syncAuditLog);
  console.log("[Reset] Sync queue and audit log cleared");

  // Step 3: Full reverse sync — recreates all cats from all region sheets
  console.log("\n[Reset] Running full reverse sync...");
  const syncResult = await fullReverseSync(true);
  console.log(`[Reset] Reverse sync done: ${syncResult.regions} regions, ${syncResult.totalImported} cats imported, ${syncResult.totalErrors} errors`);
  if (syncResult.allErrors.length > 0) {
    console.log("[Reset] Sync errors:");
    for (const e of syncResult.allErrors) {
      console.log(`  [${e.region}] ${e.entityId}: ${e.error}`);
    }
  }

  // Step 4: Bulk photo import — downloads xlsx and imports all photos
  console.log("\n[Reset] Running bulk photo import...");
  const photoResult = await bulkImportAllNullPhotos();
  console.log(`[Reset] Photo import done: imported=${photoResult.imported} errors=${photoResult.errors.length}`);
  if (photoResult.errors.length > 0) {
    console.log("[Reset] Photo errors:", photoResult.errors.slice(0, 10));
  }

  // Step 5: Discard the redundant queue rows reverse-sync + photo import left
  // behind (each describes data we just read FROM the sheet — echoing it back
  // would burn write quota). We re-enqueue deliberately in Step 6.
  console.log("\n[Reset] Wiping post-import sync queue...");
  const wiped = await db.delete(gsheetSyncQueue).returning({ id: gsheetSyncQueue.id });
  console.log(`[Reset] Wiped ${wiped.length} redundant queue rows`);

  // Step 6: Global col-A snap. A plain reverse import leaves each sheet's
  // Column A exactly as the humans left it — so any stale status suffix (e.g.
  // "30" for a cat now Deceased, which inflates the HOME tab) survives the
  // reset. Here we forward-sync EVERY region from the DB: syncAndCompactRegion
  // re-stamps Column A's suffix from cat_status for every surviving row (the
  // catalog NUMBER is preserved from the sheet), rebuilds col B photos, sorts,
  // and compacts. Runs AFTER photo import so col B rebuilds from a populated
  // photo_url, not blank. This is the "snap everything into place" pass.
  console.log("\n[Reset] Global col-A snap: forward-syncing all regions...");
  if (await isSyncFrozen()) {
    console.warn(
      "[Reset] Sync is FROZEN — skipping the global snap + summary regen. " +
        "Unfreeze (Admin → GSheet Config → Unfreeze) and re-run, or the sheets " +
        "keep their stale Column A suffixes.",
    );
    console.log("\n[Reset] Complete (snap skipped).");
    process.exit(0);
  }
  const originalCats = await db.query.cats.findMany({
    where: (c, { eq }) => eq(c.entry_status, "Original"),
    columns: { id: true },
  });
  console.log(`[Reset] Enqueuing ${originalCats.length} Original cat(s)...`);
  await db.transaction(async (tx) => {
    let i = 0;
    for (const c of originalCats) {
      await refreshCatInSyncQueue(c.id, tx);
      if (++i % 50 === 0)
        console.log(`[Reset]   enqueued ${i}/${originalCats.length}`);
    }
  });
  console.log(`[Reset] Enqueue done. Forward-syncing region tabs (paced ~1.2s/Sheets call)...`);

  const allRegions = await db.query.regions.findMany();
  const snapshot = new Map<string, SheetRow[]>();
  let snappedRegions = 0;
  for (const region of allRegions) {
    const t0 = Date.now();
    console.log(`[Reset]   snapping '${region.name}'...`);
    const finalRows = await syncAndCompactRegion(region.id);
    console.log(
      `[Reset]   '${region.name}' done in ${((Date.now() - t0) / 1000).toFixed(1)}s` +
        ` (${finalRows ? finalRows.length + " rows" : "no pending tasks"})`,
    );
    if (finalRows) {
      snapshot.set(region.id, finalRows);
      snappedRegions++;
    }
  }
  console.log(
    `[Reset] Snapped ${snappedRegions}/${allRegions.length} region(s) (enqueued ${originalCats.length} cats)`,
  );

  // Step 7: Regenerate the For RI / For FA summary tabs from the freshly-snapped
  // state so they match the reconciled region tabs.
  console.log("\n[Reset] Regenerating summary sheets (For RI / For FA)...");
  await generateForRiSheet(snapshot);
  await generateForFaSheet(snapshot);
  console.log("[Reset] Summaries regenerated");

  // Step 8: Final queue cleanup — the snap marked its tasks COMPLETED; drop them
  // so the DB ends clean.
  console.log("\n[Reset] Final queue cleanup...");
  const cleaned = await db
    .delete(gsheetSyncQueue)
    .returning({ id: gsheetSyncQueue.id });
  console.log(`[Reset] Cleared ${cleaned.length} completed queue rows`);

  console.log("\n[Reset] Complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[Reset] Fatal:", err);
  process.exit(1);
});
