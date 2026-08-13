import * as bugReportsRepo from "@/lib/repo/bug-reports.repo";
import type { BugReportStatus } from "@/lib/db/enums";
import { AppError } from "@/lib/error/app-error";

export type Reporter = {
  id: string;
  name: string | null;
  email: string;
};

/**
 * Records a bug report, snapshotting who filed it.
 *
 * The reporter is passed in rather than read here: auth belongs to the action
 * layer. The snapshot is deliberate — see the bug_reports table comment.
 */
export const createBugReport = async ({
  message,
  reporter,
}: {
  message: string;
  reporter: Reporter;
}) => {
  const trimmed = message.trim();
  if (!trimmed) throw new AppError("A bug report cannot be empty.", 400);

  const [created] = await bugReportsRepo.insertBugReport({
    message: trimmed,
    reporter_id: reporter.id,
    reporter_name: reporter.name,
    reporter_email: reporter.email,
  });
  return created;
};

/**
 * Resolves or reopens a report. resolved_at tracks status rather than being set
 * independently, so a reopened report never keeps a stale resolution date.
 */
export const setBugReportStatus = async (
  id: string,
  status: BugReportStatus,
) => {
  const [updated] = await bugReportsRepo.updateBugReport(id, {
    status,
    resolved_at: status === "Resolved" ? new Date() : null,
  });
  if (!updated) throw new AppError("Bug report not found.", 404);
  return updated;
};

export const removeBugReport = async (id: string) => {
  const [deleted] = await bugReportsRepo.deleteBugReport(id);
  if (!deleted) throw new AppError("Bug report not found.", 404);
  return deleted;
};
