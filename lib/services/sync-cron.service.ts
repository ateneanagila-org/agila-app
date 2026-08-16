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

  // Phase 0: One paced read pass shared by photo-import, reverse-sync, and
  // reconciliation. `failed` names regions whose read threw.
  const { states: sheetStates, failed: failedRegions } =
    await readAllRegionSheetStates(allRegions);
  if (failedRegions.size > 0) {
    console.warn(
      `[Cron Sync] ${failedRegions.size} region read(s) failed this tick — reconciliation will skip.`,
    );
  }

  // Pending forward-sync tasks — queried once, used for both idle-exit and Phase 3.
  const pendingTasks = await db
    .selectDistinct({ regionId: gsheetSyncQueue.regionId })
    .from(gsheetSyncQueue)
    .where(eq(gsheetSyncQueue.status, "PENDING"));

  // Any region with non-empty col W in the snapshot? Both photo-import and
  // reverse-sync depend on this; if none, neither has work.
  let hasSheetEdits = false;
  for (const rows of sheetStates.values()) {
    if (rows.some((r) => r.lastEditedAt)) {
      hasSheetEdits = true;
      break;
    }
  }

  // Early-exit: no pending forward tasks AND no sheet-side edits → fully idle.
  // Skips photo-import, reverse-sync, forward-sync, and summary regen.
  if (pendingTasks.length === 0 && !hasSheetEdits) {
    console.log("[Cron Sync] Idle tick — no work to do.");
    return;
  }

  // Phase 1: Reverse sync — only regions with non-empty col W. Runs BEFORE photo
  // import so cats created from brand-new sheet rows exist in the DB before we
  // try to attach their imported photo (otherwise the photo orphans).
  const reverseResult = await reverseSyncRegionsFromState(sheetStates);

  // Phase 2: Photo import — non-fatal; alert Discord on failure.
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

  // Phase 3: Forward sync only regions with pending tasks. Merge each region's
  // post-write state into the snapshot so summary regen sees this tick's fresh
  // catalog numbers (e.g. newly assigned IDs).
  for (const task of pendingTasks) {
    const finalRows = await syncAndCompactRegion(task.regionId);
    if (finalRows) sheetStates.set(task.regionId, finalRows);
  }

  // Phase 4: Regenerate summary sheets only when something materially changed.
  // Photo-only changes don't affect For RI / For FA contents.
  const summariesNeedRegen =
    reverseResult.totalImported > 0 || pendingTasks.length > 0;
  if (!summariesNeedRegen) {
    console.log(
      "[SummarySheets] No catalog changes this tick — skipping regen.",
    );
    return;
  }

  try {
    await generateForRiSheet(sheetStates);
    await generateForFaSheet(sheetStates);
    console.log("[SummarySheets] For RI + For FA regenerated");
  } catch (error) {
    console.error("[SummarySheets] Failed:", errMsg(error));
  }
}
