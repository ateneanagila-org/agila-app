import { DB, db } from "../db";
import { gsheetSyncQueue } from "../db/schema";
import { and, eq } from "drizzle-orm";

/** Cat ids with a PENDING forward-sync task. */
export const findPendingSyncCatIds = (client: DB = db): Promise<string[]> =>
  client
    .selectDistinct({ entityId: gsheetSyncQueue.entityId })
    .from(gsheetSyncQueue)
    .where(eq(gsheetSyncQueue.status, "PENDING"))
    .then((rows) => rows.map((r) => r.entityId));

/**
 * Marks a cat's PENDING tasks for ONE region as COMPLETED with a reason.
 * Scoped to a single region on purpose: a region move must not cancel tasks
 * already queued against the destination.
 */
export const supersedePendingTasks = (
  catId: string,
  regionId: string,
  reason: string,
  client: DB = db,
) =>
  client
    .update(gsheetSyncQueue)
    .set({ status: "COMPLETED", lastError: reason })
    .where(
      and(
        eq(gsheetSyncQueue.entityId, catId),
        eq(gsheetSyncQueue.regionId, regionId),
        eq(gsheetSyncQueue.status, "PENDING"),
      ),
    );

/** Queues a DELETE so a stale row is removed from a region's tab. */
export const insertDeleteTask = (
  catId: string,
  regionId: string,
  payload: string[],
  client: DB = db,
) =>
  client.insert(gsheetSyncQueue).values({
    action: "DELETE",
    entityId: catId,
    regionId,
    payload,
  });
