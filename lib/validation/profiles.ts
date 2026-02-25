import { z } from "zod";
import { AuthRoleEnum } from "../db/enums";

export const profileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required").nullable(),
  auth_role: AuthRoleEnum,
});

export const findProfileSchema = profileSchema.omit({}).partial();
export const updateProfileSchema = profileSchema.omit({ id: true }).partial();

export type User = z.infer<typeof profileSchema>;
export type FindProfilesSchema = z.infer<typeof findProfileSchema>;
export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>;
