import { db } from "../db";
import * as catsRepo from "../repo/cats.repo";
import { gsheetSyncQueue } from "../db/schema";
import {
  CreateCatSchema,
  EditCatSchema,
  RemoveCatSchema,
} from "../validation/cats";
import { refreshCatInSyncQueue } from "./helper.service"; // Use the helper
import { AppError } from "../error/app-error";

export const createCat = async (data: CreateCatSchema) => {
  return await db.transaction(async (tx) => {
    const { condition, ...catTableData } = data;

    const [newCat] = await catsRepo.insertCat(catTableData, tx);
    await catsRepo.insertCatHealthRecord(
      {
        cat_id: newCat.id,
        condition,
      },
      tx,
    );

    // For a brand new cat, we can refresh the queue immediately
    await refreshCatInSyncQueue(newCat.id, tx);

    return newCat;
  });
};

export const editCat = async (data: EditCatSchema) => {
  return await db.transaction(async (tx) => {
    const { id, condition, neuter_date, vaccination_date, ...catFields } = data;

    const [updatedCat] = await catsRepo.updateCat(id, catFields, tx);
    await catsRepo.updateCatHealthRecord(
      id,
      {
        condition,
        neuter_date,
        vaccination_date,
      },
      tx,
    );

    if (!updatedCat) throw new AppError("Cat not found");

    // CRITICAL FIX: We fetch the full state (including interventions)
    // before queueing, so we don't wipe out Columns S and T in the sheet.
    await refreshCatInSyncQueue(id, tx);

    return updatedCat;
  });
};

export const removeCat = async (data: RemoveCatSchema) => {
  return await db.transaction(async (tx) => {
    await catsRepo.deleteCat(data.id, tx);

    await tx.insert(gsheetSyncQueue).values({
      action: "DELETE",
      entityId: data.id,
      regionId: data.region_id,
      payload: [],
    });

    return { success: true };
  });
};
