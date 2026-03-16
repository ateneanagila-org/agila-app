import { db } from "../db";
import { profiles, allowedEmails } from "../db/schema";
import { eq } from "drizzle-orm";

type SelectProfile = typeof profiles.$inferSelect;
type InsertProfile = typeof profiles.$inferInsert;
type SelectAllowedEmail = typeof allowedEmails.$inferSelect;
type InsertAllowedEmail = typeof allowedEmails.$inferInsert;

// PROFILES
export const findProfiles = (filters: Partial<SelectProfile>) =>
  db.query.profiles.findMany({
    where: (cols, { and, eq }) =>
      and(
        filters.id ? eq(cols.id, filters.id) : undefined,
        filters.name ? eq(cols.name, filters.name) : undefined,
        filters.auth_role ? eq(cols.auth_role, filters.auth_role) : undefined,
      ),
  });

export const insertProfile = (data: InsertProfile) =>
  db.insert(profiles).values(data);

export const deleteProfile = (id: string) =>
  db.delete(profiles).where(eq(profiles.id, id));

export const updateProfile = (id: string, data: Partial<InsertProfile>) =>
  db.update(profiles).set(data).where(eq(profiles.id, id));

// ALLOWED EMAILS
export const findAllowedEmails = (filters: Partial<SelectAllowedEmail>) =>
  db.query.allowedEmails.findMany({
    where: (cols, { and, eq }) =>
      and(
        filters.id ? eq(cols.id, filters.id) : undefined,
        filters.email ? eq(cols.email, filters.email) : undefined,
        filters.allower_id
          ? eq(cols.allower_id, filters.allower_id)
          : undefined,
      ),
  });

export const insertAllowedEmail = (data: InsertAllowedEmail) =>
  db.insert(allowedEmails).values(data);

export const updateAllowedEmail = (
  id: string,
  data: Partial<InsertAllowedEmail>,
) => db.update(allowedEmails).set(data).where(eq(allowedEmails.id, id));

export const deleteAllowedEmail = (id: string) =>
  db.delete(allowedEmails).where(eq(allowedEmails.id, id));
