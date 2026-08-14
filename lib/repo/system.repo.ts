import { eq } from "drizzle-orm";
import { db, type Transaction } from "@/lib/db";
import { systemConfig } from "@/lib/db/schema";

type DB = typeof db | Transaction;

/** Every system_config row. The table is tiny (a handful of keys). */
export const findSystemConfig = (client: DB = db) =>
  client.select().from(systemConfig);

/** One system_config row by key, or undefined. */
export const findSystemConfigByKey = (key: string, client: DB = db) =>
  client.query.systemConfig.findFirst({
    where: (cols, { eq }) => eq(cols.key, key),
  });

export const upsertSystemConfig = (
  key: string,
  value: string,
  client: DB = db,
) =>
  client
    .insert(systemConfig)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: { value, updatedAt: new Date() },
    });

export const deleteSystemConfigKey = (key: string, client: DB = db) =>
  client.delete(systemConfig).where(eq(systemConfig.key, key));
