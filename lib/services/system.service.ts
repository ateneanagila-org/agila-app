import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemConfig } from "@/lib/db/schema";

export async function isSyncFrozen(): Promise<boolean> {
  const row = await db.query.systemConfig.findFirst({
    where: (cols, { eq }) => eq(cols.key, "sync_frozen"),
  });
  return row?.value === "true";
}

export async function setSyncFrozen(frozen: boolean): Promise<void> {
  await db
    .update(systemConfig)
    .set({ value: String(frozen), updatedAt: new Date() })
    .where(eq(systemConfig.key, "sync_frozen"));
}
