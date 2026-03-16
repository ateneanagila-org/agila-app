import type { ReactNode } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/mobile-wireframes/overview", label: "Overview" },
  { href: "/mobile-wireframes/tnvr", label: "TNVR" },
  { href: "/mobile-wireframes/database", label: "Database" },
  { href: "/mobile-wireframes/sessions", label: "Sessions" },
];

export default function MobileWireframesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-100 px-2 py-3 xs:px-3 mobile:px-4 mobile:py-4 tablet:px-6">
      <div className="mx-auto w-full max-w-sm mobile:max-w-md">
        <div className="mb-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-sm font-bold text-slate-900">
            AGILA Mobile Wireframes
          </h1>
          <p className="text-xs text-slate-600">
            Each screen has its own route and hardcoded sample values.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md bg-slate-200 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-300"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {children}
      </div>
    </main>
  );
}
