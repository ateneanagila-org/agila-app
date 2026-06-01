import type { Metadata } from "next";
import { DatabaseMedicalScreen } from "@/components/app-pages/database/database-medical-screen";

export const metadata: Metadata = { title: "Database — Medical" };

export default function DatabaseMedicalPage() {
  return <DatabaseMedicalScreen />;
}
