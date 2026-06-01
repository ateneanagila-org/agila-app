import type { Metadata } from "next";
import { DatabaseListScreen } from "@/components/app-pages/database/database-list-screen";
import { findCats } from "@/lib/repo/cats.repo";
import { loadData } from "@/lib/safe-initial-data";

export const metadata: Metadata = {
  title: "Database",
};

export default async function DatabasePage() {
  const cats = await loadData(
    "Database cats initial load",
    () => findCats({ entry_status: "Original" }),
    [],
  );

  return <DatabaseListScreen initialCats={cats} />;
}
