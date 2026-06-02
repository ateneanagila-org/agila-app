import * as regionsRepo from "../repo/regions.repo";
import {
  createRegionSheetTab,
  renameRegionSheetTab,
  provisionRegionSheets,
} from "./helper.service";
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

  // Create + provision the sheet tab (headers, protections, _config!B2).
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

export const setRegionArchived = async (id: string, archived: boolean) => {
  const region = await regionsRepo.findRegionById(id);
  if (!region) throw new AppError("Region not found.");
  const [updated] = await regionsRepo.setRegionArchived(id, archived);
  // Archiving leaves the sheet tab in place (history preserved); refresh B2 so
  // the list reflects active regions if downstream consumers care.
  return updated;
};
