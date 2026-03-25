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
  { label: "Users", href: "/users" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppRoutesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-900 text-slate-900">
      <div className="flex h-dvh w-full flex-col tablet:hidden">
        <header className="sticky top-0 z-20 bg-lime-200">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 mobile:px-5">
            <p className="text-lg font-medium">CATalog</p>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-slate-500" />
              <div className="space-y-1">
                <div className="h-1 w-4 rounded bg-slate-700" />
                <div className="h-1 w-4 rounded bg-slate-700" />
                <div className="h-1 w-4 rounded bg-slate-700" />
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-slate-100">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>

        <footer className="sticky bottom-0 z-20 bg-lime-200">
          <div className="mx-auto grid h-17.5 w-full max-w-7xl grid-cols-5">
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
          </div>
        </footer>
      </div>

      <div className="hidden h-dvh w-full tablet:flex">
        <aside className="flex w-56 flex-col bg-lime-200 px-5 py-6">
          <div>
            <h1 className="text-[2rem] font-medium leading-none text-slate-900">
              CATalog
            </h1>
          </div>

          <nav className="mt-8 rounded-3xl bg-slate-100 p-5">
            <ul className="space-y-4">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block text-left text-lg transition-colors ${
                        active
                          ? "font-semibold text-slate-900"
                          : "text-slate-800"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-auto rounded-2xl bg-slate-100 px-4 py-5">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-300 text-slate-600">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M4 5h16v14H4z M8 9l2.5 3 2-2.5L16 14H8z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <p className="text-center text-base text-slate-900">
              Niles Cabrera
            </p>
            <p className="text-center text-base font-medium text-slate-900">
              ADMIN
            </p>
          </div>
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto bg-slate-100">
          <div className="mx-auto w-full max-w-none">{children}</div>
        </main>
      </div>
    </div>
  );
}
