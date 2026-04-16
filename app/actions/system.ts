"use server";
import { isSyncFrozen, setSyncFrozen } from "@/lib/services/system.service";
import {
  freezeSheetProtections,
  unfreezeSheetProtections,
} from "@/lib/services/helper.service";

export async function freezeSync() {
  await setSyncFrozen(true);
  await freezeSheetProtections();
  return { frozen: true };
}

/**
 * Unfreezes the sync system after app recovery.
 * Restores sheet protections and resumes the cron sync.
 *
 * NOTE (Phase 3): Add fullReverseSync() call here before setSyncFrozen(false)
 * to import any manual GSheet edits made during the freeze before cron resumes.
 */
export async function unfreezeSync() {
  await unfreezeSheetProtections();
  await setSyncFrozen(false);
  return { frozen: false };
}

export async function getSyncStatus() {
  const frozen = await isSyncFrozen();
  return { frozen };
}
