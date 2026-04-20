"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { ImagePlaceholderIcon } from "./icons";

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
    { label: "General" as const, href: `/database/general${idParam}` },
    { label: "Medical" as const, href: `/database/medical${idParam}` },
    { label: "Interventions" as const, href: `/database/interventions${idParam}` },
  ];

  return (
    <div className="flex w-full border-b border-slate-200 tablet:inline-flex tablet:w-auto tablet:items-center tablet:gap-5">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className={`flex-1 pb-2.5 text-center text-sm tracking-wide transition-colors tablet:flex-none tablet:text-left ${
            tab.label === active
              ? "-mb-px border-b-2 border-brand-orange font-bold text-brand-orange"
              : "font-medium text-slate-400 hover:text-slate-600"
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
  backHref = "/database",
  subtitle,
}: DetailHeaderProps) {
  const subtitleText = subtitle ?? (lastUpdated ? `Last updated: ${lastUpdated}` : "");

  return (
    <div className="overflow-hidden rounded-2xl bg-brand-green">
      <div className="flex items-center gap-3 p-3.5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <ImagePlaceholderIcon className="h-8 w-8 text-white/50" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-2xl font-bold leading-tight text-brand-yellow">
            {name}
          </p>
          {subtitleText ? (
            <p className="mt-0.5 text-xs font-semibold text-white/80">{subtitleText}</p>
          ) : null}
        </div>
        <Link
          href={backHref}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-dark text-lg font-bold text-white transition-opacity hover:opacity-80"
          aria-label="Back"
        >
          ‹
        </Link>
      </div>
    </div>
  );
}
