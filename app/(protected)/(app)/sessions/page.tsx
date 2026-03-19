import type { Metadata } from "next";
import { SessionsScreen } from "@/components/app-pages/sessions/sessions-screen";

export const metadata: Metadata = {
  title: "Sessions",
};

export default function SessionsPage() {
  return <SessionsScreen />;
}
