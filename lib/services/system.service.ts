import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemConfig } from "@/lib/db/schema";

export async function isSyncFrozen(): Promise<boolean> {
  const row = await db.query.systemConfig.findFirst({
    where: (cols, { eq }) => eq(cols.key, "sync_frozen"),
  });
  return row?.value === "true";
}

export async function setSyncFrozen(frozen: boolean, reason?: string): Promise<void> {
  await db
    .insert(systemConfig)
    .values({ key: "sync_frozen", value: String(frozen), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: String(frozen), updatedAt: new Date() },
    });

  if (frozen && reason) {
    await db
      .insert(systemConfig)
      .values({ key: "sync_freeze_reason", value: reason, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: reason, updatedAt: new Date() },
      });
  } else if (!frozen) {
    await db
      .delete(systemConfig)
      .where(eq(systemConfig.key, "sync_freeze_reason"));
  }
}

export async function getSyncFreezeReason(): Promise<string | null> {
  const row = await db.query.systemConfig.findFirst({
    where: (cols, { eq }) => eq(cols.key, "sync_freeze_reason"),
  });
  return row?.value ?? null;
}
