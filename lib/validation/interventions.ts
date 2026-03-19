import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { interventions } from "@/lib/db/schema";
import { z } from "zod";

export const interventionsSchema = createSelectSchema(interventions);
export const createInterventionSchema = createInsertSchema(interventions).omit({
  id: true,
  last_updated_at: true,
  requested_at: true,
});
export const getInterventionsSchema = interventionsSchema.partial();
export const editInterventionSchema = createInterventionSchema.partial();

// TYPES
export type InsertIntervention = typeof interventions.$inferInsert;
export type SelectIntervention = typeof interventions.$inferSelect;
export type CreateInterventionSchema = z.infer<typeof createInterventionSchema>;
export type GetInterventionsSchema = z.infer<typeof getInterventionsSchema>;
export type EditInterventionSchema = z.infer<typeof editInterventionSchema>;
