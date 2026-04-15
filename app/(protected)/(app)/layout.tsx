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

function PawIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <ellipse cx="5" cy="9" rx="2" ry="3" />
      <ellipse cx="10" cy="6.5" rx="2" ry="3" />
      <ellipse cx="14" cy="6.5" rx="2" ry="3" />
      <ellipse cx="19" cy="9" rx="2" ry="3" />
      <path d="M12 12c-3.5 0-7 2.5-6.5 6.5.3 2 2 3.5 4 3.5h5c2 0 3.7-1.5 4-3.5C19 14.5 15.5 12 12 12z" />
    </svg>
  );
}

function NavIcon({ label, active }: { label: NavItem["label"]; active: boolean }) {
  const cls = `h-5 w-5 ${active ? "text-white" : "text-white/50"}`;
  if (label === "Overview") return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" />
    </svg>
  );
  if (label === "TNVR") return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 18V9M8 18V5M13 18v-7M18 18v-3" />
    </svg>
  );
  if (label === "Database") return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </svg>
  );
  if (label === "Sessions") return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 16h4M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6" />
    </svg>
  );
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20H7a2 2 0 01-2-2V6a2 2 0 012-2h7l5 5v9a2 2 0 01-2 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20H7a2 2 0 01-2-2V6M16 3H8a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7l-4-4z" />
      <circle cx="12" cy="14" r="3" />
      <path d="M12 12V8M10 14H8" />
    </svg>
  );
}

function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? "text-white" : "text-white/50"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="7" r="3" />
      <path strokeLinecap="round" d="M3 21v-1a6 6 0 016-6h.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path strokeLinecap="round" d="M14 21v-1a4 4 0 014-4h2a4 4 0 014 4v1" />
    </svg>
  );
}

export default function AppRoutesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="fixed inset-0 overflow-hidden bg-brand-dark text-foreground">
      {/* ── Mobile layout ── */}
      <div className="flex h-dvh w-full flex-col tablet:hidden">
        <header className="sticky top-0 z-20 bg-brand-dark">
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 mobile:px-5">
            <div className="flex items-center gap-2.5">
              <PawIcon className="h-7 w-7 text-white" />
              <div>
                <p className="text-[8px] font-semibold uppercase tracking-widest text-white/60">AGILA</p>
                <p className="font-heading text-base font-bold leading-tight tracking-wider text-white">CATALOG</p>
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/80" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="3.5" />
                <path strokeLinecap="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-brand-cream">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>

        <footer className="sticky bottom-0 z-20 border-t border-white/10 bg-brand-dark">
          <div className="mx-auto grid h-16 w-full max-w-7xl grid-cols-5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center gap-1 px-1 transition-colors ${
                    active ? "bg-white/10" : "bg-transparent"
                  }`}
                >
                  {item.label === "Users" ? (
                    <UsersIcon active={active} />
                  ) : (
                    <NavIcon label={item.label} active={active} />
                  )}
                  <span className={`text-[9px] tracking-wide ${
                    active ? "font-bold text-white" : "font-medium text-white/50"
                  }`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </footer>
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden h-dvh w-full tablet:flex">
        <aside className="flex w-56 flex-col bg-brand-green px-5 py-6">
          <div className="flex items-center gap-2.5">
            <PawIcon className="h-7 w-7 text-white" />
            <div>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-white/60">AGILA</p>
              <p className="font-heading text-base font-bold leading-tight tracking-wider text-white">CATALOG</p>
            </div>
          </div>

          <nav className="mt-8 rounded-2xl bg-white/10 p-5">
            <ul className="space-y-3.5">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 text-left text-[0.9rem] transition-colors ${
                        active
                          ? "font-semibold text-white"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      {active && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" />
                      )}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-auto rounded-2xl bg-white/10 px-4 py-4">
            <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white/60 ring-1 ring-white/20">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="3.5" />
                <path strokeLinecap="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <p className="text-center text-sm font-medium text-white">
              Niles Cabrera
            </p>
            <p className="text-center text-xs font-semibold tracking-wider text-white/60">
              ADMIN
            </p>
          </div>
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto bg-brand-cream">
          <div className="mx-auto w-full max-w-none">{children}</div>
        </main>
      </div>
    </div>
  );
}
