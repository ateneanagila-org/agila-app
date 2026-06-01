"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { UserMenu } from "@/components/app-pages/shared/user-menu";
import { useAuth } from "@/contexts/auth-context";
import { BrandLogo } from "@/components/app-pages/shared/brand-logo";

type NavItem = {
  label: "Overview" | "TNVR" | "Database" | "Sessions" | "Users";
  href: string;
};

const BASE_NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard/overview" },
  { label: "TNVR", href: "/dashboard/tnvr" },
  { label: "Database", href: "/dashboard/database" },
  { label: "Sessions", href: "/dashboard/sessions" },
  { label: "Users", href: "/dashboard/users" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}


function NavIcon({
  label,
  active,
}: {
  label: NavItem["label"];
  active: boolean;
}) {
  const cls = `h-5 w-5 ${active ? "text-white" : "text-white/50"}`;
  if (label === "Overview")
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"
        />
      </svg>
    );
  if (label === "TNVR")
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 18V9M8 18V5M13 18v-7M18 18v-3"
        />
      </svg>
    );
  if (label === "Database")
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
        <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
      </svg>
    );
  if (label === "Sessions")
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h6M9 16h4M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6" />
      </svg>
    );
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20H7a2 2 0 01-2-2V6a2 2 0 012-2h7l5 5v9a2 2 0 01-2 2z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20H7a2 2 0 01-2-2V6M16 3H8a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7l-4-4z"
      />
      <circle cx="12" cy="14" r="3" />
      <path d="M12 12V8M10 14H8" />
    </svg>
  );
}

function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${active ? "text-white" : "text-white/50"}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="9" cy="7" r="3" />
      <path strokeLinecap="round" d="M3 21v-1a6 6 0 016-6h.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path strokeLinecap="round" d="M14 21v-1a4 4 0 014-4h2a4 4 0 014 4v1" />
    </svg>
  );
}

export default function AppRoutesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const NAV_ITEMS = useMemo<NavItem[]>(
    () =>
      isAdmin
        ? BASE_NAV_ITEMS
        : BASE_NAV_ITEMS.filter((item) => item.label !== "Users"),
    [isAdmin],
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-brand-dark text-foreground">
      {/* ── Mobile layout ── */}
      <div className="flex h-dvh w-full flex-col tablet:hidden">
        <header className="sticky top-0 z-20 bg-brand-dark">
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 mobile:px-5">
            <BrandLogo />
            <UserMenu variant="mobile" />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-brand-cream">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>

        <footer className="sticky bottom-0 z-20 border-t border-white/10 bg-brand-dark">
          <div
            className="mx-auto grid h-16 w-full max-w-7xl"
            style={{
              gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))`,
            }}
          >
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
                  <span
                    className={`text-[9px] tracking-wide ${
                      active
                        ? "font-bold text-white"
                        : "font-medium text-white/50"
                    }`}
                  >
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
        <aside className="flex w-60 flex-col bg-brand-dark px-5 py-6">
          <div className="px-1">
            <BrandLogo variant="boxed" />
          </div>

          <nav className="mt-8 flex-1">
            <ul className="space-y-1.5">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? "bg-brand-orange font-semibold text-white shadow-sm"
                          : "font-medium text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span
                        className={
                          active
                            ? "text-white"
                            : "text-white/50 group-hover:text-white"
                        }
                      >
                        {item.label === "Users" ? (
                          <UsersIcon active={active} />
                        ) : (
                          <NavIcon label={item.label} active={active} />
                        )}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-auto">
            <UserMenu variant="sidebar" />
          </div>
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto bg-brand-cream">
          <div className="mx-auto w-full max-w-none">{children}</div>
        </main>
      </div>
    </div>
  );
}
