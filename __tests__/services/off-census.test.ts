// helper.service transitively imports @/lib/db (which calls postgres() at module
// load). Replace it with an inert stub so these pure-function tests don't try to
// open a DB connection.
jest.mock("@/lib/db", () => ({ db: {}, Transaction: class {} }));

import { OFF_CENSUS_STATUSES, CAT_STATUS_VALUES } from "@/lib/db/enums";
import { getInterventionDisplayStatus, mapCatToSheetRow } from "@/lib/services/helper.service";

describe("OFF_CENSUS_STATUSES", () => {
  it("contains every cat_status value — a non-null status is always off-census", () => {
    expect([...OFF_CENSUS_STATUSES].sort()).toEqual([...CAT_STATUS_VALUES].sort());
  });

  it("includes Fostered", () => {
    expect(OFF_CENSUS_STATUSES).toContain("Fostered");
  });
});

const baseCat = {
  id: "c1", cat_status: null as string | null, is_adoptable: true,
  name: "Test", color: null, age: null, sex: null, sociability: null,
  spot_last_seen: null, date_last_seen: null, caretaker: null, notes: null,
  photo_url: null, region_id: null, merged_into_id: null,
  entry_status: "Original", last_updated_at: null,
  photo_zoom: 1, photo_offset_x: 0, photo_offset_y: 0, photo_rotation: 0,
} as never;

describe("Fostered is treated as off-census", () => {
  it("getInterventionDisplayStatus returns Not Applicable for a Fostered cat", () => {
    const cat = { ...(baseCat as object), cat_status: "Fostered" } as never;
    expect(getInterventionDisplayStatus(cat, [], "TNVR")).toBe("Not Applicable");
  });

  it("col V reads Not Applicable for a Fostered cat even when is_adoptable", () => {
    const cat = { ...(baseCat as object), cat_status: "Fostered", is_adoptable: true } as never;
    const row = mapCatToSheetRow(cat, null, [], "", null);
    expect(row[21]).toBe("Not Applicable");
  });

  it("col V still reads Healthy & Adoptable for an active adoptable cat", () => {
    const row = mapCatToSheetRow(baseCat, null, [], "", null);
    expect(row[21]).toBe("Healthy & Adoptable");
  });
});
