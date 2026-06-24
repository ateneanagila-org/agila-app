"use client";

import Image from "next/image";
import { useState } from "react";
import { CatIcon } from "@/components/app-pages/shared/icons";
import {
  getPhotoTransformStyle,
  isIdentityPosition,
  type PhotoPosition,
} from "@/lib/photo-position";

type CatPhotoProps = {
  photoUrl?: string | null;
  name?: string | null;
  className?: string;
  iconClassName?: string;
  sizes?: string;
  fit?: "cover" | "contain";
  /**
   * Crop applied at render time. Identity (or omitted) renders plain cover —
   * exactly how legacy baked crops look, with no natural-size read or flash.
   */
  position?: PhotoPosition | null;
};

export function CatPhoto({
  photoUrl,
  name,
  className = "",
  iconClassName = "h-10 w-10 text-brand-green/40",
  sizes = "160px",
  fit = "contain",
  position,
}: CatPhotoProps) {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(
    null,
  );

  if (!photoUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-brand-cream-dark/40 ${className}`}
      >
        <CatIcon className={iconClassName} />
      </div>
    );
  }

  const adjusted = position && !isIdentityPosition(position);

  // Adjusted crops render a positioned <img> (the stored blob is the full
  // original; the crop is this transform). Until natural size is known we fall
  // back to centered cover, so the worst case matches the identity path.
  if (adjusted) {
    return (
      <div className={`relative overflow-hidden bg-brand-cream-dark/40 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt={name || "Cat"}
          draggable={false}
          onLoad={(e) =>
            setNatural({
              width: e.currentTarget.naturalWidth,
              height: e.currentTarget.naturalHeight,
            })
          }
          className="absolute max-w-none select-none"
          style={getPhotoTransformStyle(natural, position)}
        />
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
