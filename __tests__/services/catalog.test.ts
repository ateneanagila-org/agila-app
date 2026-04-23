import {
  statusSuffix,
  parseCatalogId,
  nextCatalogId,
} from "@/lib/services/catalog.service";

describe("statusSuffix", () => {
  it("returns m for MIA", () => expect(statusSuffix("MIA")).toBe("m"));
  it("returns d for Deceased", () => expect(statusSuffix("Deceased")).toBe("d"));
  it("returns a for Adopted", () => expect(statusSuffix("Adopted")).toBe("a"));
  it("returns f for Fostered", () => expect(statusSuffix("Fostered")).toBe("f"));
  it("returns empty string for active status", () => expect(statusSuffix("None of the above")).toBe(""));
  it("returns empty string for null", () => expect(statusSuffix(null)).toBe(""));
});

describe("parseCatalogId", () => {
  it("parses plain number", () => expect(parseCatalogId("14")).toBe(14));
  it("strips MIA suffix", () => expect(parseCatalogId("5m")).toBe(5));
  it("strips Deceased suffix", () => expect(parseCatalogId("7d")).toBe(7));
  it("strips Adopted suffix", () => expect(parseCatalogId("4a")).toBe(4));
  it("strips Fostered suffix", () => expect(parseCatalogId("11f")).toBe(11));
  it("returns null for unparseable value", () => expect(parseCatalogId("abc")).toBeNull());
  it("returns null for empty string", () => expect(parseCatalogId("")).toBeNull());
});

describe("nextCatalogId", () => {
  it("returns 1 for empty list", () => expect(nextCatalogId([])).toBe(1));
  it("returns max + 1", () => expect(nextCatalogId(["1", "5", "3"])).toBe(6));
  it("skips gaps — uses max not count", () => expect(nextCatalogId(["1", "10", "2"])).toBe(11));
  it("handles suffixed values", () => expect(nextCatalogId(["1", "5m", "3d"])).toBe(6));
  it("ignores unparseable entries", () => expect(nextCatalogId(["1", "abc", "3"])).toBe(4));
});
