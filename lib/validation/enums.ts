import { z } from "zod";

export const AuthRolesEnum = z.enum([
  "Now",
  "Within the hour",
  "Within the day",
  "Within the week",
  "Indefinite",
]);

export type AuthRoles = z.infer<typeof AuthRolesEnum>;
