import type { Metadata } from "next";
import Link from "next/link";
import { googleLogin } from "./actions";

export const metadata: Metadata = {
  title: "Sign In - AGILA",
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

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-brand-cream tablet:grid-cols-[1.1fr_1fr]">
      {/* ── Brand panel ── */}
      <aside className="relative overflow-hidden bg-brand-green px-8 py-10 tablet:flex tablet:flex-col tablet:justify-between tablet:px-14 tablet:py-12">
        {/* Decorative paws */}
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

      {/* ── Form panel ── */}
      <main className="flex items-center justify-center px-6 py-10 tablet:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 tablet:mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-orange">
              Welcome back
            </p>
            <h1 className="mt-2 font-heading text-4xl font-bold tracking-tight text-brand-dark tablet:text-5xl">
              Sign in
            </h1>
            <p className="mt-3 text-sm text-brand-dark/70">
              Use your Ateneo Google account to manage the catalog.
            </p>
          </div>

          <form action={googleLogin}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-brand-dark px-6 py-4 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              </span>
              Continue with Google
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-brand-dark/10" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-dark/40">
              Secured access
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
