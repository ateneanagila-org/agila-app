import { z } from "zod";
import { BUG_REPORT_STATUS_VALUES } from "@/lib/db/enums";

/**
 * Submit payload. Deliberately carries NO identity fields — the action reads
 * the reporter from the session, so a reporter cannot attribute a report to
 * someone else.
 */
export const createBugReportSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Describe the problem before sending.")
    .max(2000, "Please keep the report under 2000 characters."),
});

export const setBugReportStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(BUG_REPORT_STATUS_VALUES),
});

export const deleteBugReportSchema = z.object({
  id: z.string().uuid(),
});

export type CreateBugReportInput = z.infer<typeof createBugReportSchema>;
