"use server";
import {
  isSyncFrozen,
  setSyncFrozen,
  getSyncFreezeReason,
} from "@/lib/services/system.service";
import { fullReverseSync } from "@/lib/services/reverse-sync.service";
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

export async function getSyncStatus() {
  await requireAuth();
  const frozen = await isSyncFrozen();
  const reason = frozen ? await getSyncFreezeReason() : null;
  return { frozen, reason };
}
