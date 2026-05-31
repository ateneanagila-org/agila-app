import type { Metadata } from "next";
import { UsersScreen } from "@/components/app-pages/users/users-screen";
import { findAllowedEmailsWithProfile } from "@/lib/repo/users.repo";
import {
  getSyncFreezeReason,
  isSyncFrozen,
} from "@/lib/services/system.service";
import { loadData } from "@/lib/safe-initial-data";

export const metadata: Metadata = {
  title: "User Control",
};

type InitialSyncStatus = {
  frozen: boolean | null;
  reason: string | null;
};

export default async function UsersPage() {
  const [users, syncStatus] = await Promise.all([
    loadData("Users initial load", () => findAllowedEmailsWithProfile(), []),
    loadData<InitialSyncStatus>(
      "Sync status initial load",
      async () => {
        const frozen = await isSyncFrozen();
        return {
          frozen,
          reason: frozen ? await getSyncFreezeReason() : null,
        };
      },
      {
        frozen: null,
        reason: null,
      },
    ),
  ]);

  return (
    <UsersScreen
      initialUsers={users}
      initialSyncStatus={syncStatus}
    />
  );
}
