import type { Metadata } from "next";
import { BugReportsScreen } from "@/components/app-pages/admin/bug-reports-screen";
import { findBugReports } from "@/lib/repo/bug-reports.repo";
import { loadData } from "@/lib/safe-initial-data";

export const metadata: Metadata = { title: "Admin — Bug Reports" };

export default async function BugReportsPage() {
  const reports = await loadData(
    "Bug reports initial load",
    () => findBugReports({}),
    [],
  );

  return <BugReportsScreen initialReports={reports} />;
}
