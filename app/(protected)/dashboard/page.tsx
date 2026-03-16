"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";

const MOBILE_ROUTES = [
  { href: "/overview", label: "Overview" },
  { href: "/tnvr", label: "TNVR" },
  { href: "/database", label: "Database List" },
  { href: "/database/general", label: "Database Detail - General" },
  { href: "/database/medical", label: "Database Detail - Medical" },
  {
    href: "/database/interventions",
    label: "Database Detail - Interventions",
  },
  { href: "/sessions", label: "Census Sessions" },
  { href: "/sessions/manager", label: "Sessions Manager" },
];

export default function DashboardPage() {
  const { userData } = useAuth();

  return (
    <main className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Mobile Wireframe Routes</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {userData?.supabaseUser?.email}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {MOBILE_ROUTES.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className="rounded-lg border bg-card px-4 py-3 text-sm font-medium text-card-foreground hover:bg-muted"
          >
            {route.label}
          </Link>
        ))}
      </div>
    </main>
  );
}
