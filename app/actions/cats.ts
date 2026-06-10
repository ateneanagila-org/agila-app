"use server";
import { actionClient } from "@/lib/error/actions-handler";
import * as repo from "@/lib/repo/cats.repo";
import * as interventionsRepo from "@/lib/repo/interventions.repo";
import * as service from "@/lib/services/cats.service";
import {
  requireAuth,
  requireRole,
  MANAGER_OR_ADMIN,
} from "@/lib/auth/rbac";
import {
  getCatsSchema,
  editCatSchema,
  createCatSchema,
  getCatHealthRecordsSchema,
  removeCatSchema,
} from "@/lib/validation/cats";
import { z } from "zod";

// CATS
export const createCat = actionClient
  .schema(createCatSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...MANAGER_OR_ADMIN);
    return await service.createCat(parsedInput, { systemSession: true });
  });

export const getCats = actionClient
  .schema(getCatsSchema)
  .action(async ({ parsedInput }) => {
    await requireAuth();
    return await repo.findCats(parsedInput);
  });

// Single-call cat detail loader. Authenticates ONCE then fans out the three
// detail queries in parallel server-side — replaces 3 separate client actions
// that each re-validated the JWT against the auth server on every navigation.
export const getCatDetail = actionClient
  .schema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput: { id } }) => {
    await requireAuth();
    const [catRows, healthRecords, interventions] = await Promise.all([
      repo.findCats({ id }),
      repo.findCatHealthRecords({ cat_id: id }),
      interventionsRepo.findInterventions({ cat_id: id }),
    ]);
    return {
      cat: catRows[0] ?? null,
      healthRecord: healthRecords[0] ?? null,
      interventions,
    };
  });

export const editCat = actionClient
  .schema(editCatSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...MANAGER_OR_ADMIN);
    return await service.editCat(parsedInput);
  });

export const removeCat = actionClient
  .schema(removeCatSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...MANAGER_OR_ADMIN);
    return await service.removeCat(parsedInput);
  });

export const approveCat = actionClient
  .schema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    await requireRole(...MANAGER_OR_ADMIN);
    return await service.editCat({ id: parsedInput.id, entry_status: "Original" });
  });

// CAT HEALTH RECORDS
export const getCatHealthRecords = actionClient
  .schema(getCatHealthRecordsSchema)
  .action(async ({ parsedInput }) => {
    await requireAuth();
    return await repo.findCatHealthRecords(parsedInput);
  });

// PUBLIC (no auth) — catalog of adoptable cats only.
// Server-side forces is_adoptable=true so callers can't read the full DB.
export const getAdoptableCats = actionClient
  .schema(getCatsSchema)
  .action(async ({ parsedInput }) => {
    return await repo.findAdoptableCats({ ...parsedInput, is_adoptable: true });
  });

export const getAdoptableCatHealthRecord = actionClient
  .schema(z.object({ cat_id: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    // Confirm the parent cat is actually adoptable before exposing health data.
    const parent = await repo.findAdoptableCats({ id: parsedInput.cat_id, is_adoptable: true });
    if (parent.length === 0) return [];
    return await repo.findCatHealthRecords({ cat_id: parsedInput.cat_id });
  });
