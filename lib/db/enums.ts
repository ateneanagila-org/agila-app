import { pgEnum } from "drizzle-orm/pg-core";
import { z } from "zod";

// FOR TESTING
export const URGENCY_VALUES = [
  "Now",
  "Within the hour",
  "Within the day",
  "Within the week",
  "Indefinite",
] as const;
export const UrgencyEnum = z.enum(URGENCY_VALUES);
export const urgencyEnum = pgEnum("urgency", URGENCY_VALUES);

// User AuthRoles
export const AUTH_ROLE_VALUES = [
  "Administrator",
  "Manager",
  "Volunteer",
] as const;
export const authRoleEnum = pgEnum("auth_role", AUTH_ROLE_VALUES);
export const AuthRoleEnum = z.enum(AUTH_ROLE_VALUES);
export type AuthRole = z.infer<typeof AuthRoleEnum>;
