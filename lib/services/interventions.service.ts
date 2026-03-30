import { db, Transaction } from "../db"; // Import the Transaction type we made
import * as repo from "../repo/interventions.repo";
import * as sessionsRepo from "../repo/sessions.repo";
import { gsheetSyncQueue } from "../db/schema";
import { mapCatToSheetRow } from "./helper.service";
import {
  CreateInterventionSchema,
  EditInterventionSchema,
} from "../validation/interventions";
import { AppError } from "../error/app-error";

/**
 * Helper: Fetches full Cat state and pushes a single UPDATE task to the queue
 */
async function refreshCatInSyncQueue(catId: string, tx: Transaction) {
  const cat = await tx.query.cats.findFirst({
    where: (cols, { eq }) => eq(cols.id, catId),
    with: {
      catHealthRecords: true,
      interventions: true,
    },
  });

  if (!cat) return;

  const region = await sessionsRepo.findCatRegionByLatestSession(catId, tx);
  if (!region) return;

  // Pass 'cat.catHealthRecords' instead of 'cat.healthRecord'
  const rowData = mapCatToSheetRow(
    cat,
    cat.catHealthRecords,
    cat.interventions,
  );

  await tx.insert(gsheetSyncQueue).values({
    action: "UPDATE",
    entityId: catId,
    regionId: region.id,
    payload: rowData,
  });
}
export const createIntervention = async (data: CreateInterventionSchema) => {
  // db.transaction provides a 'tx' of type Transaction
  return await db.transaction(async (tx) => {
    const [newIn] = await repo.insertIntervention(data, tx);
    await refreshCatInSyncQueue(data.cat_id, tx);
    return newIn;
  });
};

export const editIntervention = async (data: EditInterventionSchema) => {
  return await db.transaction(async (tx) => {
    const { id, ...updateData } = data;
    const [updated] = await repo.updateIntervention(id, updateData, tx);
    if (!updated) throw new AppError("Intervention not found");

    await refreshCatInSyncQueue(updated.cat_id, tx);
    return updated;
  });
};

export const removeIntervention = async (id: string) => {
  return await db.transaction(async (tx) => {
    const [deleted] = await repo.deleteIntervention(id, tx);
    if (!deleted) throw new AppError("Intervention not found");

    await refreshCatInSyncQueue(deleted.cat_id, tx);
    return deleted;
  });
};
