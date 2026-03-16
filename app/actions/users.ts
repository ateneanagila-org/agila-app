"use server";
import { actionClient } from "@/lib/error/actions-handler";
import * as usersRepo from "@/lib/repo/users.repo";
import {
  getProfilesSchema,
  editProfileSchema,
  createProfileSchema,
} from "@/lib/validation/users";
import { z } from "zod";

export const createProfile = actionClient
  .schema(createProfileSchema)
  .action(async ({ parsedInput }) => {
    return await usersRepo.insertProfile(parsedInput);
  });

export const getProfiles = actionClient
  .schema(getProfilesSchema)
  .action(async ({ parsedInput }) => {
    return await usersRepo.findProfiles(parsedInput);
  });

export const editProfile = actionClient
  .schema(editProfileSchema)
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ parsedInput, bindArgsClientInputs: [id] }) => {
    return await usersRepo.updateProfile(id, parsedInput);
  });

export const removeProfile = actionClient
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ bindArgsClientInputs: [id] }) => {
    return await usersRepo.deleteProfile(id);
  });
