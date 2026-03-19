import { DB, db } from "../db";
import { cats, catHealthRecord } from "../db/schema";
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

export const updateCat = (id: string, data: Partial<InsertCat>) =>
  db
    .update(cats)
    .set({ ...data, last_updated_at: new Date() })
    .where(eq(cats.id, id));

export const deleteCat = (id: string) => db.delete(cats).where(eq(cats.id, id));

// CAT HEALTH RECORDS
export const findCatHealthRecords = (filters: Partial<SelectCatHealthRecord>) =>
  db.query.catHealthRecord.findMany({
    where: (cols, { and }) => {
      const conditions = createEQFilters(cols, filters);
      return conditions.length > 0 ? and(...conditions) : undefined;
    },
  });

export const insertCatHealthRecord = (data: InsertCatHealthRecord) =>
  db.insert(catHealthRecord).values(data);

export const updateCatHealthRecord = (
  id: string,
  data: Partial<InsertCatHealthRecord>,
) =>
  db
    .update(catHealthRecord)
    .set({ ...data, last_updated_at: new Date() })
    .where(eq(catHealthRecord.id, id));

export const deleteCatHealthRecord = (id: string) =>
  db.delete(catHealthRecord).where(eq(catHealthRecord.id, id));
