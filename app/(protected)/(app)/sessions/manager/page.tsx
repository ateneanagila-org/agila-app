import type { Metadata } from "next";
import { SessionsManagerScreen } from "@/components/app-pages/sessions/sessions-manager-screen";

export const metadata: Metadata = { title: "Sessions — Manager" };

export default function SessionsManagerPage() {
  return <SessionsManagerScreen />;
}
