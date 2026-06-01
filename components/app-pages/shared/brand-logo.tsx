import Link from "next/link";

function PawIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <ellipse cx="5" cy="9" rx="2" ry="3" />
      <ellipse cx="10" cy="6.5" rx="2" ry="3" />
      <ellipse cx="14" cy="6.5" rx="2" ry="3" />
      <ellipse cx="19" cy="9" rx="2" ry="3" />
      <path d="M12 12c-3.5 0-7 2.5-6.5 6.5.3 2 2 3.5 4 3.5h5c2 0 3.7-1.5 4-3.5C19 14.5 15.5 12 12 12z" />
    </svg>
  );
}

type BrandLogoProps = {
  /** `boxed` = paw in a rounded square (sidebar/login); `inline` = bare paw (headers). */
  variant?: "inline" | "boxed";
  /** Eyebrow line above CATALOG. */
  eyebrow?: string;
  /** Link target. */
  href?: string;
  className?: string;
};

export function BrandLogo({
  variant = "inline",
  eyebrow = "AGILA",
  href = "/",
  className = "",
}: BrandLogoProps) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 ${className}`}>
      {variant === "boxed" ? (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green">
          <PawIcon className="h-6 w-6 text-white" />
        </span>
      ) : (
        <PawIcon className="h-7 w-7 text-white" />
      )}
      <span>
        <span className="block text-[8px] font-semibold uppercase tracking-widest text-white/60">
          {eyebrow}
        </span>
        <span className="block font-brand text-base leading-tight tracking-wider text-white">
          CATALOG
        </span>
      </span>
    </Link>
  );
}
