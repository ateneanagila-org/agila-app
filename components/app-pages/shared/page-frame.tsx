import Link from "next/link";
import type { ReactNode } from "react";

type PageContentProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

export function PageContent({ title, subtitle, children }: PageContentProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 px-3 py-4 xs:px-4 mobile:px-5 tablet:space-y-4 tablet:px-8 tablet:py-6">
      {title ? (
        <div className="rounded-lg bg-emerald-200 px-3 py-2 text-emerald-950 tablet:rounded-xl tablet:px-4 tablet:py-3">
          <h1 className="text-sm font-bold tablet:text-base">{title}</h1>
          {subtitle ? (
            <p className="text-xs font-medium tablet:text-sm">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}


export function TopTabs({
  active,
}: {
  active: "General" | "Medical" | "Interventions";
}) {
  const tabs = [
    { label: "General" as const, href: "/database/general" },
    { label: "Medical" as const, href: "/database/medical" },
    { label: "Interventions" as const, href: "/database/interventions" },
  ];

  return (
    <div className="flex border-b border-slate-200">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className={`flex-1 pb-2.5 text-center text-sm transition-colors ${
            tab.label === active
              ? "border-b-2 border-slate-900 -mb-px font-bold text-slate-900"
              : "font-medium text-slate-400"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

type DetailHeaderProps = {
  name?: string;
  lastUpdated?: string;
  backHref?: string;
};

export function DetailHeader({
  name = "Cat Name",
  lastUpdated = "01/01/2201",
  backHref = "/database",
}: DetailHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="relative h-14 w-14 shrink-0">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-200">
          <svg
            className="h-7 w-7 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
            <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="m21 15-5-5L5 21"
            />
          </svg>
        </div>
        <div className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-slate-500">
          <svg
            className="h-2.5 w-2.5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
        </div>
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-base font-bold text-slate-900">{name}</p>
        <p className="text-xs text-slate-500">Last Updated At: {lastUpdated}</p>
      </div>
      <Link
        href={backHref}
        className="flex shrink-0 items-center gap-0.5 pt-1 text-sm text-slate-600"
      >
        <span className="text-base leading-none">‹</span> Back
      </Link>
    </div>
  );
}
