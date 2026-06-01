import { DB, db } from "../db";
import { cats, catHealthRecords } from "../db/schema";
import { eq, notInArray, isNull, and, or, inArray, sql } from "drizzle-orm";
import {
  InsertCat,
  InsertCatHealthRecord,
  SelectCat,
  SelectCatHealthRecord,
} from "../validation/cats";
import { createEQFilters } from "./helper.repo";

export type CatWithRegion = SelectCat & { region_name: string | null };

// Region name resolution: cats.region_id (manual override) takes priority,
// otherwise fall back to the most recent session's region.
const regionSubquery = sql<string | null>`COALESCE(
  (SELECT r2.name FROM regions r2 WHERE r2.id = cats.region_id),
  (SELECT r.name FROM regions r
    INNER JOIN sessions s ON s.region_id = r.id
    INNER JOIN session_cats sc ON sc.session_id = s.id
    WHERE sc.cat_id = cats.id
    ORDER BY s.created_at DESC
    LIMIT 1)
)`;

// Live Supabase may not have the sync-only catalog_id/paws_id columns yet.
// Keep read queries explicit so user-facing pages do not fail when those
// optional sync columns are absent.
const catReadColumns = {
  id: cats.id,
  merged_into_id: cats.merged_into_id,
  region_id: cats.region_id,
  last_updated_at: cats.last_updated_at,
  entry_status: cats.entry_status,
  photo_url: cats.photo_url,
  color: cats.color,
  age: cats.age,
  sex: cats.sex,
  name: cats.name,
  sociability: cats.sociability,
  cat_status: cats.cat_status,
  spot_last_seen: cats.spot_last_seen,
  caretaker: cats.caretaker,
  notes: cats.notes,
  is_adoptable: cats.is_adoptable,
  catalog_id: sql<string | null>`NULL`,
  paws_id: sql<string | null>`NULL`,
};

function buildCatConditions(filters: Partial<SelectCat>) {
  return Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) =>
      eq(
        cats[k as keyof typeof cats] as unknown as Parameters<typeof eq>[0],
        v as unknown as Parameters<typeof eq>[1],
      ),
    );
}

// CATS
export const findCatsByIds = (ids: string[]): Promise<SelectCat[]> =>
  ids.length === 0 ? Promise.resolve([]) : db.select().from(cats).where(inArray(cats.id, ids));

export const findAdoptableCats = (filters: Partial<SelectCat>): Promise<CatWithRegion[]> => {
  const conditions = buildCatConditions(filters);
  conditions.push(
    or(isNull(cats.cat_status), notInArray(cats.cat_status, ["Adopted", "Fostered", "Deceased", "MIA"]))!
  );
  return db.select({
    ...catReadColumns,
    region_name: regionSubquery,
  })
  .from(cats)
  .where(and(...conditions));
};

export const findCats = (filters: Partial<SelectCat>): Promise<CatWithRegion[]> => {
  const conditions = buildCatConditions(filters);
  return db.select({
    ...catReadColumns,
    region_name: regionSubquery,
  })
  .from(cats)
  .where(conditions.length > 0 ? and(...conditions) : undefined);
};

export const insertCat = (data: InsertCat, client: DB = db) =>
  client.insert(cats).values(data).returning();

export const updateCat = (
  id: string,
  data: Partial<InsertCat>,
  client: DB = db,
) =>
  client
    .update(cats)
    .set({ ...data, last_updated_at: new Date() })
    .where(eq(cats.id, id))
    .returning();

export const deleteCat = (id: string, client: DB = db) =>
  client.delete(cats).where(eq(cats.id, id)).returning();

// CAT HEALTH RECORDS
export const findCatHealthRecords = (filters: Partial<SelectCatHealthRecord>) =>
  db.query.catHealthRecords.findMany({
    where: (cols, { and }) => {
      const conditions = createEQFilters(cols, filters);
      return conditions.length > 0 ? and(...conditions) : undefined;
    },
  });

export const insertCatHealthRecord = (
  data: InsertCatHealthRecord,
  client: DB = db,
) => client.insert(catHealthRecords).values(data).returning();

export const updateCatHealthRecord = (
  id: string,
  data: Partial<InsertCatHealthRecord>,
  client: DB = db,
) =>
  client
    .update(catHealthRecords)
    .set({ ...data, last_updated_at: new Date() })
    .where(eq(catHealthRecords.cat_id, id))
    .returning();

export const deleteCatHealthRecord = (id: string, client: DB = db) =>
  client
    .delete(catHealthRecords)
    .where(eq(catHealthRecords.cat_id, id))
    .returning();
