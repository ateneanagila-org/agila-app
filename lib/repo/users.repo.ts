import { db } from "../db";
import { profiles, allowedEmails, supabaseUsers } from "../db/schema";
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
    with: { user: true },
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
    .set({ ...data })
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

export const deleteAllowedEmailByEmail = (email: string) =>
  db.delete(allowedEmails).where(eq(allowedEmails.email, email));

// AUTH USERS (read-only lookups)
export const findAuthUserByEmail = (email: string) =>
  db.select().from(supabaseUsers).where(eq(supabaseUsers.email, email)).limit(1);

export const findAuthUserById = (id: string) =>
  db.select().from(supabaseUsers).where(eq(supabaseUsers.id, id)).limit(1);

export const upsertProfile = (data: InsertProfile) =>
  db
    .insert(profiles)
    .values(data)
    .onConflictDoUpdate({
      target: profiles.id,
      set: { name: data.name, auth_role: data.auth_role },
    });
