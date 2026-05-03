import "dotenv/config";
import { db } from "@/lib/db";
import { cats, gsheetSyncQueue, syncAuditLog } from "@/lib/db/schema";
import { fullReverseSync } from "@/lib/services/reverse-sync.service";
import { bulkImportAllNullPhotos } from "@/lib/services/photo-import.service";

async function main() {
  console.log("[Reset] Starting full reset and reimport...");

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

  console.log("\n[Reset] Complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[Reset] Fatal:", err);
  process.exit(1);
});
