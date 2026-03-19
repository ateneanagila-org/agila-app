import type { Metadata } from "next";
import { DatabaseListScreen } from "@/components/app-pages/database/database-list-screen";

export const metadata: Metadata = {
  title: "Database",
};

export default function DatabasePage() {
  return <DatabaseListScreen />;
}
