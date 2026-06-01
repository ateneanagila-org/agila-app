import type { ReactNode } from "react";
import { BrandLogo } from "@/components/app-pages/shared/brand-logo";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex h-dvh flex-col overflow-hidden bg-brand-dark">
      <header className="shrink-0 bg-brand-dark">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4">
          <BrandLogo />
          {/* Auth-aware button wired in Task 7 */}
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto bg-brand-cream">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
