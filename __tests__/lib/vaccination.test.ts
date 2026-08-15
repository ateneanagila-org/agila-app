import {
  VACCINATION_EXPIRY_MONTHS,
  VACCINATION_LABELS,
  getVaccinationState,
} from "@/lib/vaccination";

const NOW = new Date(2026, 7, 15);

describe("getVaccinationState", () => {
  it("is unknown when there is no date", () => {
    expect(getVaccinationState(null, NOW)).toBe("unknown");
    expect(getVaccinationState(undefined, NOW)).toBe("unknown");
  });

  it("is unknown for an unparseable date", () => {
    expect(getVaccinationState("not-a-date", NOW)).toBe("unknown");
  });

  it("is vaccinated inside the window", () => {
    expect(getVaccinationState(new Date(2026, 5, 15), NOW)).toBe(
      "vaccinated",
    );
  });

  it("is expired outside the window", () => {
    expect(getVaccinationState(new Date(2025, 0, 10), NOW)).toBe(
      "expired",
    );
  });

  it("treats exactly 12 months as vaccinated — the boundary is closed", () => {
    expect(getVaccinationState(new Date(2025, 7, 15), NOW)).toBe(
      "vaccinated",
    );
  });

  it("treats one day past 12 months as expired", () => {
    expect(getVaccinationState(new Date(2025, 7, 14), NOW)).toBe(
      "expired",
    );
  });

  it("accepts an ISO string as well as a Date", () => {
    expect(getVaccinationState("2026-06-15T00:00:00", NOW)).toBe("vaccinated");
  });

  it("uses a 12-month window", () => {
    expect(VACCINATION_EXPIRY_MONTHS).toBe(12);
  });
});

describe("VACCINATION_LABELS", () => {
  it("uses the codebase's Unknown convention", () => {
    expect(VACCINATION_LABELS).toEqual({
      unknown: "Unknown",
      vaccinated: "Vaccinated",
      expired: "Expired",
    });
  });
});
