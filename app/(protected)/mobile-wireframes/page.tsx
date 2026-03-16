import Link from "next/link";

const ROUTES = [
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

export default function MobileWireframesIndexPage() {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-bold text-slate-900">Mobile Screens</h2>
      <p className="mb-3 text-xs text-slate-600">
        Open any screen below to view the mobile layout blocks.
      </p>
      <div className="grid grid-cols-1 gap-2">
        {ROUTES.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className="rounded-lg bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-200"
          >
            {route.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
