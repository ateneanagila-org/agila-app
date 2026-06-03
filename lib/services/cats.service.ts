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
    const {
      id,
      condition,
      is_neutered,
      neuter_date,
      vaccination_date,
      ...catFields
    } = data;

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
  return await db.transaction(async (tx) => {
    const region = await sessionsRepo.resolveCatRegion(data.id, tx);

    await catsRepo.deleteCat(data.id, tx);

    if (region) {
      await tx.insert(gsheetSyncQueue).values({
        action: "DELETE",
        entityId: data.id,
        regionId: region.id,
        payload: [],
      });
    }

    return { success: true };
  });
};
