import { db } from "../db";
import * as repo from "../repo/interventions.repo";
import * as catsRepo from "../repo/cats.repo";
import { refreshCatInSyncQueue } from "./helper.service";
import {
  CreateInterventionSchema,
  EditInterventionSchema,
} from "../validation/interventions";
import { AppError } from "../error/app-error";

export const createIntervention = async (data: CreateInterventionSchema) => {
  return await db.transaction(async (tx) => {
    const [newIn] = await repo.insertIntervention(data, tx);
    await refreshCatInSyncQueue(data.cat_id, tx);
    await catsRepo.touchCat(data.cat_id, tx);
    return newIn;
  });
};

export const editIntervention = async (data: EditInterventionSchema) => {
  return await db.transaction(async (tx) => {
    const { id, ...updateData } = data;
    const [updated] = await repo.updateIntervention(id, updateData, tx);
    if (!updated) throw new AppError("Intervention not found");

    await refreshCatInSyncQueue(updated.cat_id, tx);
    await catsRepo.touchCat(updated.cat_id, tx);
    return updated;
  });
};

export const removeIntervention = async (id: string) => {
  return await db.transaction(async (tx) => {
    const [deleted] = await repo.deleteIntervention(id, tx);
    if (!deleted) throw new AppError("Intervention not found");

    await refreshCatInSyncQueue(deleted.cat_id, tx);
    await catsRepo.touchCat(deleted.cat_id, tx);
    return deleted;
  });
};
