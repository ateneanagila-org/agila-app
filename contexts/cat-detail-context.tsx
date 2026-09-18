"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getCatDetail } from "@/app/actions/cats";
import type { SelectCatHealthRecord } from "@/lib/validation/cats";
import type { CatWithRegion } from "@/lib/repo/cats.repo";
import type { SelectIntervention } from "@/lib/validation/interventions";

/** What the detail routes load for one cat. Seeded by the [id] layout. */
export type CatDetailSeed = {
  cat: CatWithRegion | null;
  healthRecord: SelectCatHealthRecord | null;
  interventions: SelectIntervention[];
};

type CatDetailContextValue = {
  catId: string | null;
  cat: CatWithRegion | null;
  healthRecord: SelectCatHealthRecord | null;
  interventions: SelectIntervention[];
  loading: boolean;
  error: string | null;
  /** Re-fetch all data for current catId. */
  refresh: () => Promise<void>;
};

const CatDetailContext = createContext<CatDetailContextValue | null>(null);

type CatDetailProviderProps = {
  catId: string;
  /**
   * Server-resolved detail. null means the seed could not be produced (bad id,
   * or a DB error that loadData swallowed), in which case the provider falls
   * back to fetching on mount.
   */
  initial: CatDetailSeed | null;
  children: ReactNode;
};

/**
 * Lives in the [id] layout, which is why the id is a route param rather than a
 * search param: layouts do not receive searchParams, so with `?id=` there was
 * nowhere above the tabs that could resolve the cat on the server. Sitting in
 * the layout is what keeps General/Medical/Interventions from re-fetching as
 * you switch between them — the layout is shared and is not re-executed.
 */
export function CatDetailProvider({
  catId,
  initial,
  children,
}: CatDetailProviderProps) {
  const [cat, setCat] = useState<CatWithRegion | null>(initial?.cat ?? null);
  const [healthRecord, setHealthRecord] = useState<SelectCatHealthRecord | null>(
    initial?.healthRecord ?? null,
  );
  const [interventions, setInterventions] = useState<SelectIntervention[]>(
    initial?.interventions ?? [],
  );
  const [loading, setLoading] = useState(initial === null);
  const [error, setError] = useState<string | null>(
    initial !== null && initial.cat === null ? "Cat not found." : null,
  );

  const fetchAll = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCatDetail({ id });
      if (res?.data?.cat) {
        setCat(res.data.cat);
      } else {
        setCat(null);
        setError("Cat not found.");
      }
      setHealthRecord(res?.data?.healthRecord ?? null);
      setInterventions(res?.data?.interventions ?? []);
    } catch (err) {
      console.error("Failed to load cat detail:", err);
      setError(err instanceof Error ? err.message : "Failed to load cat.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Seeded-ness is a mount-time fact, same idiom as useRegions. The provider is
  // keyed by catId in the layout, so a different cat is a different instance and
  // re-evaluates this rather than holding the previous cat's data.
  const seeded = useRef(initial !== null);

  useEffect(() => {
    if (seeded.current) return;
    fetchAll(catId);
  }, [catId, fetchAll]);

  const refresh = useCallback(async () => {
    await fetchAll(catId);
  }, [catId, fetchAll]);

  return (
    <CatDetailContext.Provider
      value={{
        catId,
        cat,
        healthRecord,
        interventions,
        loading,
        error,
        refresh,
      }}
    >
      {children}
    </CatDetailContext.Provider>
  );
}

export function useCatDetail() {
  const ctx = useContext(CatDetailContext);
  if (!ctx) {
    throw new Error("useCatDetail must be used inside CatDetailProvider");
  }
  return ctx;
}
