"use client";

import { useState, useEffect } from "react";
import { getRegions } from "@/app/actions/regions";
import type { RegionOption } from "@/lib/repo/regions.repo";

export function useRegions() {
  const [regions, setRegions] = useState<RegionOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    getRegions().then((res) => {
      if (!cancelled) setRegions(res?.data ?? []);
    });
    return () => { cancelled = true; };
  }, []);

  return regions;
}
