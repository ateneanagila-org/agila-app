import { db, Transaction } from "@/lib/db";
import { sessions, sessionCats } from "@/lib/db/schema";

/**
 * Returns the ID of the permanent system session for a region.
 * Creates it if it doesn't exist. System sessions are never closed
 * and have no sessionUsers — they exist solely to anchor the cat→region link.
 */
export async function upsertSystemSession(
  regionId: string,
  client: typeof db | Transaction = db,
): Promise<string> {
  const existing = await client.query.sessions.findFirst({
    where: (s, { eq, and }) =>
      and(eq(s.region_id, regionId), eq(s.is_system, true)),
  });

  if (existing) return existing.id;

  const [created] = await client
    .insert(sessions)
    .values({ region_id: regionId, is_system: true, is_finished: false })
    .returning();

  return created.id;
}

/**
 * Links a cat to the system session for its region.
 * Safe to call multiple times — silently skips if already linked.
 */
export async function linkCatToSystemSession(
  catId: string,
  regionId: string,
  client: typeof db | Transaction = db,
): Promise<void> {
  const sessionId = await upsertSystemSession(regionId, client);

  const existing = await client.query.sessionCats.findFirst({
    where: (sc, { eq, and }) =>
      and(eq(sc.cat_id, catId), eq(sc.session_id, sessionId)),
  });

  if (!existing) {
    await client.insert(sessionCats).values({ cat_id: catId, session_id: sessionId });
  }
}
