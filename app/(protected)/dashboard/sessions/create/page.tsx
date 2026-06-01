import type { Metadata } from "next";
import { SessionsCreateScreen } from "@/components/app-pages/sessions/sessions-create-screen";

export const metadata: Metadata = { title: "Sessions — Create" };

export default function SessionsCreatePage() {
  return <SessionsCreateScreen />;
}
