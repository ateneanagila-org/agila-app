import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Access Restricted - AGILA",
};

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

export default function NotOnboardedPage() {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-brand-cream tablet:grid-cols-[1.1fr_1fr]">
      {/* ── Brand panel ── */}
      <aside className="relative overflow-hidden bg-brand-green px-8 py-10 tablet:flex tablet:flex-col tablet:justify-between tablet:px-14 tablet:py-12">
        <PawIcon className="pointer-events-none absolute -right-8 -top-6 h-56 w-56 text-white/5 tablet:h-72 tablet:w-72" />
        <PawIcon className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rotate-12 text-white/5 tablet:h-64 tablet:w-64" />
        <PawIcon className="pointer-events-none absolute right-1/3 top-1/2 hidden h-24 w-24 -rotate-12 text-white/5 tablet:block" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-dark">
            <PawIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">
              Ateneo de Manila
            </p>
            <p className="font-brand text-lg font-bold leading-tight text-white">
              AGILA CATALOG
            </p>
          </div>
        </div>

        <div className="relative mt-10 hidden tablet:block">
          <p className="font-heading text-5xl font-bold leading-[1.05] tracking-tight text-brand-yellow laptop:text-6xl">
            Every cat,
            <br />
            accounted for.
          </p>
          <p className="mt-5 max-w-md text-base font-medium text-white/80">
            Track, care for, and rehome the cats of Ateneo — one session at a time.
          </p>
        </div>

        <div className="relative mt-8 hidden items-center gap-3 tablet:flex">
          <span className="h-px w-12 bg-white/30" />
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
            TNVR · Care · Adoption
          </p>
        </div>
      </aside>

      {/* ── Content panel ── */}
      <main className="flex items-center justify-center px-6 py-10 tablet:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 tablet:mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-orange">
              Access restricted
            </p>
            <h1 className="mt-2 font-heading text-4xl font-bold tracking-tight text-brand-dark tablet:text-5xl">
              Not onboarded yet
            </h1>
            <p className="mt-3 text-sm text-brand-dark/70">
              Your account hasn&apos;t been added to the catalog system. Contact
              your AGILA coordinator to get access.
            </p>
          </div>

          <Link
            href="/login"
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-brand-dark px-6 py-4 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Back to sign in
          </Link>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-brand-dark/10" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-dark/40">
              Or
            </span>
            <span className="h-px flex-1 bg-brand-dark/10" />
          </div>

          <Link
            href="/"
            className="block rounded-2xl bg-brand-mint px-5 py-4 transition-opacity hover:opacity-90"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Just browsing?
            </p>
            <p className="mt-1 text-sm font-semibold text-brand-dark">
              View the public adoption catalog →
            </p>
          </Link>

          <p className="mt-10 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-dark/40">
            Ateneo de Manila University
          </p>
        </div>
      </main>
    </div>
  );
}
