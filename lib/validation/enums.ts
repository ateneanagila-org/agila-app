import { z } from "zod";

export const AuthRolesEnum = z.enum(["Administrator", "Manager", "Volunteer"]);

export type AuthRoles = z.infer<typeof AuthRolesEnum>;
