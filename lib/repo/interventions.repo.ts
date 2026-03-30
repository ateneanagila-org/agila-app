import { db, DB } from "../db";
import { interventions } from "../db/schema";
import { eq } from "drizzle-orm";
import { InsertIntervention } from "../validation/interventions";

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
