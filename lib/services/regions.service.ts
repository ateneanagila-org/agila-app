import { REGION_NAME_VALUES } from "../db/enums";
import * as regionsRepo from "../repo/regions.repo";

/**
 * Refreshes the regions table from the REGION_NAME_VALUES enum: inserts any
 * enum members that don't yet have a row. Idempotent (existing names skipped via
 * the unique `name` constraint) and additive — it never deletes a region, since
 * regions are FK-referenced by cats and sessions. Colors are left null for the
 * admin to edit afterward.
 */
export const syncRegionsFromEnum = async () => {
  const inserted = await regionsRepo.insertMissingRegions(REGION_NAME_VALUES);
  return {
    inserted: inserted.length,
    names: inserted.map((r) => r.name),
  };
};
