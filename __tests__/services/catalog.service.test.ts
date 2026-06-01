import {
  statusSuffix,
  parseCatalogId,
  catalogDisplay,
  nextCatalogId,
} from "@/lib/services/catalog.service";

describe("statusSuffix", () => {
  it("maps each known status to its suffix letter", () => {
    expect(statusSuffix("MIA")).toBe("m");
    expect(statusSuffix("Deceased")).toBe("d");
    expect(statusSuffix("Adopted")).toBe("a");
    expect(statusSuffix("Fostered")).toBe("f");
  });

  it("returns empty string for null/undefined/unknown", () => {
    expect(statusSuffix(null)).toBe("");
    expect(statusSuffix(undefined)).toBe("");
    expect(statusSuffix("None of the above")).toBe("");
    expect(statusSuffix("")).toBe("");
  });
});

describe("parseCatalogId", () => {
  it("extracts the leading number from a display string", () => {
    expect(parseCatalogId("5")).toBe(5);
    expect(parseCatalogId("12")).toBe(12);
  });

  it("strips the status suffix", () => {
    expect(parseCatalogId("5m")).toBe(5);
    expect(parseCatalogId("12a")).toBe(12);
  });

  it("grabs the first digit run when other characters surround it", () => {
    // Documents current behavior: regex \d+ takes the first contiguous digits.
    expect(parseCatalogId("R-7")).toBe(7);
    expect(parseCatalogId("1.5")).toBe(1);
  });

  it("returns null when there is no number", () => {
    expect(parseCatalogId("")).toBeNull();
    expect(parseCatalogId("abc")).toBeNull();
    expect(parseCatalogId("N/A")).toBeNull();
  });
});

describe("nextCatalogId", () => {
  it("returns 1 for an empty list", () => {
    expect(nextCatalogId([])).toBe(1);
  });

  it("returns 1 when no entry contains a number", () => {
    expect(nextCatalogId(["", "abc", "N/A"])).toBe(1);
  });

  it("returns max + 1, ignoring gaps and order", () => {
    expect(nextCatalogId(["3", "7", "5"])).toBe(8);
  });

  it("ignores suffixes and unparseable entries when finding the max", () => {
    expect(nextCatalogId(["3m", "", "10a", "junk"])).toBe(11);
  });

  it("does not break on duplicate numbers", () => {
    expect(nextCatalogId(["4", "4", "4"])).toBe(5);
  });
});

describe("catalogDisplay", () => {
  it("combines the looked-up number with the status suffix", () => {
    const lookup = new Map([["cat-1", "5"]]);
    expect(catalogDisplay(lookup, "cat-1", "MIA")).toBe("5m");
    expect(catalogDisplay(lookup, "cat-1", null)).toBe("5");
  });

  it("parses a number out of an already-suffixed lookup value", () => {
    const lookup = new Map([["cat-1", "5m"]]);
    expect(catalogDisplay(lookup, "cat-1", "Adopted")).toBe("5a");
  });

  it("returns empty string when the cat is not in the lookup", () => {
    const lookup = new Map<string, string>();
    expect(catalogDisplay(lookup, "missing", "MIA")).toBe("");
  });

  it("returns empty string when the lookup value has no number", () => {
    const lookup = new Map([["cat-1", "N/A"]]);
    expect(catalogDisplay(lookup, "cat-1", "MIA")).toBe("");
  });
});
