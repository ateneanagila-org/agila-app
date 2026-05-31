import type { Metadata } from "next";
import { TnvrScreen } from "@/components/app-pages/tnvr/tnvr-screen";
import { findCats, findCatHealthRecords } from "@/lib/repo/cats.repo";
import { loadData } from "@/lib/safe-initial-data";

export const metadata: Metadata = {
  title: "TNVR",
};

export default async function TnvrPage() {
  const [cats, healthRecords] = await Promise.all([
    loadData(
      "TNVR cats initial load",
      () => findCats({ entry_status: "Original" }),
      [],
    ),
    loadData(
      "TNVR health records initial load",
      () => findCatHealthRecords({}),
      [],
    ),
  ]);

  return (
    <TnvrScreen
      initialCats={cats}
      initialHealthRecords={healthRecords}
    />
  );
}
