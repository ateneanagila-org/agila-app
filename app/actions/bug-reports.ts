"use server";
import { z } from "zod";
import { actionClient } from "@/lib/error/actions-handler";
import * as service from "@/lib/services/bug-reports.service";
import * as bugReportsRepo from "@/lib/repo/bug-reports.repo";
import { requireAuth, requireRole, ADMIN_ONLY } from "@/lib/auth/rbac";
import {
  createBugReportSchema,
  setBugReportStatusSchema,
  deleteBugReportSchema,
} from "@/lib/validation/bug-reports";
import { BUG_REPORT_STATUS_VALUES } from "@/lib/db/enums";

/**
 * Any signed-in user may report a bug — Volunteers included. Identity comes
 * from the session, never from the payload, so a reporter cannot attribute a
 * report to someone else.
 */
export const submitBugReport = actionClient
  .schema(createBugReportSchema)
  .action(async ({ parsedInput }) => {
    const { user, profile } = await requireAuth();
    return await service.createBugReport({
      message: parsedInput.message,
      reporter: {
        id: profile.id,
        name: profile.name ?? null,
        email: user.email ?? "unknown",
      },
    });
  });

export const listBugReports = actionClient
  .schema(z.object({ status: z.enum(BUG_REPORT_STATUS_VALUES).optional() }))
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await bugReportsRepo.findBugReports({ status: parsedInput.status });
  });

export const resolveBugReport = actionClient
  .schema(setBugReportStatusSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await service.setBugReportStatus(parsedInput.id, parsedInput.status);
  });

export const removeBugReportAction = actionClient
  .schema(deleteBugReportSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await service.removeBugReport(parsedInput.id);
  });
