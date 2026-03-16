"use server";
import { actionClient } from "@/lib/error/actions-handler";
import * as repo from "@/lib/repo/users.repo";
import {
  getProfilesSchema,
  editProfileSchema,
  createProfileSchema,
  createAllowedEmailSchema,
  getAllowedEmailsSchema,
  editAllowedEmailSchema,
} from "@/lib/validation/users";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const createProfile = actionClient
  .schema(createProfileSchema)
  .action(async ({ parsedInput }) => {
    return await repo.insertProfile(parsedInput);
  });

export const getProfiles = actionClient
  .schema(getProfilesSchema)
  .action(async ({ parsedInput }) => {
    return await repo.findProfiles(parsedInput);
  });

export const editProfile = actionClient
  .schema(editProfileSchema)
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ parsedInput, bindArgsClientInputs: [id] }) => {
    return await repo.updateProfile(id, parsedInput);
  });

export const removeProfile = actionClient
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ bindArgsClientInputs: [id] }) => {
    return await repo.deleteProfile(id);
  });

export const createAllowedEmail = actionClient
  .schema(createAllowedEmailSchema)
  .action(async ({ parsedInput }) => {
    return await repo.insertAllowedEmail(parsedInput);
  });

export const getAllowedEmails = actionClient
  .schema(getAllowedEmailsSchema)
  .action(async ({ parsedInput }) => {
    return await repo.findAllowedEmails(parsedInput);
  });

export const editAllowedEmail = actionClient
  .schema(editAllowedEmailSchema)
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ parsedInput, bindArgsClientInputs: [id] }) => {
    return await repo.updateAllowedEmail(id, parsedInput);
  });

export const removeAllowedEmail = actionClient
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ bindArgsClientInputs: [id] }) => {
    return await repo.deleteAllowedEmail(id);
  });

export async function getSupabaseUser() {
  const supabase = await createClient();
  return await supabase.auth.getUser();
}
