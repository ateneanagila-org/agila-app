import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { cats, catHealthRecords } from "@/lib/db/schema";
import { z } from "zod";
import { CatHealthRecordConditionEnum } from "../db/enums";
import { PHOTO_ROTATIONS } from "../photo-position";

// CAT HEALTH RECORDS
export const catHealthRecordsSchema = createSelectSchema(catHealthRecords);
export const createCatHealthRecordSchema = createInsertSchema(catHealthRecords);
export const getCatHealthRecordsSchema = catHealthRecordsSchema.partial();
export const editCatHealthRecordSchema = createInsertSchema(catHealthRecords)
  .partial()
  .required({ cat_id: true });
export const removeCatHealthRecordSchema = z.object({
  cat_id: z.string().uuid({ message: "Invalid Cat ID" }),
  region_id: z.string().uuid({ message: "Invalid Region ID" }),
});

// CATS;
export const catsSchema = createSelectSchema(cats);
export const createCatSchema = createInsertSchema(cats)
  .omit({
    last_updated_at: true,
    merged_into_id: true,
    entry_status: true,
    paws_id: true,
  })
  .extend({
    region_id: z.string(),
    condition: CatHealthRecordConditionEnum.nullable().optional(),
    is_neutered: z.boolean().nullable().optional(),
  });
export const getCatsSchema = catsSchema.partial();
export const editCatSchema = createInsertSchema(cats)
  .merge(editCatHealthRecordSchema.omit({ cat_id: true }))
  .partial()
  .required({ id: true })
  .extend({
    // Rendered rotation is quarter-turn only (see normalizeRotation in
    // lib/photo-position.ts) — reject anything else at the schema layer.
    // A plain `.refine` (no type predicate) keeps the inferred type as
    // `number`, matching what normalizeRotation's callers already produce.
    photo_rotation: z
      .number()
      .refine((v) => (PHOTO_ROTATIONS as readonly number[]).includes(v), {
        message: "photo_rotation must be 0, 90, 180, or 270",
      })
      .optional(),
  });
export const removeCatSchema = z.object({
  id: z.string().uuid({ message: "Invalid Cat ID" }),
});

// TYPES
export type InsertCat = typeof cats.$inferInsert;
export type SelectCat = typeof cats.$inferSelect;
export type CreateCatSchema = z.infer<typeof createCatSchema>;
export type GetCatsSchema = z.infer<typeof getCatsSchema>;
export type EditCatSchema = z.infer<typeof editCatSchema>;
export type RemoveCatSchema = z.infer<typeof removeCatSchema>;
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
export type RemoveCatHealthRecordSchema = z.infer<
  typeof removeCatHealthRecordSchema
>;
