"use server";
import {
  isSyncFrozen,
  setSyncFrozen,
  getSyncFreezeReason,
} from "@/lib/services/system.service";
import { fullReverseSync } from "@/lib/services/reverse-sync.service";
import {
  provisionRegionSheets,
  seedMissingUuidsAllRegions,
} from "@/lib/services/helper.service";
import { syncRegionsFromEnum } from "@/lib/services/regions.service";
import { sendSyncAlert } from "@/lib/services/discord.service";
import {
  requireAuth,
  requireRole,
  ADMIN_ONLY,
} from "@/lib/auth/rbac";

export async function unfreezeSync() {
  await requireRole(...ADMIN_ONLY);
  const reverseSyncResult = await fullReverseSync();
  await setSyncFrozen(false);
  await sendSyncAlert("Sync manually unfrozen by admin. System resumed.");
  return { frozen: false, reverseSyncResult };
}

/**
 * Seeds the regions table from the REGION_NAME_VALUES enum — inserts any names
 * that don't have a row yet (idempotent, additive, never deletes). Colors are
 * left null to edit afterward. Run after adding a name to the enum + pushing
 * schema, then follow with provisionSheets().
 */
export async function syncRegions() {
  await requireRole(...ADMIN_ONLY);
  return await syncRegionsFromEnum();
}

/**
 * Provisions all region sheets (server-side, idempotent): ensures W/X/Y headers,
 * applies the A + W–Y protections, and refreshes _config!B2 from the DB. Safe to
 * re-run. Does NOT mint UUIDs — see seedSheetUuids().
 */
export async function provisionSheets() {
  await requireRole(...ADMIN_ONLY);
  return await provisionRegionSheets();
}

/**
 * Bulk-assigns col-Y UUIDs to existing rows that lack one, across all region
 * sheets. Identity-affecting (mints permanent cat IDs) but idempotent — only
 * fills blanks. Needed at cutover so pre-existing rows can be imported.
 */
export async function seedSheetUuids() {
  await requireRole(...ADMIN_ONLY);
  return await seedMissingUuidsAllRegions();
}

export async function getSyncStatus() {
  await requireAuth();
  const frozen = await isSyncFrozen();
  const reason = frozen ? await getSyncFreezeReason() : null;
  return { frozen, reason };
}
