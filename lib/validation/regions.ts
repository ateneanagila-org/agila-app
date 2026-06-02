import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { regions } from "@/lib/db/schema";
import { z } from "zod";

const regionName = z
  .string()
  .trim()
  .min(1, "Region name is required")
  .max(60, "Region name too long");

export const regionsSchema = createSelectSchema(regions);

// createInsertSchema derives `color` (nullable RegionColor enum) directly from
// the regions table; `name` is overridden with trim + length validation.
export const createRegionSchema = createInsertSchema(regions)
  .pick({ color: true })
  .extend({ name: regionName });

export const renameRegionSchema = z.object({
  id: z.string().uuid(),
  name: regionName,
});

export const deleteRegionSchema = z.object({
  id: z.string().uuid(),
  /** Required to delete a populated region; ignored for empty ones. */
  force: z.boolean().optional(),
});

export type CreateRegionInput = z.infer<typeof createRegionSchema>;
export type RenameRegionInput = z.infer<typeof renameRegionSchema>;
export type DeleteRegionInput = z.infer<typeof deleteRegionSchema>;
