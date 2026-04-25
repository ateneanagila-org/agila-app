"use server";
import { actionClient } from "@/lib/error/actions-handler";
import * as usersRepo from "@/lib/repo/users.repo";
import { syncSheetEditors } from "@/lib/services/helper.service";
import { requireRole, ADMIN_ONLY, MANAGER_OR_ADMIN } from "@/lib/auth/rbac";
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
    await requireRole(...ADMIN_ONLY);
    return await usersRepo.insertProfile(parsedInput);
  });

export const getProfiles = actionClient
  .schema(getProfilesSchema)
  .action(async ({ parsedInput }: { parsedInput: GetProfilesSchema }) => {
    await requireRole(...MANAGER_OR_ADMIN);
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
      await requireRole(...ADMIN_ONLY);
      const result = await usersRepo.updateProfile(id, parsedInput);
      if (parsedInput.auth_role !== undefined) {
        syncSheetEditors().catch((err) =>
          console.error("[SheetEditors] Sync failed:", err),
        );
      }
      return result;
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
      await requireRole(...ADMIN_ONLY);
      return await usersRepo.deleteProfile(id);
    },
  );
