"use server";
import { actionClient } from "@/lib/error/actions-handler";
import * as repo from "@/lib/repo/cats.repo";
import * as service from "@/lib/services/cats.service";
import {
  getCatsSchema,
  editCatSchema,
  createCatSchema,
  getCatHealthRecordsSchema,
  removeCatSchema,
} from "@/lib/validation/cats";

// CATS
export const createCat = actionClient
  .schema(createCatSchema)
  .action(async ({ parsedInput }) => {
    return await service.createCat(parsedInput);
  });

export const getCats = actionClient
  .schema(getCatsSchema)
  .action(async ({ parsedInput }) => {
    return await repo.findCats(parsedInput);
  });

export const editCat = actionClient
  .schema(editCatSchema)
  .action(async ({ parsedInput }) => {
    return await service.editCat(parsedInput);
  });

export const removeCat = actionClient
  .schema(removeCatSchema)
  .action(async ({ parsedInput }) => {
    return await service.removeCat(parsedInput);
  });

// CAT HEALTH RECORDS
export const getCatHealthRecords = actionClient
  .schema(getCatHealthRecordsSchema)
  .action(async ({ parsedInput }) => {
    return await repo.findCatHealthRecords(parsedInput);
  });
