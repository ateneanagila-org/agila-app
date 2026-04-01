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
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 mobile:px-5">
            <p className="text-lg font-semibold tracking-tight text-slate-900">CATalog</p>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-slate-400/60 ring-1 ring-slate-400/30" />
              <div className="space-y-1">
                <div className="h-0.5 w-4 rounded-full bg-slate-700" />
                <div className="h-0.5 w-4 rounded-full bg-slate-700" />
                <div className="h-0.5 w-4 rounded-full bg-slate-700" />
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-slate-100">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>

        <footer className="sticky bottom-0 z-20 border-t border-lime-300/50 bg-lime-200">
          <div className="mx-auto grid h-16 w-full max-w-7xl grid-cols-5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center gap-1 px-1 transition-colors ${
                    active ? "bg-lime-300/70" : "bg-lime-200"
                  }`}
                >
                  <div
                    className={`h-6 w-6 rounded-full transition-colors ${
                      active ? "bg-slate-700" : "bg-slate-400/60"
                    }`}
                  />
                  <span className={`text-[10px] tracking-wide ${
                    active ? "font-bold text-slate-900" : "font-semibold text-slate-700"
                  }`}>
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
            <h1 className="text-[1.75rem] font-semibold leading-none tracking-tight text-slate-900">
              CATalog
            </h1>
          </div>

          <nav className="mt-8 rounded-2xl bg-slate-100/80 p-5">
            <ul className="space-y-3.5">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2 text-left text-[0.95rem] transition-colors ${
                        active
                          ? "font-semibold text-slate-900"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-auto rounded-2xl bg-slate-100/80 px-4 py-4">
            <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-300/70 text-slate-500 ring-1 ring-slate-300/50">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M4 5h16v14H4z M8 9l2.5 3 2-2.5L16 14H8z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <p className="text-center text-sm font-medium text-slate-900">
              Niles Cabrera
            </p>
            <p className="text-center text-xs font-semibold tracking-wider text-slate-500">
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
