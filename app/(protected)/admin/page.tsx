"use client";

import { useAuth } from "@/contexts/auth-context";

export default function AdminPage() {
  const { userData } = useAuth();

  return (
    <>
      <div>Welcome, {userData!.supabaseUser?.email}</div>
    </>
  );
}
