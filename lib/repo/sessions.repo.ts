import { DB, db } from "../db";
import { sessions, sessionCats, sessionUsers } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
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
    where: (cols, { and, eq }) => {
      const conditions = [
        eq(cols.is_system, false),
        ...createEQFilters(cols, filters),
      ];
      return and(...conditions);
    },
    orderBy: (cols, { desc }) => [desc(cols.created_at)],
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

/**
 * Resolves a cat's effective region with the same precedence as the app read
 * path (regionSubquery in cats.repo.ts): the manual `cats.region_id` override
 * wins; otherwise fall back to the most recent session's region.
 * Returns the region row (id, name, ...) or undefined when the cat has neither.
 */
export async function resolveCatRegion(catId: string, client: DB = db) {
  const cat = await client.query.cats.findFirst({
    where: (c, { eq }) => eq(c.id, catId),
    columns: { region_id: true },
  });

  if (cat?.region_id) {
    return client.query.regions.findFirst({
      where: (r, { eq }) => eq(r.id, cat.region_id!),
    });
  }

  const latestSession = await client.query.sessions.findFirst({
    where: (sessions, { exists }) =>
      exists(
        db
          .select()
          .from(sessionCats)
          .where(
            and(
              eq(sessionCats.session_id, sessions.id),
              eq(sessionCats.cat_id, catId),
            ),
          ),
      ),
    orderBy: [desc(sessions.created_at)],
    with: { region: true },
  });

  return latestSession?.region;
}

/**
 * Latest *census* session date the cat appears in (via session_cats).
 * Used as the sheet's "Date Last Seen" (col N). System (anchor) sessions are
 * excluded — they are not real sightings. Returns null when the cat has no
 * census session.
 */
export async function findLatestSessionDateForCat(
  catId: string,
  client: DB = db,
): Promise<Date | null> {
  const latest = await client.query.sessions.findFirst({
    where: (s, { exists }) =>
      and(
        eq(s.is_system, false),
        exists(
          db
            .select()
            .from(sessionCats)
            .where(
              and(
                eq(sessionCats.session_id, s.id),
                eq(sessionCats.cat_id, catId),
              ),
            ),
        ),
      ),
    orderBy: [desc(sessions.created_at)],
    columns: { created_at: true },
  });
  return latest?.created_at ?? null;
}
