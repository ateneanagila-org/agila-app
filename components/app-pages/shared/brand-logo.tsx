import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  className?: string;
};

export function BrandLogo({ href = "/", className = "" }: BrandLogoProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 tablet:gap-2.5 ${className}`}
    >
      <Image
        src="/logos/white-with-text.png"
        alt="AGILA"
        width={40}
        height={40}
        className="h-7 w-7 object-contain tablet:h-9 tablet:w-9"
      />
      <span className="font-brand text-lg font-bold leading-none tracking-wider text-white tablet:text-xl">
        CATALOG
      </span>
    </Link>
  );
}
