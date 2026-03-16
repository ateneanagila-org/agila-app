"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  label: "Overview" | "TNVR" | "Database" | "Sessions" | "Users";
  href: string;
};

const NAV_ITEMS: NavItem[] = [
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

export default function AppRoutesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-900">
      <header className="bg-lime-200">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 mobile:px-5 tablet:h-18 tablet:px-8">
          <p className="text-4.5 font-medium">CATalog</p>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-500 tablet:h-9 tablet:w-9" />
            <div className="space-y-1">
              <div className="h-1 w-4 rounded bg-slate-700 tablet:w-5" />
              <div className="h-1 w-4 rounded bg-slate-700 tablet:w-5" />
              <div className="h-1 w-4 rounded bg-slate-700 tablet:w-5" />
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100dvh-8.25rem)] bg-slate-100 tablet:min-h-[calc(100dvh-8.5rem)]">
        {children}
      </main>

      <footer className="bg-lime-200">
        <div className="mx-auto grid h-17.5 w-full max-w-7xl grid-cols-5 tablet:h-20">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 px-1 tablet:gap-1.5 ${
                  active ? "bg-lime-300" : "bg-lime-200"
                }`}
              >
                <div
                  className={`h-7 w-7 rounded-full ${
                    active ? "bg-slate-700" : "bg-slate-500"
                  } tablet:h-8 tablet:w-8`}
                />
                <span className="text-[11px] font-semibold text-slate-900 tablet:text-xs">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </footer>
    </div>
  );
}
