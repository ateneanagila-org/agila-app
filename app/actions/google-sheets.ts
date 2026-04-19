"use server";
import { db } from "@/lib/db";
import { gsheetSyncQueue } from "@/lib/db/schema";
import { syncAndCompactRegion } from "@/lib/services/helper.service";
import { reverseSyncRegion } from "@/lib/services/reverse-sync.service";
import { eq } from "drizzle-orm";

export async function syncRegion(regionId: string) {
  // Phase A: Reverse sync (import manual edits from GSheet)
  await reverseSyncRegion(regionId);
  // Phase C: Forward sync (push DB changes to GSheet)
  await syncAndCompactRegion(regionId);
}

export async function syncAllPendingRegions() {
  const pendingTasks = await db
    .selectDistinct({ regionId: gsheetSyncQueue.regionId })
    .from(gsheetSyncQueue)
    .where(eq(gsheetSyncQueue.status, "PENDING"));

  const allRegions = await db.query.regions.findMany();

  // Phase A: Reverse sync ALL regions (manual edits can happen on any region)
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

  // Phase C: Forward sync only regions with pending tasks
  await Promise.all(
    pendingTasks.map((task) => syncAndCompactRegion(task.regionId)),
  );
}
