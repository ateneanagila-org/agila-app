"use server";
import { db } from "@/lib/db";
import { gsheetSyncQueue } from "@/lib/db/schema";
import { syncAndCompactRegion, generateForRiSheet, generateForFaSheet } from "@/lib/services/helper.service";
import { reverseSyncRegion } from "@/lib/services/reverse-sync.service";
import { importPhotosIfNeeded } from "@/lib/services/photo-import.service";
import { requireAuth } from "@/lib/auth/rbac";
import { eq } from "drizzle-orm";

export async function syncRegion(regionId: string) {
  await requireAuth();
  // Phase A: Reverse sync (import manual edits from GSheet)
  await reverseSyncRegion(regionId);
  // Phase C: Forward sync (push DB changes to GSheet)
  await syncAndCompactRegion(regionId);
}

export async function syncAllPendingRegions() {
  await requireAuth();
  const pendingTasks = await db
    .selectDistinct({ regionId: gsheetSyncQueue.regionId })
    .from(gsheetSyncQueue)
    .where(eq(gsheetSyncQueue.status, "PENDING"));

  const allRegions = await db.query.regions.findMany();

  // Phase 0: Photo import — detect pasted images before reverse/forward sync.
  // Reads sheet state per region, fires ZIP only when candidates found.
  // Must run before forward sync so col B gets the correct =IMAGE(url) formula.
  try {
    await importPhotosIfNeeded(allRegions);
  } catch (error) {
    console.error(
      "[PhotoImport] Failed:",
      error instanceof Error ? error.message : error,
    );
  }

  // Phase A: Reverse sync ALL regions (text fields only — photo_url excluded)
  for (const region of allRegions) {
    try {
      await reverseSyncRegion(region.id);
    } catch (error) {
      console.error(
        `[ReverseSync] Region ${region.id} failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Phase B: Forward sync only regions with pending tasks
  await Promise.all(
    pendingTasks.map((task) => syncAndCompactRegion(task.regionId)),
  );

  // Phase C: Regenerate summary sheets
  try {
    await generateForRiSheet();
    await generateForFaSheet();
    console.log("[SummarySheets] For RI + For FA regenerated");
  } catch (error) {
    console.error(
      "[SummarySheets] Failed:",
      error instanceof Error ? error.message : error,
    );
  }
}
