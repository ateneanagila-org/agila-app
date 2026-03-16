import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { profiles, allowedEmails } from "@/lib/db/schema";
import { z } from "zod";

// PROFILES
export const profileSchema = createSelectSchema(profiles);
export const createProfileSchema = createInsertSchema(profiles);
export const getProfilesSchema = profileSchema.partial();
export const editProfileSchema = createProfileSchema
  .omit({ id: true })
  .partial();

// ALLOWED EMAILS
export const allowedEmailSchema = createSelectSchema(allowedEmails);
export const createAllowedEmailSchema = createInsertSchema(allowedEmails, {
  email: (schema) => schema.email("Invalid email format"),
});
export const getAllowedEmailsSchema = allowedEmailSchema.partial();
export const editAllowedEmailSchema = createAllowedEmailSchema
  .omit({ id: true })
  .partial();

// TYPES
export type CreateProfileSchema = z.infer<typeof createProfileSchema>;
export type GetProfilesSchema = z.infer<typeof getProfilesSchema>;
export type EditProfileSchema = z.infer<typeof editProfileSchema>;
export type CreateAllowedEmailSchema = z.infer<typeof createAllowedEmailSchema>;
export type GetAllowedEmailsSchema = z.infer<typeof getAllowedEmailsSchema>;
export type EditAllowedEmailSchema = z.infer<typeof editAllowedEmailSchema>;
