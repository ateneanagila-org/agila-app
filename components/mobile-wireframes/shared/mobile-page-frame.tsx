import type { ReactNode } from "react";

type MobileNavItem = "Overview" | "TNVR" | "Database" | "Sessions" | "Users";

type MobilePageFrameProps = {
  title: string;
  subtitle?: string;
  activeNav: MobileNavItem;
  children: ReactNode;
};

const NAV_ITEMS: MobileNavItem[] = [
  "Overview",
  "TNVR",
  "Database",
  "Sessions",
  "Users",
];

export function MobilePageFrame({
  title,
  subtitle,
  activeNav,
  children,
}: MobilePageFrameProps) {
  return (
    <section className="min-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <header className="bg-slate-900 px-4 py-3 text-white">
        <p className="text-sm font-semibold">CATalog</p>
        <h1 className="text-base font-bold">{title}</h1>
        {subtitle ? <p className="text-xs text-slate-200">{subtitle}</p> : null}
      </header>

      <div className="bg-slate-50 px-3 py-4 xs:px-4 mobile:px-5">
        {children}
      </div>

      <footer className="grid grid-cols-5 bg-slate-100">
        {NAV_ITEMS.map((item) => {
          const active = item === activeNav;
          return (
            <div
              key={item}
              className={`flex flex-col items-center gap-1 px-1 py-2 ${active ? "bg-blue-100" : "bg-slate-100"}`}
            >
              <div
                className={`h-7 w-7 rounded-full ${active ? "bg-blue-500" : "bg-slate-300"}`}
              />
              <span className="text-[10px] font-medium text-slate-700">
                {item}
              </span>
            </div>
          );
        })}
      </footer>
    </section>
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
      className={`rounded-lg px-3 py-2 text-xs font-semibold ${TONE_MAP[tone]} ${className}`}
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
    <div className="grid grid-cols-3 gap-2">
      {tabs.map((tab) => (
        <div
          key={tab}
          className={`rounded-lg px-2 py-2 text-center text-xs font-semibold ${
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
