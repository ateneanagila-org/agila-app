"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AppLinks } from "@/lib/constants";

const LinksContext = createContext<AppLinks | null>(null);

/**
 * Distributes the referral links resolved server-side in (protected)/layout.tsx,
 * mirroring how AuthProvider distributes the profile. Values are already
 * resolved against the compiled-in defaults, so consumers cannot tell a
 * configured link from a fallback.
 */
export function LinksProvider({
  children,
  links,
}: {
  children: ReactNode;
  links: AppLinks;
}) {
  return <LinksContext.Provider value={links}>{children}</LinksContext.Provider>;
}

export function useLinks(): AppLinks {
  const context = useContext(LinksContext);
  if (!context) {
    throw new Error("useLinks must be used within LinksProvider");
  }
  return context;
}
