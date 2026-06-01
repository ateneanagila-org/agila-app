import type { Metadata } from "next";
import { DatabaseGeneralScreen } from "@/components/app-pages/database/database-general-screen";

export const metadata: Metadata = { title: "Database — General" };

export default function DatabaseGeneralPage() {
  return <DatabaseGeneralScreen />;
}
