import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
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
          404
        </p>
        <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight text-brand-dark mobile:text-3xl">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-dark/65">
          This page doesn&apos;t exist, or the cat you were looking for is no
          longer in the catalog.
        </p>

        <div className="mt-6 flex flex-col gap-2.5 tablet:mt-7">
          <Link
            href="/"
            className="flex w-full items-center justify-center rounded-2xl bg-brand-green px-6 py-3.5 text-sm font-bold text-brand-green-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            Back home
          </Link>
        </div>

        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-dark/40">
          Ateneo de Manila University
        </p>
      </div>
    </main>
  );
}
