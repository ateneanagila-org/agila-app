import { DB, db } from "../db";
import { sessions, sessionCats, sessionUsers } from "../db/schema";
import { eq } from "drizzle-orm";
import { createEQFilters } from "./helper.repo";
import {
  InsertSession,
  InsertSessionCat,
  InsertSessionUser,
  SelectSession,
  SelectSessionCat,
  SelectSessionUser,
} from "../validation/sessions";

// SESSIONS
// These are general CRUD; you can make more specific ones depending on frontend
// Yes, these are verbose. But, in this way we can be specific and clear for future changes
export const findSessions = (filters: Partial<SelectSession>) =>
  db.query.sessions.findMany({
    where: (cols, { and }) => {
      const conditions = createEQFilters(cols, filters);
      return conditions.length > 0 ? and(...conditions) : undefined;
    },
  });

export const insertSession = (data: InsertSession, client: DB = db) =>
  client.insert(sessions).values(data).returning();

export const updateSession = (id: string, data: Partial<InsertSession>) =>
  db
    .update(sessions)
    .set({ ...data, last_updated_at: new Date() })
    .where(eq(sessions.id, id));

export const deleteSession = (id: string) =>
  db.delete(sessions).where(eq(sessions.id, id));

// SESSION CATS
export const findSessionCats = (filters: Partial<SelectSessionCat>) =>
  db.query.sessionCats.findMany({
    where: (cols, { and }) => {
      const conditions = createEQFilters(cols, filters);
      return conditions.length > 0 ? and(...conditions) : undefined;
    },
  });

export const insertSessionCat = (data: InsertSessionCat, client: DB = db) =>
  client.insert(sessionCats).values(data);

export const deleteSessionCat = (id: string) =>
  db.delete(sessionCats).where(eq(sessionCats.id, id));

// SESSION USERS
export const findSessionUsers = (filters: Partial<SelectSessionUser>) =>
  db.query.sessionUsers.findMany({
    where: (cols, { and }) => {
      const conditions = createEQFilters(cols, filters);
      return conditions.length > 0 ? and(...conditions) : undefined;
    },
  });

export const insertSessionUser = (data: InsertSessionUser, client: DB = db) =>
  client.insert(sessionUsers).values(data);

export const deleteSessionUser = (id: string) =>
  db.delete(sessionUsers).where(eq(sessionUsers.id, id));
