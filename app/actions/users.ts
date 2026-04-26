"use server";
import { actionClient } from "@/lib/error/actions-handler";
import * as usersRepo from "@/lib/repo/users.repo";
import { requireRole, ADMIN_ONLY, MANAGER_OR_ADMIN } from "@/lib/auth/rbac";
import {
  getProfilesSchema,
  editProfileSchema,
  addUserSchema,
  AddUserSchema,
  GetProfilesSchema,
  EditProfileSchema,
} from "@/lib/validation/users";
import { z } from "zod";

export const addUser = actionClient
  .schema(addUserSchema)
  .action(async ({ parsedInput }: { parsedInput: AddUserSchema }) => {
    const current = await requireRole(...ADMIN_ONLY);
    const email = parsedInput.email.toLowerCase();

    await usersRepo.insertAllowedEmail({
      email,
      allower_id: current.user.id,
      auth_role: parsedInput.auth_role,
    });

    const authUsers = await usersRepo.findAuthUserByEmail(email);
    if (authUsers.length > 0) {
      await usersRepo.upsertProfile({
        id: authUsers[0].id,
        name: parsedInput.name,
        auth_role: parsedInput.auth_role,
      });
    }
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
      await requireRole(...ADMIN_ONLY);
      const authUsers = await usersRepo.findAuthUserById(id);
      if (authUsers.length > 0) {
        await usersRepo.deleteAllowedEmailByEmail(authUsers[0].email);
      }
      return await usersRepo.deleteProfile(id);
    },
  );
