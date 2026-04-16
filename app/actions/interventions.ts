"use server";
import { actionClient } from "@/lib/error/actions-handler";
import * as repo from "@/lib/repo/interventions.repo";
import * as service from "@/lib/services/interventions.service";
import {
  getInterventionsSchema,
  editInterventionSchema,
  createInterventionSchema,
} from "@/lib/validation/interventions";
import { z } from "zod";

// INTERVENTIONS
export const createIntervention = actionClient
  .schema(createInterventionSchema)
  .action(async ({ parsedInput }) => {
    return await service.createIntervention(parsedInput);
  });

export const getInterventions = actionClient
  .schema(getInterventionsSchema)
  .action(async ({ parsedInput }) => {
    return await repo.findInterventions(parsedInput);
  });

export const editIntervention = actionClient
  .schema(editInterventionSchema)
  .action(async ({ parsedInput }) => {
    return await service.editIntervention(parsedInput);
  });

export const removeIntervention = actionClient
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ bindArgsClientInputs: [id] }) => {
    return await service.removeIntervention(id);
  });
