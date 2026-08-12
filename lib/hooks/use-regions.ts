"use client";

import { useState, useEffect, useRef } from "react";
import { listRegions } from "@/app/actions/regions";
import type { RegionOption } from "@/lib/repo/regions.repo";

export function useRegions(initial: RegionOption[] = []) {
  const [regions, setRegions] = useState<RegionOption[]>(initial);
  // Seeded-ness is a mount-time fact: useState(initial) already ignores every
  // later value of `initial`, so reading it once into a ref lets the effect's
  // dependency array be genuinely complete rather than silenced.
  const seeded = useRef(initial.length > 0);

  useEffect(() => {
    // A server-seeded caller skips the fetch entirely — re-running the query
    // would only re-render an answer that is already on screen. Overview is
    // the only seeded caller today; the rest still fetch on mount.
    if (seeded.current) return;

    let cancelled = false;
    listRegions({}).then((res) => {
      if (!cancelled)
        setRegions((res?.data as RegionOption[] | undefined) ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return regions;
}
