"use server";
import { revalidatePath } from "next/cache";
import {
  isSyncFrozen,
  setSyncFrozen,
  getSyncFreezeReason,
  updateLinks as updateLinksService,
} from "@/lib/services/system.service";
import { fullReverseSync } from "@/lib/services/reverse-sync.service";
import {
  provisionRegionSheets,
  seedMissingUuidsAllRegions,
} from "@/lib/services/helper.service";
import { sendSyncAlert } from "@/lib/services/discord.service";
import { reconcileCatPhotos } from "@/lib/services/photo-import.service";
import {
  requireAuth,
  requireRole,
  ADMIN_ONLY,
} from "@/lib/auth/rbac";
import { actionClient } from "@/lib/error/actions-handler";
import { updateLinksSchema } from "@/lib/validation/system";

export async function unfreezeSync() {
  await requireRole(...ADMIN_ONLY);
  const reverseSyncResult = await fullReverseSync();
  await setSyncFrozen(false);
  await sendSyncAlert("Sync manually unfrozen by admin. System resumed.");
  return { frozen: false, reverseSyncResult };
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

/**
 * Storage GC — removes cat-photo blobs no live cats.photo_url references.
 * Reference-aware (won't touch a photo a merge reassigned to a surviving cat).
 * Safe to re-run.
 */
export async function reclaimOrphanedPhotos() {
  await requireRole(...ADMIN_ONLY);
  return await reconcileCatPhotos();
}

export async function getSyncStatus() {
  await requireAuth();
  const frozen = await isSyncFrozen();
  const reason = frozen ? await getSyncFreezeReason() : null;
  return { frozen, reason };
}

export const updateLinks = actionClient
  .schema(updateLinksSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    const result = await updateLinksService(parsedInput);
    revalidatePath("/", "layout");
    return result;
  });
