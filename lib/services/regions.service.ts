import * as regionsRepo from "../repo/regions.repo";
import * as catsRepo from "../repo/cats.repo";
import {
  createRegionSheetTab,
  renameRegionSheetTab,
  deleteRegionSheetTab,
  provisionRegionSheets,
  syncRegionSheetNames,
} from "./helper.service";
import { db } from "../db";
import { AppError } from "../error/app-error";
import type { RegionColor } from "../db/enums";

export const createRegion = async (data: {
  name: string;
  color: RegionColor | null;
}) => {
  const existing = await regionsRepo.findRegionByName(data.name);
  if (existing) throw new AppError(`Region "${data.name}" already exists.`);

  const [region] = await regionsRepo.insertRegion({
    name: data.name,
    color: data.color ?? null,
  });

  // Mirror the new region into _config!B2 from the DB BEFORE creating the tab,
  // so the Apps Script onChange guard (onSheetChange) sees the tab we're about
  // to create as a known region and does NOT flag it as a hand-made orphan.
  await syncRegionSheetNames();

  // Create + provision the sheet tab (headers, protections, refreshes B2 again).
  await createRegionSheetTab(data.name);
  await provisionRegionSheets();

  return region;
};

export const renameRegion = async (data: { id: string; name: string }) => {
  const region = await regionsRepo.findRegionById(data.id);
  if (!region) throw new AppError("Region not found.");
  if (region.name === data.name) return region;

  const clash = await regionsRepo.findRegionByName(data.name);
  if (clash) throw new AppError(`Region "${data.name}" already exists.`);

  const oldName = region.name;
  const [updated] = await regionsRepo.updateRegionName(data.id, data.name);

  // Rename the sheet tab to keep sync (which matches tabs by name) working,
  // then refresh _config!B2.
  await renameRegionSheetTab(oldName, data.name);
  await provisionRegionSheets();

  return updated;
};

/**
 * Deletes a region. An empty region (no sessions, no cats pinned via override)
 * deletes freely. A non-empty region requires `force: true`; without it, throws
 * a plain-language warning for the UI to surface in a typed-confirm dialog.
 * With force: deletes the region (cascading its sessions + session_cats), then
 * deletes the cats that would be fully orphaned by that removal (see
 * findCatsOnlyInRegion — override-aware), then removes the sheet tab. FK cascade
 * is NOT used for cats — cats associate to regions via sessions and can span
 * regions, so orphaning is resolved in app logic.
 */
export const deleteRegion = async (data: { id: string; force?: boolean }) => {
  const region = await regionsRepo.findRegionById(data.id);
  if (!region) throw new AppError("Region not found.");

  const empty = await regionsRepo.isRegionEmpty(data.id);
  if (!empty && !data.force) {
    throw new AppError(
      `Region "${region.name}" is not empty. Deleting it permanently removes the region, all of its sessions, and any cats that exist only in this zone. This cannot be undone.`,
    );
  }

  const orphanIds = empty ? [] : await regionsRepo.findCatsOnlyInRegion(data.id);

  await db.transaction(async (tx) => {
    // Deleting the region cascades its sessions + session_cats (schema FKs).
    await regionsRepo.deleteRegion(data.id, tx);
    if (orphanIds.length > 0) await catsRepo.deleteCatsByIds(orphanIds, tx);
  });

  await deleteRegionSheetTab(region.name);

  return { deletedRegion: region.name, deletedCats: orphanIds.length };
};
