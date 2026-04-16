"use server";
import { db } from "@/lib/db";
import { gsheetSyncQueue } from "@/lib/db/schema";
import { syncAndCompactRegion } from "@/lib/services/helper.service";
import { eq } from "drizzle-orm";

export async function syncRegion(regionId: string) {
  await syncAndCompactRegion(regionId);
}

export async function syncAllPendingRegions() {
  const pendingTasks = await db
    .selectDistinct({ regionId: gsheetSyncQueue.regionId })
    .from(gsheetSyncQueue)
    .where(eq(gsheetSyncQueue.status, "PENDING"));

  await Promise.all(
    pendingTasks.map((task) => syncAndCompactRegion(task.regionId)),
  );
}
