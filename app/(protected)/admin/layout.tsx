import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/rbac";

export default async function AdminOnlyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.profile.auth_role !== "Administrator") {
    redirect("/dashboard/overview");
  }
  return <>{children}</>;
}
