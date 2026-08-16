// helper.service transitively imports @/lib/db (which calls postgres() at module
// load). Replace it with an inert stub so these pure-function tests don't try to
// open a DB connection.
jest.mock("@/lib/db", () => ({ db: {}, Transaction: class {} }));

import {
  mapCatToSheetRow,
  mapUnknownCatToSheetRow,
  buildCatalogLookup,
  type SheetRow,
} from "@/lib/services/helper.service";
import { parseSheetRow } from "@/lib/validation/reverse-sync";
import type { SelectCat, SelectCatHealthRecord } from "@/lib/validation/cats";
import type { SelectIntervention } from "@/lib/validation/interventions";

function makeCat(overrides: Partial<SelectCat> = {}): SelectCat {
  return {
    cat_status: null,
    photo_url: null,
    name: null,
    color: null,
    age: null,
    sex: null,
    sociability: null,
    is_adoptable: false,
    caretaker: null,
    spot_last_seen: null,
    notes: null,
    paws_id: null,
    ...overrides,
  } as unknown as SelectCat;
}

function makeHealth(overrides: Partial<SelectCatHealthRecord> = {}): SelectCatHealthRecord {
  return {
    condition: null,
    is_neutered: null,
    neuter_date: null,
    vaccination_date: null,
    ...overrides,
  } as unknown as SelectCatHealthRecord;
}

function makeIntervention(overrides: Partial<SelectIntervention> = {}): SelectIntervention {
  return {
    type: "TNVR",
    status: "Pending",
    ...overrides,
  } as unknown as SelectIntervention;
}

describe("mapCatToSheetRow", () => {
  it("returns exactly 22 columns (A–V)", () => {
    expect(mapCatToSheetRow(makeCat(), null)).toHaveLength(22);
  });

  it("places the catalog display in col A and the UUID nowhere in the array", () => {
    const row = mapCatToSheetRow(makeCat(), null, [], "5m");
    expect(row[0]).toBe("5m");
  });

  it("wraps photo_url in an =IMAGE() formula and strips embedded quotes", () => {
    const row = mapCatToSheetRow(makeCat({ photo_url: 'http://x/a"b.jpg' }), null);
    expect(row[1]).toBe('=IMAGE("http://x/ab.jpg")');
  });

  it("leaves col B empty when there is no photo", () => {
    expect(mapCatToSheetRow(makeCat(), null)[1]).toBe("");
  });

  it("falls back to N/A / ??? sentinels for missing fields", () => {
    const row = mapCatToSheetRow(makeCat(), null);
    expect(row[2]).toBe("N/A"); // name
    expect(row[5]).toBe("???"); // sex
    expect(row[7]).toBe("???"); // sociability
    expect(row[11]).toBe("None of the above"); // status
  });

  describe("neutered (col G[6])", () => {
    it("true → YES, false → NO, null → ???", () => {
      expect(mapCatToSheetRow(makeCat(), makeHealth({ is_neutered: true }))[6]).toBe("YES");
      expect(mapCatToSheetRow(makeCat(), makeHealth({ is_neutered: false }))[6]).toBe("NO");
      expect(mapCatToSheetRow(makeCat(), makeHealth({ is_neutered: null }))[6]).toBe("???");
    });
  });

  describe("adoptable (col K[10]) — matches col G's three-way convention", () => {
    it("true writes YES", () => {
      expect(mapCatToSheetRow(makeCat({ is_adoptable: true }), null)[10]).toBe("YES");
    });
    it("false writes NO", () => {
      expect(mapCatToSheetRow(makeCat({ is_adoptable: false }), null)[10]).toBe("NO");
    });
    it("null writes ??? — without this the null cannot survive a round trip", () => {
      expect(mapCatToSheetRow(makeCat({ is_adoptable: null }), null)[10]).toBe("???");
    });

    it("null -> ??? -> null round-trips through the sheet without collapsing", () => {
      const written = mapCatToSheetRow(makeCat({ is_adoptable: null }), null)[10];
      const row = new Array<string>(25).fill("");
      row[10] = written;
      row[24] = "11111111-1111-4111-8111-111111111111";
      expect(parseSheetRow(row)?.is_adoptable).toBeNull();
    });
  });

  describe("sick/injured flags (cols I[8]/J[9])", () => {
    it("derives YES/NO from condition, ??? when condition is blank", () => {
      const sickInjured = mapCatToSheetRow(makeCat(), makeHealth({ condition: "Sick and Injured" }));
      expect(sickInjured[8]).toBe("YES");
      expect(sickInjured[9]).toBe("YES");

      const healthy = mapCatToSheetRow(makeCat(), makeHealth({ condition: "Healthy" }));
      expect(healthy[8]).toBe("NO");
      expect(healthy[9]).toBe("NO");

      const unknown = mapCatToSheetRow(makeCat(), makeHealth({ condition: null }));
      expect(unknown[8]).toBe("???");
      expect(unknown[9]).toBe("???");
    });
  });

  describe("forFaStatus (col V[21])", () => {
    it("is Not Applicable for Adopted/Deceased/MIA", () => {
      expect(mapCatToSheetRow(makeCat({ cat_status: "Adopted", is_adoptable: true }), makeHealth())[21]).toBe("Not Applicable");
    });

    it("is Not Ready for FA when not adoptable", () => {
      expect(mapCatToSheetRow(makeCat({ is_adoptable: false }), makeHealth({ condition: "Healthy" }))[21]).toBe("Not Ready for FA");
    });

    it("reflects condition when adoptable", () => {
      expect(mapCatToSheetRow(makeCat({ is_adoptable: true }), makeHealth({ condition: "Healthy" }))[21]).toBe("Healthy & Adoptable");
      expect(mapCatToSheetRow(makeCat({ is_adoptable: true }), makeHealth({ condition: "Sick" }))[21]).toBe("Sick & Adoptable");
      expect(mapCatToSheetRow(makeCat({ is_adoptable: true }), makeHealth({ condition: "Injured" }))[21]).toBe("Injured & Adoptable");
    });
  });

  describe("intervention display (cols T[19]/U[20])", () => {
    it("shows 'Will have' for a pending intervention of that type", () => {
      const row = mapCatToSheetRow(makeCat(), null, [makeIntervention({ type: "TNVR", status: "Pending" })]);
      expect(row[19]).toBe("Will have TNVR intervention");
      expect(row[20]).toBe("Will not have intervention");
    });

    it("shows 'Had' for a finished intervention", () => {
      const row = mapCatToSheetRow(makeCat(), null, [makeIntervention({ type: "Veterinarian", status: "Finished" })]);
      expect(row[20]).toBe("Had Vet intervention");
    });

    it("is Not Applicable for terminal cat statuses", () => {
      const row = mapCatToSheetRow(makeCat({ cat_status: "Deceased" }), null, [makeIntervention()]);
      expect(row[19]).toBe("Not Applicable");
      expect(row[20]).toBe("Not Applicable");
    });
  });

  it("col N (date last seen, index 13) uses the provided last-seen date, N/A when null", () => {
    expect(
      mapCatToSheetRow(makeCat(), null, [], "", new Date(2025, 7, 18))[13],
    ).toBe("8/18/2025");
    expect(mapCatToSheetRow(makeCat(), null)[13]).toBe("N/A");
  });

  it("formats dates in en-US (cols P[15]/Q[16]) and 'N/A' when absent", () => {
    const health = makeHealth({
      neuter_date: new Date(2024, 0, 15),
      vaccination_date: new Date(2024, 2, 4),
    });
    const row = mapCatToSheetRow(makeCat(), health);
    expect(row[15]).toBe("1/15/2024");
    expect(row[16]).toBe("3/4/2024");
    expect(mapCatToSheetRow(makeCat(), makeHealth())[15]).toBe("N/A");
  });
});

describe("mapUnknownCatToSheetRow", () => {
  it("returns 22 columns with N–V (13–21) empty", () => {
    const row = mapUnknownCatToSheetRow(makeCat(), null, "3");
    expect(row).toHaveLength(22);
    for (let i = 13; i <= 21; i++) expect(row[i]).toBe("");
  });

  it("uses the UNKNOWN layout: loc in B, paws in C, dates in L/M", () => {
    const cat = makeCat({ spot_last_seen: "near gate", paws_id: "PAWS-9" });
    const health = makeHealth({
      neuter_date: new Date(2024, 0, 15),
      vaccination_date: new Date(2024, 2, 4),
    });
    const row = mapUnknownCatToSheetRow(cat, health, "3");
    expect(row[0]).toBe("3");
    expect(row[1]).toBe("near gate");
    expect(row[2]).toBe("PAWS-9");
    expect(row[11]).toBe("1/15/2024");
    expect(row[12]).toBe("3/4/2024");
  });

  describe("adoptable (col K[10]) — same convention as the standard mapper", () => {
    it("true writes YES, false writes NO, null writes ???", () => {
      expect(mapUnknownCatToSheetRow(makeCat({ is_adoptable: true }), null)[10]).toBe("YES");
      expect(mapUnknownCatToSheetRow(makeCat({ is_adoptable: false }), null)[10]).toBe("NO");
      expect(mapUnknownCatToSheetRow(makeCat({ is_adoptable: null }), null)[10]).toBe("???");
    });
  });
});

describe("buildCatalogLookup", () => {
  function mkSheetRow(colA: string, entityId: string): SheetRow {
    const raw = new Array<string>(25).fill("");
    raw[0] = colA;
    raw[24] = entityId;
    return { raw, entityId, lastEditedAt: null, editedBy: null, rowIndex: 3 };
  }

  it("maps entityId → col A across all regions", () => {
    const snapshot = new Map<string, SheetRow[]>([
      ["r1", [mkSheetRow("5m", "cat-1")]],
      ["r2", [mkSheetRow("9", "cat-2")]],
    ]);
    const lookup = buildCatalogLookup(snapshot);
    expect(lookup.get("cat-1")).toBe("5m");
    expect(lookup.get("cat-2")).toBe("9");
  });

  it("skips rows with a blank col A or blank entityId", () => {
    const snapshot = new Map<string, SheetRow[]>([
      ["r1", [mkSheetRow("", "cat-1"), mkSheetRow("7", "")]],
    ]);
    const lookup = buildCatalogLookup(snapshot);
    expect(lookup.size).toBe(0);
  });
});
