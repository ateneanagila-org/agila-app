import { z } from "zod";
import { AuthRoleEnum } from "../db/enums"; // Import the enum we made earlier

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required").nullable(),
  auth_role: AuthRoleEnum,
});

// Partial schemas for searching and updating
export const findUserSchema = userSchema.omit({}).partial();
export const updateUserSchema = userSchema.omit({ id: true }).partial();

export type User = z.infer<typeof userSchema>;
export type FindUserSchema = z.infer<typeof findUserSchema>;
export type UpdateUserSchema = z.infer<typeof updateUserSchema>;
