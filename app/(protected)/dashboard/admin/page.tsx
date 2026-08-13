import type { Metadata } from "next";
import { AdminScreen } from "@/components/app-pages/admin/admin-screen";
import { findAllowedEmailsWithProfile } from "@/lib/repo/users.repo";
import { findRegions } from "@/lib/repo/regions.repo";
import {
  getLinks,
  getSyncFreezeReason,
  isSyncFrozen,
} from "@/lib/services/system.service";
import { countOpenBugReports } from "@/lib/repo/bug-reports.repo";
import { loadData } from "@/lib/safe-initial-data";

export const maxDuration = 120;

export const metadata: Metadata = {
  title: "Admin",
};

type InitialSyncStatus = {
  frozen: boolean | null;
  reason: string | null;
};

export default async function AdminPage() {
  const [users, syncStatus, regions, links, openBugReports] = await Promise.all([
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
    loadData("Admin regions initial load", () => findRegions(), []),
    getLinks(),
    loadData("Open bug report count", () => countOpenBugReports(), 0),
  ]);

  return (
    <AdminScreen
      initialUsers={users}
      initialSyncStatus={syncStatus}
      initialRegions={regions}
      initialLinks={links}
      openBugReports={openBugReports}
    />
  );
}
