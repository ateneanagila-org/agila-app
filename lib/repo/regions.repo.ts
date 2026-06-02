import { eq, isNull, sql } from "drizzle-orm";
import { db, type Transaction } from "@/lib/db";
import { regions, sessions, sessionCats, cats } from "@/lib/db/schema";
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
 * True if deleting this region would remove nothing but the region row itself —
 * i.e. it has no sessions and no cats pinned to it via a `region_id` override.
 * Used to decide between a free delete and a guarded (typed-confirm) delete.
 */
export const isRegionEmpty = async (
  id: string,
  client: DB = db,
): Promise<boolean> => {
  const [sessionRow] = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(sessions)
    .where(eq(sessions.region_id, id));
  if ((sessionRow?.count ?? 0) > 0) return false;

  const [catRow] = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(cats)
    .where(eq(cats.region_id, id));
  return (catRow?.count ?? 0) === 0;
};

/**
 * Cat IDs that would be fully orphaned by force-deleting this region — i.e. cats
 * that resolve to NO region once the region (and its cascaded sessions) is gone.
 * A cat's region is its `region_id` override if set, else its latest session's
 * region, so the orphan set is the union of:
 *
 *   (A) cats whose override points AT this region (region_id = id). The override
 *       is authoritative: deleting the region removes their declared home, so
 *       they are deleted regardless of any sessions in other regions.
 *
 *   (B) cats with NO override (region_id IS NULL) that have at least one session
 *       in this region and NO session in any other region (nothing to fall back
 *       to once this region's sessions are cascade-deleted).
 *
 * Cats whose override points to a SURVIVING region are in neither group — the
 * override keeps them, sessions notwithstanding.
 */
export const findCatsOnlyInRegion = async (
  id: string,
  client: DB = db,
): Promise<string[]> => {
  const rows = (await client.execute(sql`
    SELECT c.id AS id
    FROM ${cats} c
    WHERE c.region_id = ${id}
    UNION
    SELECT sc.cat_id AS id
    FROM ${sessionCats} sc
    JOIN ${sessions} s ON s.id = sc.session_id
    JOIN ${cats} c ON c.id = sc.cat_id
    WHERE c.region_id IS NULL
    GROUP BY sc.cat_id
    HAVING COUNT(*) FILTER (WHERE s.region_id = ${id}) > 0
       AND COUNT(*) FILTER (WHERE s.region_id <> ${id}) = 0
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((r) => String(r.id));
};

export type RegionOption = Awaited<ReturnType<typeof findActiveRegions>>[number];
