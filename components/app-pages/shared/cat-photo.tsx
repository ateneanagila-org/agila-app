"use client";

import Image from "next/image";
import { CatIcon } from "@/components/app-pages/shared/icons";

type CatPhotoProps = {
  photoUrl?: string | null;
  name?: string | null;
  className?: string;
  iconClassName?: string;
  sizes?: string;
};

export function CatPhoto({
  photoUrl,
  name,
  className = "",
  iconClassName = "h-10 w-10 text-brand-green/40",
  sizes = "160px",
}: CatPhotoProps) {
  if (!photoUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-brand-cream-dark/40 ${className}`}
      >
        <CatIcon className={iconClassName} />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-white/10 ${className}`}>
      <Image
        src={photoUrl}
        alt={name || "Cat"}
        fill
        sizes={sizes}
        className="object-cover"
        unoptimized
      />
    </div>
  );
}
