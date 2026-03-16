import type { ReactNode } from "react";

type PageContentProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function PageContent({ title, subtitle, children }: PageContentProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 px-3 py-4 xs:px-4 mobile:px-5 tablet:space-y-4 tablet:px-8 tablet:py-6">
      <div className="rounded-lg bg-emerald-200 px-3 py-2 text-emerald-950 tablet:rounded-xl tablet:px-4 tablet:py-3">
        <h1 className="text-sm font-bold tablet:text-base">{title}</h1>
        {subtitle ? (
          <p className="text-xs font-medium tablet:text-sm">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

type ColorBlockProps = {
  label: string;
  className?: string;
  tone?: "sky" | "emerald" | "amber" | "rose" | "violet" | "slate";
};

const TONE_MAP = {
  sky: "bg-sky-200 text-sky-950",
  emerald: "bg-emerald-200 text-emerald-950",
  amber: "bg-amber-200 text-amber-950",
  rose: "bg-rose-200 text-rose-950",
  violet: "bg-violet-200 text-violet-950",
  slate: "bg-slate-200 text-slate-900",
};

export function ColorBlock({
  label,
  className = "",
  tone = "slate",
}: ColorBlockProps) {
  return (
    <div
      className={`rounded-lg px-3 py-2 text-xs font-semibold tablet:rounded-xl tablet:px-4 tablet:py-3 tablet:text-sm ${TONE_MAP[tone]} ${className}`}
    >
      {label}
    </div>
  );
}

export function TopTabs({
  active,
}: {
  active: "General" | "Medical" | "Interventions";
}) {
  const tabs = ["General", "Medical", "Interventions"] as const;

  return (
    <div className="grid grid-cols-3 gap-2 tablet:gap-3">
      {tabs.map((tab) => (
        <div
          key={tab}
          className={`rounded-lg px-2 py-2 text-center text-xs font-semibold tablet:rounded-xl tablet:px-4 tablet:py-3 tablet:text-sm ${
            tab === active
              ? "bg-indigo-500 text-white"
              : "bg-indigo-100 text-indigo-900"
          }`}
        >
          {tab}
        </div>
      ))}
    </div>
  );
}
