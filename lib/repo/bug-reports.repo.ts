import { desc, eq, sql } from "drizzle-orm";
import { db, type Transaction } from "@/lib/db";
import { bugReports } from "@/lib/db/schema";
import type { BugReportStatus } from "@/lib/db/enums";

type DB = typeof db | Transaction;

/** Newest first. Pass a status to filter; omit for all. */
export const findBugReports = (
  filter: { status?: BugReportStatus } = {},
  client: DB = db,
) => {
  const query = client.select().from(bugReports);
  return filter.status
    ? query.where(eq(bugReports.status, filter.status)).orderBy(desc(bugReports.created_at))
    : query.orderBy(desc(bugReports.created_at));
};

export const countOpenBugReports = async (client: DB = db) => {
  const [row] = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(bugReports)
    .where(eq(bugReports.status, "Open"));
  return row?.count ?? 0;
};

export const insertBugReport = (
  data: {
    message: string;
    reporter_id: string | null;
    reporter_name: string | null;
    reporter_email: string;
  },
  client: DB = db,
) => client.insert(bugReports).values(data).returning();

export const updateBugReport = (
  id: string,
  data: { status: BugReportStatus; resolved_at: Date | null },
  client: DB = db,
) =>
  client.update(bugReports).set(data).where(eq(bugReports.id, id)).returning();

export const deleteBugReport = (id: string, client: DB = db) =>
  client.delete(bugReports).where(eq(bugReports.id, id)).returning();

export type BugReport = Awaited<ReturnType<typeof findBugReports>>[number];
