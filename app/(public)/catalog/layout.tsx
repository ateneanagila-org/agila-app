import type { ReactNode } from "react";

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex h-dvh flex-col overflow-hidden bg-slate-900">
      <header className="shrink-0 bg-lime-200">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center px-4">
          <p className="text-sm font-medium text-slate-900">CATalog</p>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto bg-white">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
