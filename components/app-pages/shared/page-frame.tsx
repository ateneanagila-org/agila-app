"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { ImagePlaceholderIcon, UploadIcon } from "./icons";

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
              ? "-mb-px border-b-2 border-slate-900 font-bold text-slate-900"
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
};

export function DetailHeader({
  name = "Cat Name",
  lastUpdated = "01/01/2026",
  backHref = "/database",
}: DetailHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="relative h-14 w-14 shrink-0">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200">
          <ImagePlaceholderIcon className="h-7 w-7 text-slate-400" />
        </div>
        <div className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-slate-500">
          <UploadIcon className="h-2.5 w-2.5 text-white" />
        </div>
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-base font-bold tracking-tight text-slate-900">{name}</p>
        <p className="mt-0.5 text-xs text-slate-500">Last Updated: {lastUpdated}</p>
      </div>
      <Link
        href={backHref}
        className="flex shrink-0 items-center gap-0.5 pt-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
      >
        <span className="text-base leading-none">&lsaquo;</span> Back
      </Link>
    </div>
  );
}
