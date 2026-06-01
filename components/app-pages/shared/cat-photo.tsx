"use client";

import Image from "next/image";
import { CatIcon } from "@/components/app-pages/shared/icons";

type CatPhotoProps = {
  photoUrl?: string | null;
  name?: string | null;
  className?: string;
  iconClassName?: string;
  sizes?: string;
  fit?: "cover" | "contain";
};

export function CatPhoto({
  photoUrl,
  name,
  className = "",
  iconClassName = "h-10 w-10 text-brand-green/40",
  sizes = "160px",
  fit = "contain",
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
    <div className={`relative overflow-hidden bg-brand-cream-dark/40 ${className}`}>
      <Image
        src={photoUrl}
        alt={name || "Cat"}
        fill
        sizes={sizes}
        className={fit === "cover" ? "object-cover" : "object-contain"}
        unoptimized
      />
    </div>
  );
}
