import { and, eq } from "drizzle-orm";
import { db } from "../db";
import * as catsRepo from "../repo/cats.repo";
import * as sessionsRepo from "../repo/sessions.repo";
import { gsheetSyncQueue } from "../db/schema";
import {
  CreateCatSchema,
  EditCatSchema,
  RemoveCatSchema,
} from "../validation/cats";
import { refreshCatInSyncQueue } from "./helper.service"; // Use the helper
import { linkCatToSystemSession } from "./system-session.service";
import {
  photoStoragePath,
  removeCatPhotoObjects,
} from "./cat-photo-storage";
import { AppError } from "../error/app-error";

export const createCat = async (
  data: CreateCatSchema,
  opts?: { systemSession?: boolean },
) => {
  return await db.transaction(async (tx) => {
    const { condition, is_neutered, region_id, ...catTableData } = data;

    // Direct (system-session) creations come from trusted Manager/Admin flows
    // and skip the review queue; session-scoped creations stay "Unsubmitted"
    // until the volunteer finishes the session.
    const insertData = opts?.systemSession
      ? { ...catTableData, entry_status: "Original" as const }
      : catTableData;

    const [newCat] = await catsRepo.insertCat(insertData, tx);
    await catsRepo.insertCatHealthRecord(
      {
        cat_id: newCat.id,
        condition,
        is_neutered,
      },
      tx,
    );

    if (opts?.systemSession) {
      await linkCatToSystemSession(newCat.id, region_id, tx);
      await refreshCatInSyncQueue(newCat.id, tx); // only for direct creation — session link exists via system session
    }

    return newCat;
  });
};

export const editCat = async (data: EditCatSchema) => {
  return await db.transaction(async (tx) => {
    const { id, condition, is_neutered, neuter_date, vaccination_date, ...catFields } =
      data;

    // Capture the cat's effective region BEFORE the update so we can detect a
    // region move (override changed/cleared) and clean up the old sheet tab.
    const oldRegion = await sessionsRepo.resolveCatRegion(id, tx);

    const [updatedCat] = await catsRepo.updateCat(id, catFields, tx);
    await catsRepo.updateCatHealthRecord(
      id,
      {
        condition,
        is_neutered,
        neuter_date,
        vaccination_date,
      },
      tx,
    );

    if (!updatedCat) throw new AppError("Cat not found");

    // Merged duplicates must not appear on the sheet. Cancel any pending pushes
    // and queue a DELETE for the cat's region. With the Original-only gate in
    // refreshCatInSyncQueue, a freshly-merged Unreviewed entry was never synced,
    // so this is mainly a safety net for merging an already-synced (Original)
    // cat or cleaning up legacy rows — DELETE is a no-op when no row exists.
    if (updatedCat.entry_status === "Merged") {
      await tx
        .update(gsheetSyncQueue)
        .set({ status: "COMPLETED", lastError: "Superseded by merge" })
        .where(
          and(
            eq(gsheetSyncQueue.entityId, id),
            eq(gsheetSyncQueue.status, "PENDING"),
          ),
        );

      if (oldRegion) {
        await tx.insert(gsheetSyncQueue).values({
          action: "DELETE",
          entityId: id,
          regionId: oldRegion.id,
          payload: [],
        });
      }

      return updatedCat;
    }

    // CRITICAL FIX: We fetch the full state (including interventions)
    // before queueing, so we don't wipe out Columns S and T in the sheet.
    // refreshCatInSyncQueue queues the UPDATE to the NEW effective region and
    // returns it.
    const newRegion = await refreshCatInSyncQueue(id, tx);

    // Region move detected: clean up the old region's queue and sheet tab.
    if (oldRegion && oldRegion.id !== newRegion?.id) {
      // Cancel any PENDING tasks for this cat in the old region — they are now
      // superseded (UPDATEs would write stale data; a prior DELETE is replaced
      // by the new one below). Same pattern as GSheet-wins in reverse-sync.
      await tx
        .update(gsheetSyncQueue)
        .set({ status: "COMPLETED", lastError: "Superseded by region move" })
        .where(
          and(
            eq(gsheetSyncQueue.entityId, id),
            eq(gsheetSyncQueue.regionId, oldRegion.id),
            eq(gsheetSyncQueue.status, "PENDING"),
          ),
        );

      // Queue DELETE so the row is removed from the old region's sheet tab.
      await tx.insert(gsheetSyncQueue).values({
        action: "DELETE",
        entityId: id,
        regionId: oldRegion.id,
        payload: [],
      });
    }

    return updatedCat;
  });
};

export const removeCat = async (data: RemoveCatSchema) => {
  const deletedPhotoUrl = await db.transaction(async (tx) => {
    const region = await sessionsRepo.resolveCatRegion(data.id, tx);

    const [deleted] = await catsRepo.deleteCat(data.id, tx);

    // Only Original cats ever reached the regional sheet (see the Original-only
    // gate in refreshCatInSyncQueue). Queueing a DELETE for a never-synced draft
    // is a no-op on the sheet but still a PENDING task — and any PENDING task
    // wakes an otherwise-idle cron into a full sync+compact+summary-regen pass
    // (see syncAllPendingRegions' early-exit). Gate it to avoid that waste.
    if (region && deleted?.entry_status === "Original") {
      await tx.insert(gsheetSyncQueue).values({
        action: "DELETE",
        entityId: data.id,
        regionId: region.id,
        payload: [],
      });
    }

    return deleted?.photo_url ?? null;
  });

  // Best-effort, reference-aware storage cleanup AFTER commit. A merged cat's
  // photo may now belong to a surviving target, so only remove an object no
  // remaining cat references. Never throws — the GC sweep (reconcileCatPhotos)
  // is the safety net for anything missed here.
  const path = photoStoragePath(deletedPhotoUrl);
  if (path) {
    const stillReferenced = await catsRepo.findCatsReferencingPhotoPaths([path]);
    if (stillReferenced.length === 0) await removeCatPhotoObjects([path]);
  }

  return { success: true };
};
