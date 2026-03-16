"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type MobileNavItem = {
  label: "Overview" | "TNVR" | "Database" | "Sessions" | "Users";
  href: string;
};

const NAV_ITEMS: MobileNavItem[] = [
  { label: "Overview", href: "/overview" },
  { label: "TNVR", href: "/tnvr" },
  { label: "Database", href: "/database" },
  { label: "Sessions", href: "/sessions" },
  { label: "Users", href: "/admin" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-slate-900 px-2 py-2 xs:px-3 mobile:px-4 tablet:px-6">
      <section className="mx-auto flex min-h-[calc(100dvh-1rem)] w-full max-w-sm flex-col overflow-hidden rounded-lg bg-slate-200 mobile:max-w-md">
        <header className="flex h-16 items-center justify-between bg-lime-200 px-4 text-slate-900">
          <p className="text-4.5 font-medium">CATalog</p>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-500" />
            <div className="space-y-1">
              <div className="h-1 w-4 rounded bg-slate-700" />
              <div className="h-1 w-4 rounded bg-slate-700" />
              <div className="h-1 w-4 rounded bg-slate-700" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-100">{children}</div>

        <footer className="grid h-17.5 grid-cols-5 bg-lime-200">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 px-1 ${
                  active ? "bg-lime-300" : "bg-lime-200"
                }`}
              >
                <div
                  className={`h-7 w-7 rounded-full ${
                    active ? "bg-slate-700" : "bg-slate-500"
                  }`}
                />
                <span className="text-[11px] font-semibold text-slate-900">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </footer>
      </section>
    </main>
  );
}
