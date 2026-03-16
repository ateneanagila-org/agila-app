import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { profiles, allowedEmails } from "@/lib/db/schema";
import { z } from "zod";

// PROFILES
export const profilesSchema = createSelectSchema(profiles);
export const createProfileSchema = createInsertSchema(profiles).omit({
  last_updated_at: true,
});
export const getProfilesSchema = profilesSchema.partial();
export const editProfileSchema = createInsertSchema(profiles)
  .omit({ id: true, last_updated_at: true })
  .partial();

// ALLOWED EMAILS
export const allowedEmailsSchema = createSelectSchema(allowedEmails);
export const createAllowedEmailSchema = createInsertSchema(allowedEmails, {
  email: (schema) => schema.email("Invalid email format"),
}).omit({ id: true, allowed_at: true });
export const getAllowedEmailsSchema = allowedEmailsSchema.partial();
export const editAllowedEmailSchema = createInsertSchema(allowedEmails)
  .omit({ id: true })
  .partial();

// TYPES
export type InsertProfile = typeof profiles.$inferInsert;
export type SelectProfile = typeof profiles.$inferSelect;
export type CreateProfileSchema = z.infer<typeof createProfileSchema>;
export type GetProfilesSchema = z.infer<typeof getProfilesSchema>;
export type EditProfileSchema = z.infer<typeof editProfileSchema>;
export type SelectAllowedEmail = typeof allowedEmails.$inferSelect;
export type InsertAllowedEmail = typeof allowedEmails.$inferInsert;
export type CreateAllowedEmailSchema = z.infer<typeof createAllowedEmailSchema>;
export type GetAllowedEmailsSchema = z.infer<typeof getAllowedEmailsSchema>;
export type EditAllowedEmailSchema = z.infer<typeof editAllowedEmailSchema>;
