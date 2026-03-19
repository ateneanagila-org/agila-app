"use server";
import { actionClient } from "@/lib/error/actions-handler";
import * as repo from "@/lib/repo/sessions.repo";
import * as service from "@/lib/services/sessions.service";
import {
  createSessionCatSchema,
  createSessionSchema,
  editSessionSchema,
  getSessionCatsSchema,
  getSessionsSchema,
  getSessionUsersSchema,
} from "@/lib/validation/sessions";
import { z } from "zod";

// SESSIONS
// This uses service logic for multi-table interaction
export const createSession = actionClient
  .schema(createSessionSchema)
  .action(async ({ parsedInput }) => {
    return await service.createSession(parsedInput);
  });

export const getSessions = actionClient
  .schema(getSessionsSchema)
  .action(async ({ parsedInput }) => {
    return await repo.findSessions(parsedInput);
  });

export const editSession = actionClient
  .schema(editSessionSchema)
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ parsedInput, bindArgsClientInputs: [id] }) => {
    return await repo.updateSession(id, parsedInput);
  });

export const removeSession = actionClient
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ bindArgsClientInputs: [id] }) => {
    return await repo.deleteSession(id);
  });

// SESSION CAT
// This uses service logic for multi-table interaction
export const createSessionCat = actionClient
  .schema(createSessionCatSchema)
  .action(async ({ parsedInput }) => {
    return await service.createSessionCat(parsedInput);
  });

export const getSessionCats = actionClient
  .schema(getSessionCatsSchema)
  .action(async ({ parsedInput }) => {
    return await repo.findSessionCats(parsedInput);
  });

export const removeSessionCat = actionClient
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ bindArgsClientInputs: [id] }) => {
    return await repo.deleteSessionCat(id);
  });

// SESSION USERS
export const getSessionUsers = actionClient
  .schema(getSessionUsersSchema)
  .action(async ({ parsedInput }) => {
    return await repo.findSessionUsers(parsedInput);
  });

export const removeSessionUser = actionClient
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ bindArgsClientInputs: [id] }) => {
    return await repo.deleteSessionUser(id);
  });
