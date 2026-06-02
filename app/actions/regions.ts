"use server";
import { z } from "zod";
import { actionClient } from "@/lib/error/actions-handler";
import * as service from "@/lib/services/regions.service";
import * as regionsRepo from "@/lib/repo/regions.repo";
import { requireRole, requireAuth, ADMIN_ONLY } from "@/lib/auth/rbac";
import {
  createRegionSchema,
  renameRegionSchema,
  regionIdSchema,
  deleteRegionSchema,
} from "@/lib/validation/regions";

export const listRegions = actionClient
  .schema(z.object({}))
  .action(async () => {
    await requireAuth();
    return await regionsRepo.findRegions();
  });

export const createRegion = actionClient
  .schema(createRegionSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await service.createRegion({
      name: parsedInput.name,
      color: parsedInput.color ?? null,
    });
  });

export const renameRegion = actionClient
  .schema(renameRegionSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await service.renameRegion(parsedInput);
  });

export const setRegionArchived = actionClient
  .schema(regionIdSchema.extend({ archived: z.boolean() }))
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await service.setRegionArchived(parsedInput.id, parsedInput.archived);
  });

export const deleteRegion = actionClient
  .schema(deleteRegionSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await service.deleteRegion(parsedInput);
  });
