"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  getCats,
  getCatHealthRecords,
} from "@/app/actions/cats";
import { getInterventions } from "@/app/actions/interventions";
import type {
  SelectCatHealthRecord,
} from "@/lib/validation/cats";
import type { CatWithRegion } from "@/lib/repo/cats.repo";
import type { SelectIntervention } from "@/lib/validation/interventions";

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

export function CatDetailProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const catId = searchParams.get("id");

  const [cat, setCat] = useState<CatWithRegion | null>(null);
  const [healthRecord, setHealthRecord] =
    useState<SelectCatHealthRecord | null>(null);
  const [interventions, setInterventions] = useState<SelectIntervention[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, hrRes, intRes] = await Promise.all([
        getCats({ id }),
        getCatHealthRecords({ cat_id: id }),
        getInterventions({ cat_id: id }),
      ]);
      if (catRes?.data && catRes.data.length > 0) {
        setCat(catRes.data[0]);
      } else {
        setCat(null);
        setError("Cat not found.");
      }
      setHealthRecord(
        hrRes?.data && hrRes.data.length > 0 ? hrRes.data[0] : null,
      );
      setInterventions(intRes?.data ?? []);
    } catch (err) {
      console.error("Failed to load cat detail:", err);
      setError(err instanceof Error ? err.message : "Failed to load cat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!catId) {
      setCat(null);
      setHealthRecord(null);
      setInterventions([]);
      setError(null);
      return;
    }
    fetchAll(catId);
  }, [catId, fetchAll]);

  const refresh = useCallback(async () => {
    if (!catId) return;
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
