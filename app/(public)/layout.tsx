import type { ReactNode } from "react";
import Link from "next/link";

function PawIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <ellipse cx="5" cy="9" rx="2" ry="3" />
      <ellipse cx="10" cy="6.5" rx="2" ry="3" />
      <ellipse cx="14" cy="6.5" rx="2" ry="3" />
      <ellipse cx="19" cy="9" rx="2" ry="3" />
      <path d="M12 12c-3.5 0-7 2.5-6.5 6.5.3 2 2 3.5 4 3.5h5c2 0 3.7-1.5 4-3.5C19 14.5 15.5 12 12 12z" />
    </svg>
  );
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex h-dvh flex-col overflow-hidden bg-brand-dark">
      <header className="shrink-0 bg-brand-dark">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <PawIcon className="h-7 w-7 text-white" />
            <div>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-white/60">
                AGILA
              </p>
              <p className="font-brand text-base leading-tight tracking-wider text-white">
                CATALOG
              </p>
            </div>
          </Link>
          <button
            type="button"
            aria-label="Menu"
            className="flex h-8 w-8 flex-col items-center justify-center gap-1.5"
          >
            <span className="h-0.5 w-5 bg-white" />
            <span className="h-0.5 w-5 bg-white" />
            <span className="h-0.5 w-5 bg-white" />
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto bg-brand-cream">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
