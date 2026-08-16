import type { SelectCat, SelectCatHealthRecord } from "@/lib/validation/cats";
import { OFF_CENSUS_STATUSES } from "@/lib/db/enums";

/** All cat_status values are off-census statuses (active cats have null status). */
export { OFF_CENSUS_STATUSES };

const OFF_CENSUS_SET = new Set<string>(OFF_CENSUS_STATUSES);

/** Active census = Original entry AND not an off-census status. */
export function isActiveCensus(cat: SelectCat): boolean {
  if (cat.entry_status !== "Original") return false;
  return !(cat.cat_status && OFF_CENSUS_SET.has(cat.cat_status));
}

function hrMap(records: SelectCatHealthRecord[]) {
  const m = new Map<string, SelectCatHealthRecord>();
  for (const hr of records) m.set(hr.cat_id, hr);
  return m;
}

export type CensusStats = {
  total: number;
  neutered: number;
  unneutered: number;
  tnvrPct: number;
  domesticated: number;
  tame: number;
  feral: number;
  sick: number;
  injured: number;
  adoptable: number;
  unnamed: number;
  fostered: number;
  adopted: number;
  mia: number;
  deceased: number;
  offCensusTotal: number;
  overallTotal: number;
};

export function computeCensusStats(
  cats: SelectCat[],
  healthRecords: SelectCatHealthRecord[],
): CensusStats {
  const hr = hrMap(healthRecords);
  const original = cats.filter((c) => c.entry_status === "Original");
  const active = original.filter(isActiveCensus);

  let neutered = 0;
  let domesticated = 0;
  let tame = 0;
  let feral = 0;
  let sick = 0;
  let injured = 0;
  let adoptable = 0;
  let unnamed = 0;

  for (const cat of active) {
    const rec = hr.get(cat.id);
    if (rec?.is_neutered === true) neutered++;
    if (cat.sociability === "Domesticated") domesticated++;
    else if (cat.sociability === "Tame") tame++;
    else if (cat.sociability === "Feral") feral++;
    if (rec?.condition === "Sick" || rec?.condition === "Sick and Injured") sick++;
    if (rec?.condition === "Injured" || rec?.condition === "Sick and Injured") injured++;
    if (cat.is_adoptable) adoptable++;
    if (!cat.name || cat.name.trim() === "") unnamed++;
  }

  let fostered = 0;
  let adopted = 0;
  let mia = 0;
  let deceased = 0;
  for (const cat of original) {
    if (cat.cat_status === "Fostered") fostered++;
    else if (cat.cat_status === "Adopted") adopted++;
    else if (cat.cat_status === "MIA") mia++;
    else if (cat.cat_status === "Deceased") deceased++;
  }

  const total = active.length;
  const unneutered = total - neutered;
  const tnvrPct = total > 0 ? Math.round((neutered / total) * 100) : 0;
  const offCensusTotal = fostered + adopted + mia + deceased;
  const overallTotal = total + offCensusTotal;

  return {
    total,
    neutered,
    unneutered,
    tnvrPct,
    domesticated,
    tame,
    feral,
    sick,
    injured,
    adoptable,
    unnamed,
    fostered,
    adopted,
    mia,
    deceased,
    offCensusTotal,
    overallTotal,
  };
}

export type TnvrStats = {
  neuteredMale: number;
  spayedFemale: number;
  neuteredUnknown: number;
  unneuteredMale: number;
  unneuteredFemale: number;
  unneuteredUnknown: number;
  totalNeutered: number;
  totalUnneutered: number;
  total: number;
  totalMale: number;
  totalFemale: number;
  totalUnknown: number;
  overallTnvr: string;
  maleTnvr: string;
  femaleTnvr: string;
  unknownTnvr: string;
};

export function computeTnvrStats(
  cats: SelectCat[],
  healthRecords: SelectCatHealthRecord[],
): TnvrStats {
  const hr = hrMap(healthRecords);
  const active = cats.filter(isActiveCensus);

  let neuteredMale = 0;
  let spayedFemale = 0;
  let neuteredUnknown = 0;
  let unneuteredMale = 0;
  let unneuteredFemale = 0;
  let unneuteredUnknown = 0;
  let totalMale = 0;
  let totalFemale = 0;
  let totalUnknown = 0;

  for (const cat of active) {
    const rec = hr.get(cat.id);
    const isNeutered = rec?.is_neutered === true;
    if (cat.sex === "Male") {
      totalMale++;
      if (isNeutered) neuteredMale++;
      else unneuteredMale++;
    } else if (cat.sex === "Female") {
      totalFemale++;
      if (isNeutered) spayedFemale++;
      else unneuteredFemale++;
    } else {
      totalUnknown++;
      if (isNeutered) neuteredUnknown++;
      else unneuteredUnknown++;
    }
  }

  const totalNeutered = neuteredMale + spayedFemale + neuteredUnknown;
  const totalUnneutered = unneuteredMale + unneuteredFemale + unneuteredUnknown;
  const total = active.length;
  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "0%");

  return {
    neuteredMale,
    spayedFemale,
    neuteredUnknown,
    unneuteredMale,
    unneuteredFemale,
    unneuteredUnknown,
    totalNeutered,
    totalUnneutered,
    total,
    totalMale,
    totalFemale,
    totalUnknown,
    overallTnvr: pct(totalNeutered, total),
    maleTnvr: pct(neuteredMale, totalMale),
    femaleTnvr: pct(spayedFemale, totalFemale),
    unknownTnvr: pct(neuteredUnknown, totalUnknown),
  };
}
