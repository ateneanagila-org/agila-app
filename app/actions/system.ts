"use server";
import { revalidatePath } from "next/cache";
import {
  isSyncFrozen,
  setSyncFrozen,
  getSyncFreezeReason,
  isSyncRetired,
  updateLinks as updateLinksService,
} from "@/lib/services/system.service";
import { retireSync } from "@/lib/services/retirement.service";
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
import { AppError } from "@/lib/error/app-error";
import { updateLinksSchema } from "@/lib/validation/system";

export async function unfreezeSync() {
  await requireRole(...ADMIN_ONLY);
  if (await isSyncRetired()) {
    throw new AppError(
      "Sync is retired. Unfreezing is no longer possible.",
      409,
    );
  }
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
  if (await isSyncRetired()) {
    throw new AppError("Sync is retired. Provisioning is no longer possible.", 409);
  }
  return await provisionRegionSheets();
}

/**
 * Bulk-assigns col-Y UUIDs to existing rows that lack one, across all region
 * sheets. Identity-affecting (mints permanent cat IDs) but idempotent — only
 * fills blanks. Needed at cutover so pre-existing rows can be imported.
 */
export async function seedSheetUuids() {
  await requireRole(...ADMIN_ONLY);
  if (await isSyncRetired()) {
    throw new AppError("Sync is retired. Seeding UUIDs is no longer possible.", 409);
  }
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

/**
 * Permanently retires the Sheets sync. There is no undo in the UI — a
 * developer can clear the system_config row, but no steward-facing control
 * does. Deliberate: this is expected to happen once, ever.
 */
export async function retireSyncAction() {
  await requireRole(...ADMIN_ONLY);
  return await retireSync();
}

export async function getSyncStatus() {
  await requireAuth();
  const frozen = await isSyncFrozen();
  const retired = await isSyncRetired();
  return {
    frozen,
    reason: frozen ? await getSyncFreezeReason() : null,
    retired,
  };
}

export const updateLinks = actionClient
  .schema(updateLinksSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    const result = await updateLinksService(parsedInput);
    revalidatePath("/", "layout");
    return result;
  });
