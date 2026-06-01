import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/rbac";

export default async function ApprovalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  const role = current.profile.auth_role;
  if (role !== "Administrator" && role !== "Manager") {
    redirect("/dashboard/sessions");
  }
  return <>{children}</>;
}
