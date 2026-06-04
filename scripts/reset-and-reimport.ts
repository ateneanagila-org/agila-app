import "dotenv/config";
import { db } from "@/lib/db";
import { cats, gsheetSyncQueue, syncAuditLog } from "@/lib/db/schema";
import { fullReverseSync } from "@/lib/services/reverse-sync.service";
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

  // Step 5: Wipe sync queue last. Both reverse-sync and bulk photo import call
  // refreshCatInSyncQueue per write — but every queued row describes data we
  // just read FROM the sheets (col B photos are =IMAGE(photo_url) formulas,
  // all other fields came from the same row). Flushing would echo identical
  // values back, burning write quota.
  console.log("\n[Reset] Wiping post-import sync queue...");
  const wiped = await db.delete(gsheetSyncQueue).returning({ id: gsheetSyncQueue.id });
  console.log(`[Reset] Wiped ${wiped.length} redundant queue rows`);

  console.log("\n[Reset] Complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[Reset] Fatal:", err);
  process.exit(1);
});
