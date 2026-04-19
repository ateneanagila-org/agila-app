"use server";
import { isSyncFrozen, setSyncFrozen } from "@/lib/services/system.service";
import {
  freezeSheetProtections,
  unfreezeSheetProtections,
  syncSheetEditors,
} from "@/lib/services/helper.service";
import { fullReverseSync } from "@/lib/services/reverse-sync.service";

export async function freezeSync() {
  await setSyncFrozen(true);
  await freezeSheetProtections();
  return { frozen: true };
}

/**
 * Unfreezes the sync system after app recovery.
 * 1. Restores sheet protections (managers/admins only)
 * 2. Runs full reverse sync — imports all manual GSheet edits made during freeze
 * 3. Clears freeze flag — cron resumes; remaining PENDING tasks run normally
 */
export async function unfreezeSync() {
  await syncSheetEditors();
  await unfreezeSheetProtections();
  const reverseSyncResult = await fullReverseSync();
  await setSyncFrozen(false);
  return { frozen: false, reverseSyncResult };
}

export async function getSyncStatus() {
  const frozen = await isSyncFrozen();
  return { frozen };
}
