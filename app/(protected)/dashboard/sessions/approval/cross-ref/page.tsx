import type { Metadata } from "next";
import { SessionsApprovalCrossRefScreen } from "@/components/app-pages/sessions/sessions-approval-crossref-screen";

export const metadata: Metadata = { title: "Sessions — Cross-Reference" };

export default function SessionsApprovalCrossRefPage() {
  return <SessionsApprovalCrossRefScreen />;
}
