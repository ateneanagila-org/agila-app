import { db } from "../db";
import { interventions } from "../db/schema";
import { eq } from "drizzle-orm";
import { createEQFilters } from "./helper.repo";
import {
  InsertIntervention,
  SelectIntervention,
} from "../validation/interventions";

// INTERVENTIONS
// These are general CRUD; you can make more specific ones depending on frontend
export const findInterventions = (filters: Partial<SelectIntervention>) =>
  db.query.interventions.findMany({
    where: (cols, { and }) => {
      const conditions = createEQFilters(cols, filters);
      return conditions.length > 0 ? and(...conditions) : undefined;
    },
  });

export const insertIntervention = (data: InsertIntervention) =>
  db.insert(interventions).values(data);

export const updateIntervention = (
  id: string,
  data: Partial<InsertIntervention>,
) =>
  db
    .update(interventions)
    .set({ ...data, last_updated_at: new Date() })
    .where(eq(interventions.id, id));

export const deleteIntervention = (id: string) =>
  db.delete(interventions).where(eq(interventions.id, id));
