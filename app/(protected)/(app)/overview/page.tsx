import type { Metadata } from "next";
import { OverviewScreen } from "@/components/app-pages/overview/overview-screen";
import { findCats, findCatHealthRecords } from "@/lib/repo/cats.repo";
import { loadData } from "@/lib/safe-initial-data";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function OverviewPage() {
  const [cats, healthRecords] = await Promise.all([
    loadData(
      "Overview cats initial load",
      () => findCats({ entry_status: "Original" }),
      [],
    ),
    loadData(
      "Overview health records initial load",
      () => findCatHealthRecords({}),
      [],
    ),
  ]);

  return (
    <OverviewScreen
      initialCats={cats}
      initialHealthRecords={healthRecords}
    />
  );
}
