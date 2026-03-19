import type { Metadata } from "next";
import { SessionsApprovalValidationScreen } from "@/components/app-pages/sessions/sessions-approval-validation-screen";

export const metadata: Metadata = { title: "Sessions — Validate Entry" };

export default function SessionsApprovalValidationPage() {
  return <SessionsApprovalValidationScreen />;
}
