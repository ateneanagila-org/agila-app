import { db, DB } from "../db";
import { interventions } from "../db/schema";
import { eq } from "drizzle-orm";
import {
  InsertIntervention,
  SelectIntervention,
} from "../validation/interventions";
import { createEQFilters } from "./helper.repo";

export const findInterventions = (filters: Partial<SelectIntervention>) =>
  db.query.interventions.findMany({
    where: (cols, { and }) => {
      const conditions = createEQFilters(cols, filters);
      return conditions.length > 0 ? and(...conditions) : undefined;
    },
  });

export const insertIntervention = (data: InsertIntervention, client: DB = db) =>
  client.insert(interventions).values(data).returning();

export const updateIntervention = (
  id: string,
  data: Partial<InsertIntervention>,
  client: DB = db,
) =>
  client
    .update(interventions)
    .set({ ...data, last_updated_at: new Date() })
    .where(eq(interventions.id, id))
    .returning();

export const deleteIntervention = (id: string, client: DB = db) =>
  client.delete(interventions).where(eq(interventions.id, id)).returning();
