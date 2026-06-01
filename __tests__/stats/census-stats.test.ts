import {
  OFF_CENSUS_STATUSES,
  isActiveCensus,
  computeCensusStats,
  computeTnvrStats,
} from "@/lib/stats/census-stats";
import type { SelectCat, SelectCatHealthRecord } from "@/lib/validation/cats";

function cat(p: Partial<SelectCat>): SelectCat {
  return {
    id: p.id ?? "c1",
    name: p.name ?? "Tom",
    sex: p.sex ?? "Male",
    color: p.color ?? null,
    age: p.age ?? null,
    sociability: p.sociability ?? null,
    spot_last_seen: p.spot_last_seen ?? null,
    last_updated_at: p.last_updated_at ?? null,
    photo_url: p.photo_url ?? null,
    cat_status: p.cat_status ?? null,
    is_adoptable: p.is_adoptable ?? false,
    entry_status: p.entry_status ?? "Original",
  } as SelectCat;
}

function hr(p: Partial<SelectCatHealthRecord>): SelectCatHealthRecord {
  return {
    cat_id: p.cat_id ?? "c1",
    is_neutered: p.is_neutered ?? null,
    neuter_date: p.neuter_date ?? null,
    condition: p.condition ?? null,
  } as SelectCatHealthRecord;
}

describe("isActiveCensus", () => {
  it("treats null-status Original cats as active", () => {
    expect(isActiveCensus(cat({ cat_status: null }))).toBe(true);
  });
  it("excludes off-census statuses", () => {
    for (const s of OFF_CENSUS_STATUSES) {
      expect(isActiveCensus(cat({ cat_status: s }))).toBe(false);
    }
  });
  it("excludes non-Original entries", () => {
    expect(isActiveCensus(cat({ entry_status: "Duplicate" as never }))).toBe(false);
  });
});

describe("computeCensusStats", () => {
  it("total counts only active census; overall = active + off-census, no double count", () => {
    const cats = [
      cat({ id: "a", cat_status: null }),
      cat({ id: "b", cat_status: null }),
      cat({ id: "c", cat_status: "Adopted" }),
      cat({ id: "d", cat_status: "Deceased" }),
    ];
    const s = computeCensusStats(cats, []);
    expect(s.total).toBe(2);
    expect(s.offCensusTotal).toBe(2);
    expect(s.overallTotal).toBe(4);
  });

  it("counts neutered by is_neutered flag, ignoring neuter_date", () => {
    const cats = [cat({ id: "a", cat_status: null }), cat({ id: "b", cat_status: null })];
    const records = [
      hr({ cat_id: "a", is_neutered: true, neuter_date: null }),
      hr({ cat_id: "b", is_neutered: false, neuter_date: new Date() }),
    ];
    const s = computeCensusStats(cats, records);
    expect(s.neutered).toBe(1);
    expect(s.unneutered).toBe(1);
  });
});

describe("computeTnvrStats", () => {
  it("uses active census denominator and is_neutered flag", () => {
    const cats = [
      cat({ id: "a", sex: "Male", cat_status: null }),
      cat({ id: "b", sex: "Female", cat_status: null }),
      cat({ id: "c", sex: "Male", cat_status: "Adopted" }),
    ];
    const records = [hr({ cat_id: "a", is_neutered: true })];
    const s = computeTnvrStats(cats, records);
    expect(s.total).toBe(2);
    expect(s.neuteredMale).toBe(1);
    expect(s.totalMale).toBe(1);
    expect(s.overallTnvr).toBe("50%");
  });
});
