"use server";
import { actionClient } from "@/lib/error/actions-handler";
import * as repo from "@/lib/repo/cats.repo";
import * as service from "@/lib/services/cats.service";
import {
  getCatsSchema,
  editCatSchema,
  createCatSchema,
  createCatHealthRecordSchema,
  getCatHealthRecordsSchema,
  editCatHealthRecordSchema,
} from "@/lib/validation/cats";
import { z } from "zod";

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
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ parsedInput, bindArgsClientInputs: [id] }) => {
    return await repo.updateCat(id, parsedInput);
  });

export const removeCat = actionClient
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ bindArgsClientInputs: [id] }) => {
    return await repo.deleteCat(id);
  });

// CAT HEALTH RECORDS
export const createCatHealthRecord = actionClient
  .schema(createCatHealthRecordSchema)
  .action(async ({ parsedInput }) => {
    return await repo.insertCatHealthRecord(parsedInput);
  });

export const getCatHealthRecords = actionClient
  .schema(getCatHealthRecordsSchema)
  .action(async ({ parsedInput }) => {
    return await repo.findCatHealthRecords(parsedInput);
  });

export const editCathHealthRecord = actionClient
  .schema(editCatHealthRecordSchema)
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ parsedInput, bindArgsClientInputs: [id] }) => {
    return await repo.updateCatHealthRecord(id, parsedInput);
  });

export const removeCatHealthRecord = actionClient
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ bindArgsClientInputs: [id] }) => {
    return await repo.deleteCatHealthRecord(id);
  });
