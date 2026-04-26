"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeftIcon } from "./icons";

type PageContentProps = {
  children: ReactNode;
};

export function PageContent({ children }: PageContentProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 xs:px-4 mobile:px-5 tablet:space-y-5 tablet:px-8 tablet:py-6">
      {children}
    </div>
  );
}

export function TopTabs({
  active,
}: {
  active: "General" | "Medical" | "Interventions";
}) {
  const searchParams = useSearchParams();
  const catId = searchParams.get("id");
  const idParam = catId ? `?id=${catId}` : "";

  const tabs = [
    { label: "General" as const, href: `/dashboard/database/general${idParam}` },
    { label: "Medical" as const, href: `/dashboard/database/medical${idParam}` },
    { label: "Interventions" as const, href: `/dashboard/database/interventions${idParam}` },
  ];

  return (
    <div className="flex w-full border-b border-brand-dark/10 tablet:inline-flex tablet:w-auto tablet:gap-8">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className={`flex-1 pb-3 text-center text-sm tracking-wide transition-colors tablet:flex-none tablet:px-0 tablet:text-left ${
            tab.label === active
              ? "-mb-px border-b-2 border-brand-orange font-bold text-brand-orange"
              : "font-medium text-brand-dark/55 hover:text-brand-dark"
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
  /** Override the "Last updated:" label, e.g. "Just created!" */
  subtitle?: string;
};

export function DetailHeader({
  name = "Cat Name",
  lastUpdated,
  backHref = "/dashboard/database",
  subtitle,
}: DetailHeaderProps) {
  const subtitleText = subtitle ?? (lastUpdated ? `Last updated ${lastUpdated}` : "");

  return (
    <div className="flex items-center gap-3">
      <Link
        href={backHref}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-dark/15 bg-white text-brand-dark transition-colors hover:border-brand-dark/40 hover:bg-brand-cream-dark/40"
        aria-label="Back"
      >
        <ArrowLeftIcon className="h-4 w-4" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-2xl font-bold leading-tight tracking-tight text-brand-dark truncate">
          {name}
        </p>
        {subtitleText ? (
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-brand-dark/50">
            {subtitleText}
          </p>
        ) : null}
      </div>
    </div>
  );
}
