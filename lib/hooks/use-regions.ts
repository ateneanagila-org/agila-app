"use client";

import { useState, useEffect } from "react";
import { listRegions } from "@/app/actions/regions";
import type { RegionOption } from "@/lib/repo/regions.repo";

export function useRegions() {
  const [regions, setRegions] = useState<RegionOption[]>([]);

  useEffect(() => {
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
