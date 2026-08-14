import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemConfig } from "@/lib/db/schema";
import * as systemRepo from "@/lib/repo/system.repo";
import { LINK_CONFIG_KEYS, DEFAULT_LINKS, type AppLinks } from "@/lib/constants";

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

/**
 * Resolves the referral links, falling back to the compiled-in defaults for any
 * key that is missing or blank. Callers cannot tell a configured link from a
 * fallback — they just get a URL.
 *
 * A failed read degrades to defaults rather than propagating: a broken config
 * table should not blank every link in the app.
 */
export async function getLinks(): Promise<AppLinks> {
  let rows: Array<{ key: string; value: string }>;
  try {
    rows = await systemRepo.findSystemConfig();
  } catch (error) {
    console.warn(
      `getLinks: falling back to defaults — ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return DEFAULT_LINKS;
  }

  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const resolve = (key: string, fallback: string) => {
    const stored = byKey.get(key)?.trim();
    return stored ? stored : fallback;
  };

  return {
    censusReport: resolve(
      LINK_CONFIG_KEYS.censusReport,
      DEFAULT_LINKS.censusReport,
    ),
    referralSheet: resolve(
      LINK_CONFIG_KEYS.referralSheet,
      DEFAULT_LINKS.referralSheet,
    ),
    adoptFoster: resolve(
      LINK_CONFIG_KEYS.adoptFoster,
      DEFAULT_LINKS.adoptFoster,
    ),
  };
}

/**
 * Writes referral links. A `null` clears the key by DELETING the row rather
 * than storing an empty string, so the compiled-in default takes over cleanly
 * on the next read. An absent field is left untouched.
 */
export async function updateLinks(
  input: Partial<Record<keyof AppLinks, string | null>>,
): Promise<AppLinks> {
  await db.transaction(async (tx) => {
    for (const field of Object.keys(LINK_CONFIG_KEYS) as Array<keyof AppLinks>) {
      const value = input[field];
      if (value === undefined) continue;

      const key = LINK_CONFIG_KEYS[field];
      if (value === null) {
        await systemRepo.deleteSystemConfigKey(key, tx);
      } else {
        await systemRepo.upsertSystemConfig(key, value, tx);
      }
    }
  });

  return await getLinks();
}
