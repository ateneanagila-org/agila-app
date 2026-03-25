import { DB, db } from "../db";
import { cats, catHealthRecords } from "../db/schema";
import { eq } from "drizzle-orm";
import {
  InsertCat,
  InsertCatHealthRecord,
  SelectCat,
  SelectCatHealthRecord,
} from "../validation/cats";
import { createEQFilters } from "./helper.repo";

// CATS
// These are general CRUD; you can make more specific ones depending on frontend
export const findCats = (filters: Partial<SelectCat>) =>
  db.query.cats.findMany({
    where: (cols, { and }) => {
      const conditions = createEQFilters(cols, filters);
      return conditions.length > 0 ? and(...conditions) : undefined;
    },
  });

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

export const deleteCat = (id: string) => db.delete(cats).where(eq(cats.id, id));

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

export const deleteCatHealthRecord = (id: string) =>
  db.delete(catHealthRecords).where(eq(catHealthRecords.cat_id, id));
