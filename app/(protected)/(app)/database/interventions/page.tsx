import type { Metadata } from "next";
import { DatabaseInterventionsScreen } from "@/components/app-pages/database/database-interventions-screen";

export const metadata: Metadata = { title: "Database — Interventions" };

export default function DatabaseInterventionsPage() {
  return <DatabaseInterventionsScreen />;
}
