import type { Metadata } from "next";
import { OverviewScreen } from "@/components/app-pages/overview/overview-screen";
import { findCats, findCatHealthRecords } from "@/lib/repo/cats.repo";
import { findRegions } from "@/lib/repo/regions.repo";
import { loadData } from "@/lib/safe-initial-data";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function OverviewPage() {
  const [cats, healthRecords, regions] = await Promise.all([
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
    loadData("Overview regions initial load", () => findRegions(), []),
  ]);

  return (
    <OverviewScreen
      initialCats={cats}
      initialHealthRecords={healthRecords}
      initialRegions={regions}
    />
  );
}
