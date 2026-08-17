import type { Metadata } from "next";
import { AdminScreen } from "@/components/app-pages/admin/admin-screen";
import { findAllowedEmailsWithProfile } from "@/lib/repo/users.repo";
import { findRegions } from "@/lib/repo/regions.repo";
import {
  getLinks,
  getSyncFreezeReason,
  isSyncFrozen,
  isSyncRetired,
  getPhotoStorageUsage,
  getLastPhotoGcAt,
} from "@/lib/services/system.service";
import { countOpenBugReports } from "@/lib/repo/bug-reports.repo";
import { loadData } from "@/lib/safe-initial-data";
import { DEFAULT_LINKS, STORAGE_CAP_BYTES } from "@/lib/constants";

// 60 is the ceiling on Vercel's Hobby plan; the previous 120 was above it and
// could never have applied. Headroom only — the admin actions this covers now
// finish in seconds.
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Admin",
};

type InitialSyncStatus = {
  frozen: boolean | null;
  reason: string | null;
  retired: boolean;
};

export default async function AdminPage() {
  const [users, syncStatus, regions, links, openBugReports, storageUsage, lastCleanupAt] =
    await Promise.all([
      loadData("Users initial load", () => findAllowedEmailsWithProfile(), []),
      loadData<InitialSyncStatus>(
        "Sync status initial load",
        async () => {
          const frozen = await isSyncFrozen();
          return {
            frozen,
            reason: frozen ? await getSyncFreezeReason() : null,
            retired: await isSyncRetired(),
          };
        },
        {
          frozen: null,
          reason: null,
          retired: false,
        },
      ),
      loadData("Admin regions initial load", () => findRegions(), []),
      loadData("Admin links initial load", () => getLinks(), DEFAULT_LINKS),
      loadData("Open bug report count", () => countOpenBugReports(), 0),
      loadData(
        "Photo storage usage",
        () => getPhotoStorageUsage(),
        { bytes: null, capBytes: STORAGE_CAP_BYTES },
      ),
      loadData("Last photo GC timestamp", () => getLastPhotoGcAt(), null),
    ]);

  return (
    <AdminScreen
      initialUsers={users}
      initialSyncStatus={syncStatus}
      initialRegions={regions}
      initialLinks={links}
      openBugReports={openBugReports}
      storageUsage={storageUsage}
      lastCleanupAt={lastCleanupAt}
    />
  );
}
