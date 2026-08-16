import {
  neuteredState, conditionFlags, triStateLabel, triStateToValue, triStateTone,
} from "@/lib/health-display";

describe("neuteredState", () => {
  it.each([[true, "yes"], [false, "no"], [null, "unknown"], [undefined, "unknown"]])(
    "%s -> %s", (input, expected) => {
      expect(neuteredState(input as boolean | null | undefined)).toBe(expected);
    });
});

describe("conditionFlags", () => {
  it("Healthy sets neither", () => {
    expect(conditionFlags("Healthy")).toEqual({ sick: "no", injured: "no" });
  });
  it("Sick sets sick only", () => {
    expect(conditionFlags("Sick")).toEqual({ sick: "yes", injured: "no" });
  });
  it("Injured sets injured only", () => {
    expect(conditionFlags("Injured")).toEqual({ sick: "no", injured: "yes" });
  });
  it("Sick and Injured sets both", () => {
    expect(conditionFlags("Sick and Injured")).toEqual({ sick: "yes", injured: "yes" });
  });
  it("null is unknown for both — absence is not a clean bill of health", () => {
    expect(conditionFlags(null)).toEqual({ sick: "unknown", injured: "unknown" });
  });
  it("matches enum values exactly, not by substring", () => {
    // "Not Sick" contains "Sick"; substring matching would wrongly set the flag.
    expect(conditionFlags("Not Sick")).toEqual({ sick: "unknown", injured: "unknown" });
  });
});

describe("triStateLabel / triStateToValue round-trip", () => {
  it.each(["yes", "no", "unknown"] as const)("%s round-trips", (state) => {
    expect(neuteredState(triStateToValue(triStateLabel(state)))).toBe(state);
  });
});

describe("triStateTone", () => {
  it("yes is affirmative, no is muted, unknown is unknown", () => {
    expect(triStateTone("yes")).toBe("affirmative");
    expect(triStateTone("no")).toBe("muted");
    expect(triStateTone("unknown")).toBe("unknown");
  });
});
