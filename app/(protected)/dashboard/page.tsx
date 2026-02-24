"use client";

import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { userData } = useAuth();

  return (
    <>
      <div>Welcome, {userData!.supabaseUser?.email}</div>
    </>
  );
}
