"use server";
import { actionClient } from "@/lib/error/actions-handler";
import * as usersRepo from "@/lib/repo/users.repo";
import { createClient } from "@/lib/supabase/server";
import {
  getProfilesSchema,
  editProfileSchema,
  createProfileSchema,
  CreateProfileSchema,
  GetProfilesSchema,
  EditProfileSchema,
} from "@/lib/validation/users";
import { z } from "zod";

export const createProfile = actionClient
  .schema(createProfileSchema)
  .action(async ({ parsedInput }: { parsedInput: CreateProfileSchema }) => {
    return await usersRepo.insertProfile(parsedInput);
  });

export const getProfiles = actionClient
  .schema(getProfilesSchema)
  .action(async ({ parsedInput }: { parsedInput: GetProfilesSchema }) => {
    return await usersRepo.findProfiles(parsedInput);
  });

export const editProfile = actionClient
  .schema(editProfileSchema)
  .bindArgsSchemas([z.string().uuid()])
  .action(
    async ({
      parsedInput,
      bindArgsClientInputs: [id],
    }: {
      parsedInput: EditProfileSchema;
      bindArgsClientInputs: readonly [string];
    }) => {
      return await usersRepo.updateProfile(id, parsedInput);
    },
  );

export const removeProfile = actionClient
  .bindArgsSchemas([z.string().uuid()])
  .action(
    async ({
      bindArgsClientInputs: [id],
    }: {
      bindArgsClientInputs: readonly [string];
    }) => {
      return await usersRepo.deleteProfile(id);
    },
  );

export const getSupabaseUser = actionClient.action(async () => {
  const supabase = await createClient();
  return await supabase.auth.getUser();
});
