import { eq, isNull, sql } from "drizzle-orm";
import { db, type Transaction } from "@/lib/db";
import { regions, sessions, sessionCats } from "@/lib/db/schema";
import type { RegionColor } from "@/lib/db/enums";

type DB = typeof db | Transaction;

/** All regions (id, name, color, archived_at). */
export const findRegions = () =>
  db
    .select({
      id: regions.id,
      name: regions.name,
      color: regions.color,
      archived_at: regions.archived_at,
    })
    .from(regions);

/** Active (non-archived) regions only. */
export const findActiveRegions = () =>
  db
    .select({ id: regions.id, name: regions.name, color: regions.color })
    .from(regions)
    .where(isNull(regions.archived_at));

export const findRegionById = (id: string, client: DB = db) =>
  client.query.regions.findFirst({ where: (r, { eq }) => eq(r.id, id) });

export const findRegionByName = (name: string, client: DB = db) =>
  client.query.regions.findFirst({ where: (r, { eq }) => eq(r.name, name) });

export const insertRegion = (
  data: { name: string; color: RegionColor | null },
  client: DB = db,
) => client.insert(regions).values(data).returning();

export const updateRegionName = (id: string, name: string, client: DB = db) =>
  client.update(regions).set({ name }).where(eq(regions.id, id)).returning();

export const setRegionArchived = (
  id: string,
  archived: boolean,
  client: DB = db,
) =>
  client
    .update(regions)
    .set({ archived_at: archived ? new Date() : null })
    .where(eq(regions.id, id))
    .returning();

export const deleteRegion = (id: string, client: DB = db) =>
  client.delete(regions).where(eq(regions.id, id)).returning();

/**
 * Usage of a region: number of sessions in it, and number of cats that have
 * sessions in it. Used to decide empty vs populated and to show delete impact.
 */
export const getRegionUsage = async (
  id: string,
  client: DB = db,
): Promise<{ sessionCount: number; catCount: number }> => {
  const [sessionRow] = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(sessions)
    .where(eq(sessions.region_id, id));

  const [catRow] = await client
    .select({ count: sql<number>`count(distinct ${sessionCats.cat_id})::int` })
    .from(sessionCats)
    .innerJoin(sessions, eq(sessionCats.session_id, sessions.id))
    .where(eq(sessions.region_id, id));

  return {
    sessionCount: sessionRow?.count ?? 0,
    catCount: catRow?.count ?? 0,
  };
};

/**
 * Cat IDs that would be fully orphaned by deleting this region: they appear in
 * at least one session in this region but have NO sessions in any other region.
 * Determined by session membership only — cats.region_id is a nullable FK with
 * onDelete: "set null" and is handled automatically by the cascade.
 */
export const findCatsOnlyInRegion = async (
  id: string,
  client: DB = db,
): Promise<string[]> => {
  const rows = await client.execute(sql`
    SELECT sc.cat_id AS id
    FROM ${sessionCats} sc
    JOIN ${sessions} s ON s.id = sc.session_id
    WHERE s.region_id = ${id}
    GROUP BY sc.cat_id
    HAVING COUNT(*) FILTER (WHERE s.region_id <> ${id}) = 0
  `);
  return rows.map((r) => String((r as Record<string, unknown>).id));
};

export type RegionOption = Awaited<ReturnType<typeof findActiveRegions>>[number];
