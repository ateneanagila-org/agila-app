import { db } from "../db";
import { regions } from "../db/schema";
import type { RegionName } from "../db/enums";
export const findRegions = () =>
  db.select({ id: regions.id, name: regions.name }).from(regions);

/**
 * Inserts the given region names, skipping any that already exist (unique
 * `name` constraint). Additive only — never deletes. `id` is auto-generated and
 * `color` is left null for manual editing. Returns the rows actually inserted.
 */
export const insertMissingRegions = (names: readonly RegionName[]) =>
  db
    .insert(regions)
    .values(names.map((name) => ({ name })))
    .onConflictDoNothing({ target: regions.name })
    .returning({ id: regions.id, name: regions.name });

export const findRegionById = (id: string) =>
  db.query.regions.findFirst({ where: (r, { eq }) => eq(r.id, id) });

export type RegionOption = Awaited<ReturnType<typeof findRegions>>[number];
