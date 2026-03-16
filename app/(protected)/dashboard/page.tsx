"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";

const MOBILE_ROUTES = [
  { href: "/mobile-wireframes/overview", label: "Overview" },
  { href: "/mobile-wireframes/tnvr", label: "TNVR" },
  { href: "/mobile-wireframes/database", label: "Database List" },
  {
    href: "/mobile-wireframes/database/general",
    label: "Database Detail - General",
  },
  {
    href: "/mobile-wireframes/database/medical",
    label: "Database Detail - Medical",
  },
  {
    href: "/mobile-wireframes/database/interventions",
    label: "Database Detail - Interventions",
  },
  { href: "/mobile-wireframes/sessions", label: "Census Sessions" },
  { href: "/mobile-wireframes/sessions/manager", label: "Sessions Manager" },
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
