import {
  planRepairs,
  looksWiped,
  takeWithinBudget,
} from "@/lib/services/reconcile.service";

describe("planRepairs", () => {
  it("queues a cat absent from every tab", () => {
    const plan = planRepairs(
      new Map([["r1", ["catA"]]]),
      new Map([["r1", new Set<string>()]]),
      new Set(),
    );
    expect(plan.missing).toEqual([{ catId: "catA", regionId: "r1" }]);
    expect(plan.wrongTab).toEqual([]);
  });

  it("leaves a cat that is already present alone", () => {
    const plan = planRepairs(
      new Map([["r1", ["catA"]]]),
      new Map([["r1", new Set(["catA"])]]),
      new Set(),
    );
    expect(plan.missing).toEqual([]);
    expect(plan.wrongTab).toEqual([]);
  });

  it("classifies a cat sitting on another region's tab as wrongTab, not missing", () => {
    const plan = planRepairs(
      new Map([["r1", ["catA"]], ["r2", []]]),
      new Map([["r1", new Set<string>()], ["r2", new Set(["catA"])]]),
      new Set(),
    );
    expect(plan.missing).toEqual([]);
    expect(plan.wrongTab).toEqual([
      { catId: "catA", fromRegionId: "r2", toRegionId: "r1" },
    ]);
  });

  it("skips any cat with a PENDING task — Phase 3 will append it anyway", () => {
    const plan = planRepairs(
      new Map([["r1", ["catA"]]]),
      new Map([["r1", new Set<string>()]]),
      new Set(["catA"]),
    );
    expect(plan.missing).toEqual([]);
  });
});

describe("looksWiped", () => {
  it("trips when a region expects cats but its snapshot is empty", () => {
    expect(looksWiped(40, 0)).toBe(true);
  });

  it("does not trip for a genuinely empty region", () => {
    expect(looksWiped(0, 0)).toBe(false);
  });

  it("does not trip whenever the tab holds anything at all", () => {
    expect(looksWiped(40, 1)).toBe(false);
    expect(looksWiped(3, 3)).toBe(false);
  });
});

describe("takeWithinBudget", () => {
  it("returns everything when it fits", () => {
    const { taken, deferred } = takeWithinBudget([1, 2, 3], 25);
    expect(taken).toEqual([1, 2, 3]);
    expect(deferred).toBe(0);
  });

  it("truncates to the budget and reports what was left", () => {
    const { taken, deferred } = takeWithinBudget([1, 2, 3, 4, 5], 2);
    expect(taken).toEqual([1, 2]);
    expect(deferred).toBe(3);
  });

  it("takes nothing once the budget is spent", () => {
    const { taken, deferred } = takeWithinBudget([1, 2], 0);
    expect(taken).toEqual([]);
    expect(deferred).toBe(2);
  });
});
