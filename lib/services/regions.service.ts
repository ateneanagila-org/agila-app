import * as regionsRepo from "../repo/regions.repo";
import * as catsRepo from "../repo/cats.repo";
import {
  createRegionSheetTab,
  renameRegionSheetTab,
  deleteRegionSheetTab,
  provisionRegionSheets,
  syncRegionSheetNames,
} from "./helper.service";
import { isSyncRetired } from "./system.service";
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

  // Once sync is retired, the spreadsheet is released for good — region CRUD
  // stays DB-only from here on and must not touch the sheet at all.
  if (!(await isSyncRetired())) {
    // Mirror the new region into _config!B2 from the DB BEFORE creating the
    // tab, so the Apps Script onChange guard (onSheetChange) sees the tab
    // we're about to create as a known region and does NOT flag it as a
    // hand-made orphan.
    await syncRegionSheetNames();

    // Create + provision the sheet tab (headers, protections, refreshes B2 again).
    await createRegionSheetTab(data.name);
    await provisionRegionSheets();
  }

  return region;
};

/**
 * Updates a region's name and/or colour.
 *
 * Only a genuine rename touches the spreadsheet — colour is app-side data, so a
 * colour-only edit performs no Sheets writes at all. Submitting the unchanged
 * name counts as no rename.
 */
export const updateRegion = async (data: {
  id: string;
  name?: string;
  color?: RegionColor | null;
}) => {
  const region = await regionsRepo.findRegionById(data.id);
  if (!region) throw new AppError("Region not found.");

  const nameChanged = data.name !== undefined && data.name !== region.name;

  if (nameChanged) {
    const clash = await regionsRepo.findRegionByName(data.name!);
    if (clash) throw new AppError(`Region "${data.name}" already exists.`);
  }

  const patch: { name?: string; color?: RegionColor | null } = {};
  if (nameChanged) patch.name = data.name;
  if (data.color !== undefined) patch.color = data.color;

  const [updated] =
    Object.keys(patch).length > 0
      ? await regionsRepo.updateRegion(data.id, patch)
      : [region];

  if (nameChanged && !(await isSyncRetired())) {
    // Sync matches tabs by name, so the tab must follow the rename.
    await renameRegionSheetTab(region.name, data.name!);
    await provisionRegionSheets();
  }

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

  if (!(await isSyncRetired())) {
    await deleteRegionSheetTab(region.name);
  }

  return { deletedRegion: region.name, deletedCats: orphanIds.length };
};
