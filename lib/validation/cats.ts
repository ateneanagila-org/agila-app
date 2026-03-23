import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { cats, catHealthRecords } from "@/lib/db/schema";
import { z } from "zod";
import { CatHealthRecordConditionEnum } from "../db/enums";

// CATS
export const catsSchema = createSelectSchema(cats);
export const createCatSchema = createInsertSchema(cats)
  .omit({
    last_updated_at: true,
    merged_into_id: true,
    entry_status: true,
  })
  .extend({ region_id: z.string(), condition: CatHealthRecordConditionEnum });
export const getCatsSchema = catsSchema.partial();
export const editCatSchema = createInsertSchema(cats)
  .omit({ id: true, last_updated_at: true })
  .partial();

// CAT HEALTH RECORDS
export const catHealthRecordsSchema = createSelectSchema(catHealthRecords);
export const createCatHealthRecordSchema = createInsertSchema(
  catHealthRecords,
).omit({ id: true, last_updated_at: true });
export const getCatHealthRecordsSchema = catHealthRecordsSchema.partial();
export const editCatHealthRecordSchema = createInsertSchema(catHealthRecords)
  .omit({ id: true })
  .partial();

// TYPES
export type InsertCat = typeof cats.$inferInsert;
export type SelectCat = typeof cats.$inferSelect;
export type CreateCatSchema = z.infer<typeof createCatSchema>;
export type GetCatsSchema = z.infer<typeof getCatsSchema>;
export type EditCatSchema = z.infer<typeof editCatSchema>;
export type InsertCatHealthRecord = typeof catHealthRecords.$inferInsert;
export type SelectCatHealthRecord = typeof catHealthRecords.$inferSelect;
export type CreateCatHealthRecordSchema = z.infer<
  typeof createCatHealthRecordSchema
>;
export type GetCatHealthRecordsSchema = z.infer<
  typeof getCatHealthRecordsSchema
>;
export type EditCatHealthRecordSchema = z.infer<
  typeof editCatHealthRecordSchema
>;
