import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemConfig } from "@/lib/db/schema";
import * as systemRepo from "@/lib/repo/system.repo";
import * as storageRepo from "@/lib/repo/storage.repo";
import {
  LINK_CONFIG_KEYS,
  DEFAULT_LINKS,
  type AppLinks,
  STORAGE_CAP_BYTES,
  PHOTO_GC_INTERVAL_MS,
} from "@/lib/constants";

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

/**
 * system_config key marking sync permanently retired.
 *
 * Written as a literal here and NOWHERE else, exactly as "sync_frozen" is —
 * this file is the key's sole owner. If another module spelled it too, a typo
 * would fail silently: the write lands under a misspelled key, the read finds
 * nothing, and the killswitch quietly does nothing.
 *
 * Deliberately NOT the same key as sync_frozen: that one is a temporary,
 * error-triggered pause with an "Unfreeze" button built to undo it.
 * Retirement must survive that button.
 */
const SYNC_RETIRED_KEY = "sync_retired";

/** True when sync has been permanently retired. */
export async function isSyncRetired(): Promise<boolean> {
  const row = await systemRepo.findSystemConfigByKey(SYNC_RETIRED_KEY);
  return row?.value === "true";
}

/**
 * Marks sync permanently retired.
 *
 * One-way by design — there is deliberately no `clearSyncRetired()`. Recovery
 * means a developer deleting the row by hand, which is the intended friction.
 * Note `unfreezeSync()` must never touch this key.
 */
export async function setSyncRetired(): Promise<void> {
  await systemRepo.upsertSystemConfig(SYNC_RETIRED_KEY, "true");
}

export type SyncHalt = "frozen" | "retired" | null;

/**
 * Why sync must not run, or null if it may. Retirement is checked first
 * because it is terminal — if both flags are somehow set, "retired" is the
 * honest answer.
 */
export async function getSyncHalt(): Promise<SyncHalt> {
  if (await isSyncRetired()) return "retired";
  if (await isSyncFrozen()) return "frozen";
  return null;
}

/**
 * Photo storage usage against the plan cap.
 *
 * A failed read yields null, NOT zero: "0 MB used" reads as reassuring when it
 * actually means we have no idea. The card renders null as "Unavailable".
 */
export async function getPhotoStorageUsage(): Promise<{
  bytes: number | null;
  capBytes: number;
}> {
  try {
    const bytes = await storageRepo.sumPhotoStorageBytes();
    return { bytes, capBytes: STORAGE_CAP_BYTES };
  } catch (error) {
    console.warn(
      `getPhotoStorageUsage: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return { bytes: null, capBytes: STORAGE_CAP_BYTES };
  }
}

/**
 * system_config key holding the last orphan-GC sweep time, ISO 8601.
 *
 * Owned by this file, like sync_frozen and sync_retired. Consumers ask
 * getLastPhotoGcAt() rather than spelling the key, so a typo cannot leave the
 * Admin card reading "never" forever while the sweep runs fine.
 */
const PHOTO_GC_KEY = "last_photo_gc_at";

/** When the automatic orphan sweep last ran, or null if it never has. */
export async function getLastPhotoGcAt(): Promise<string | null> {
  const row = await systemRepo.findSystemConfigByKey(PHOTO_GC_KEY);
  return row?.value ?? null;
}

/**
 * True when the orphan-photo sweep is due.
 *
 * The cron fires every 20 minutes; this guard is what makes the sweep weekly.
 * An absent or unparseable timestamp returns true — better to sweep once extra
 * than to never sweep again because one bad write poisoned the guard.
 */
export async function shouldRunPhotoGc(now: Date = new Date()): Promise<boolean> {
  const row = await systemRepo.findSystemConfigByKey(PHOTO_GC_KEY);
  if (!row?.value) return true;

  const last = new Date(row.value).getTime();
  if (Number.isNaN(last)) return true;

  return now.getTime() - last >= PHOTO_GC_INTERVAL_MS;
}

export async function markPhotoGcRun(now: Date = new Date()): Promise<void> {
  await systemRepo.upsertSystemConfig(PHOTO_GC_KEY, now.toISOString());
}
