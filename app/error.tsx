"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { REFERRAL_SHEET_URL } from "@/lib/constants";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand-cream px-4 py-8 mobile:px-6 tablet:py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-brand-dark/8 mobile:p-7 tablet:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green shadow-sm tablet:h-16 tablet:w-16">
          <Image
            src="/logos/white-no-text.png"
            alt="AGILA"
            width={40}
            height={40}
            className="h-8 w-8 object-contain tablet:h-9 tablet:w-9"
          />
        </div>

        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.25em] text-brand-orange tablet:mt-6">
          Error
        </p>
        <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight text-brand-dark mobile:text-3xl">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-dark/65">
          An unexpected error occurred. Try again, or head back to safety.
        </p>

        <div className="mt-6 flex flex-col gap-2.5 tablet:mt-7">
          <button
            type="button"
            onClick={reset}
            className="flex w-full items-center justify-center rounded-2xl bg-brand-green px-6 py-3.5 text-sm font-bold text-brand-green-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="flex w-full items-center justify-center rounded-2xl border-2 border-brand-dark/15 px-6 py-3.5 text-sm font-bold text-brand-dark/70 transition-colors hover:border-brand-dark/40 hover:text-brand-dark"
          >
            Back home
          </Link>
          {isLoggedIn ? (
            <a
              href={REFERRAL_SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center rounded-2xl bg-brand-orange px-6 py-3.5 text-sm font-bold text-brand-orange-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              Sheets (Backup)
            </a>
          ) : null}
        </div>

        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-dark/40">
          Ateneo de Manila University
        </p>
      </div>
    </main>
  );
}
