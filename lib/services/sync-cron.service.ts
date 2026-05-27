import { db } from "@/lib/db";
import { gsheetSyncQueue } from "@/lib/db/schema";
import {
  syncAndCompactRegion,
  generateForRiSheet,
  generateForFaSheet,
  readAllRegionSheetStates,
} from "@/lib/services/helper.service";
import { reverseSyncRegionsFromState } from "@/lib/services/reverse-sync.service";
import { importPhotosIfNeeded } from "@/lib/services/photo-import.service";
import { sendSyncAlert } from "@/lib/services/discord.service";
import { eq } from "drizzle-orm";

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function syncAllPendingRegions() {
  const allRegions = await db.query.regions.findMany();

  // Phase 0: One paced read pass shared by photo-import and reverse-sync.
  const sheetStates = await readAllRegionSheetStates(allRegions);

  // Phase 1: Photo import — non-fatal; alert Discord on failure.
  try {
    await importPhotosIfNeeded(allRegions, sheetStates);
  } catch (error) {
    const msg = errMsg(error);
    console.error("[PhotoImport] Failed:", msg);
    try {
      await sendSyncAlert(`Photo import failed (non-fatal): ${msg}`);
    } catch (alertErr) {
      console.error("[PhotoImport] Alert delivery failed:", errMsg(alertErr));
    }
  }

  // Phase 2: Reverse sync — only regions with non-empty col W.
  await reverseSyncRegionsFromState(sheetStates);

  // Phase 3: Forward sync only regions with pending tasks.
  const pendingTasks = await db
    .selectDistinct({ regionId: gsheetSyncQueue.regionId })
    .from(gsheetSyncQueue)
    .where(eq(gsheetSyncQueue.status, "PENDING"));
  for (const task of pendingTasks) {
    await syncAndCompactRegion(task.regionId);
  }

  // Phase 4: Regenerate summary sheets — non-fatal.
  try {
    await generateForRiSheet();
    await generateForFaSheet();
    console.log("[SummarySheets] For RI + For FA regenerated");
  } catch (error) {
    console.error("[SummarySheets] Failed:", errMsg(error));
  }
}
