import {
  VACCINATION_EXPIRY_MONTHS,
  VACCINATION_LABELS,
  VACCINATION_FILTER_OPTIONS,
  getVaccinationState,
  vaccinationTone,
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
      vaccinated: "Yes",
      expired: "Expired",
    });
  });
});

describe("vaccination labels read as answers to the row", () => {
  it("vaccinated reads Yes, matching Neutered's Yes", () => {
    expect(VACCINATION_LABELS).toEqual({
      unknown: "Unknown", vaccinated: "Yes", expired: "Expired",
    });
  });

  it("filter options follow the labels", () => {
    expect([...VACCINATION_FILTER_OPTIONS]).toEqual(["Yes", "Expired", "Unknown"]);
  });
});

describe("vaccinationTone", () => {
  it("expired is muted, never an alarm — the data cannot support a clinical claim", () => {
    expect(vaccinationTone("expired")).toBe("muted");
  });
  it("vaccinated is affirmative and unknown is unknown", () => {
    expect(vaccinationTone("vaccinated")).toBe("affirmative");
    expect(vaccinationTone("unknown")).toBe("unknown");
  });
});
