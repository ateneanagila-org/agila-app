import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { cats, catHealthRecord } from "@/lib/db/schema";
import { z } from "zod";

// CATS
export const catsSchema = createSelectSchema(cats);
export const createCatSchema = createInsertSchema(cats).omit({
  id: true,
  last_updated_at: true,
  merged_into_id: true,
  entry_status: true,
});
export const getCatsSchema = catsSchema.partial();
export const editCatSchema = createInsertSchema(cats)
  .omit({ id: true, last_updated_at: true })
  .partial();

// CAT HEALTH RECORDS
export const catHealthRecordSchema = createSelectSchema(catHealthRecord);
export const createCatHealthRecordSchema = createInsertSchema(
  catHealthRecord,
).omit({ id: true, last_updated_at: true });
export const getCatHealthRecordsSchema = catHealthRecordSchema.partial();
export const editCatHealthRecordSchema = createInsertSchema(catHealthRecord)
  .omit({ id: true })
  .partial();

// TYPES
export type InsertCat = typeof cats.$inferInsert;
export type SelectCat = typeof cats.$inferSelect;
export type CreateCatSchema = z.infer<typeof createCatSchema>;
export type GetCatsSchema = z.infer<typeof getCatsSchema>;
export type EditCatSchema = z.infer<typeof editCatSchema>;
export type InsertCatHealthRecord = typeof catHealthRecord.$inferInsert;
export type SelectCatHealthRecord = typeof catHealthRecord.$inferSelect;
export type CreateCatHealthRecordSchema = z.infer<
  typeof createCatHealthRecordSchema
>;
export type GetCatHealthRecordsSchema = z.infer<
  typeof getCatHealthRecordsSchema
>;
export type EditCatHealthRecordSchema = z.infer<
  typeof editCatHealthRecordSchema
>;
