import { db } from "../db";
import { profiles, allowedEmails } from "../db/schema";
import { eq } from "drizzle-orm";
import {
  InsertAllowedEmail,
  InsertProfile,
  SelectAllowedEmail,
  SelectProfile,
} from "../validation/users";
import { createEQFilters } from "./helper.repo";

export const findProfiles = (filters: Partial<SelectProfile>) =>
  db.query.profiles.findMany({
    where: (cols, { and }) => {
      const conditions = createEQFilters(cols, filters);
      return conditions.length > 0 ? and(...conditions) : undefined;
    },
  });

export const insertProfile = (data: InsertProfile) =>
  db.insert(profiles).values(data);

export const deleteProfile = (id: string) =>
  db.delete(profiles).where(eq(profiles.id, id));

export const updateProfile = (id: string, data: Partial<InsertProfile>) =>
  db
    .update(profiles)
    .set({ ...data, last_updated_at: new Date() })
    .where(eq(profiles.id, id));

// ALLOWED EMAILS
export const findAllowedEmails = (filters: Partial<SelectAllowedEmail>) =>
  db.query.allowedEmails.findMany({
    where: (cols, { and }) => {
      const conditions = createEQFilters(cols, filters);
      return conditions.length > 0 ? and(...conditions) : undefined;
    },
  });

export const insertAllowedEmail = (data: InsertAllowedEmail) =>
  db.insert(allowedEmails).values(data);

export const updateAllowedEmail = (
  id: string,
  data: Partial<InsertAllowedEmail>,
) => db.update(allowedEmails).set(data).where(eq(allowedEmails.id, id));

export const deleteAllowedEmail = (id: string) =>
  db.delete(allowedEmails).where(eq(allowedEmails.id, id));
