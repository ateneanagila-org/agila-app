// ── Mock the seams BEFORE importing the module under test ───────────────────
// reconcileSheetRepresentation orchestrates across getSyncHalt, cats.repo,
// sync-queue.repo, and helper.service's refreshCatInSyncQueue — all mocked at
// the module boundary so these stay fast and assert on call counts, not on
// real DB/Sheets behavior. db.transaction is mocked to just invoke its
// callback with a dummy tx, since the repo calls it forwards to are mocked
// too. The pure functions (planRepairs, looksWiped, takeWithinBudget) need
// none of this — they take plain values and touch nothing.
jest.mock("@/lib/db", () => {
  const tx = {};
  return {
    db: { transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)) },
    Transaction: class {},
  };
});
jest.mock("@/lib/services/helper.service", () => ({
  refreshCatInSyncQueue: jest.fn(),
}));
jest.mock("@/lib/services/system.service", () => ({
  getSyncHalt: jest.fn(),
}));
jest.mock("@/lib/services/discord.service", () => ({
  sendSyncAlert: jest.fn(),
}));
jest.mock("@/lib/repo/cats.repo", () => ({
  findOriginalCatIdsByEffectiveRegion: jest.fn(),
}));
jest.mock("@/lib/repo/sync-queue.repo", () => ({
  findPendingSyncCatIds: jest.fn(),
  supersedePendingTasks: jest.fn(),
  insertDeleteTask: jest.fn(),
}));

import {
  planRepairs,
  looksWiped,
  takeWithinBudget,
  reconcileSheetRepresentation,
} from "@/lib/services/reconcile.service";
import { refreshCatInSyncQueue } from "@/lib/services/helper.service";
import { getSyncHalt } from "@/lib/services/system.service";
import { sendSyncAlert } from "@/lib/services/discord.service";
import * as catsRepo from "@/lib/repo/cats.repo";
import * as queueRepo from "@/lib/repo/sync-queue.repo";

const mockRefresh = refreshCatInSyncQueue as jest.Mock;
const mockHalt = getSyncHalt as jest.Mock;
const mockAlert = sendSyncAlert as jest.Mock;
const mockFindExpected =
  catsRepo.findOriginalCatIdsByEffectiveRegion as jest.Mock;
const mockFindPending = queueRepo.findPendingSyncCatIds as jest.Mock;
const mockSupersede = queueRepo.supersedePendingTasks as jest.Mock;
const mockInsertDelete = queueRepo.insertDeleteTask as jest.Mock;

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

  // Finding 2: a plain last-writer-wins Map collapses a cat present on TWO
  // tabs to whichever region iteration visited last — order-dependent, and
  // silent on the exact double-listing this feature exists to catch.
  it("flags a cat present on its own tab AND another tab as a cleanup, regardless of iteration order", () => {
    const expected = new Map([["r1", ["catA"]]]);
    const presentInsertedAsR1ThenR2 = new Map([
      ["r1", new Set(["catA"])],
      ["r2", new Set(["catA"])],
    ]);
    const presentInsertedAsR2ThenR1 = new Map([
      ["r2", new Set(["catA"])],
      ["r1", new Set(["catA"])],
    ]);

    const planA = planRepairs(expected, presentInsertedAsR1ThenR2, new Set());
    const planB = planRepairs(expected, presentInsertedAsR2ThenR1, new Set());

    // Correctly present at r1, but ALSO stuck on r2 — r2 must be cleaned up.
    expect(planA.missing).toEqual([]);
    expect(planA.wrongTab).toEqual([
      { catId: "catA", fromRegionId: "r2", toRegionId: "r1" },
    ]);
    // Same input, different Map insertion order — must not change the plan.
    expect(planB).toEqual(planA);
  });

  it("queues a cleanup for every non-expected tab a cat is found on, even with no correct copy anywhere", () => {
    const plan = planRepairs(
      new Map([["r1", ["catA"]]]),
      new Map([["r2", new Set(["catA"])], ["r3", new Set(["catA"])]]),
      new Set(),
    );
    expect(plan.missing).toEqual([]);
    expect(plan.wrongTab).toHaveLength(2);
    expect(plan.wrongTab).toEqual(
      expect.arrayContaining([
        { catId: "catA", fromRegionId: "r2", toRegionId: "r1" },
        { catId: "catA", fromRegionId: "r3", toRegionId: "r1" },
      ]),
    );
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

describe("reconcileSheetRepresentation — orchestration safety properties", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHalt.mockResolvedValue(null);
    mockFindPending.mockResolvedValue([]);
    mockFindExpected.mockResolvedValue([]);
    mockAlert.mockResolvedValue(undefined);
  });

  it("skips the whole tick when any region read failed — before any repo read or repair", async () => {
    const outcome = await reconcileSheetRepresentation(
      [{ id: "r1", name: "R1" }],
      new Map(),
      new Set(["r1"]),
    );

    expect(outcome).toEqual({
      restored: 0,
      moved: 0,
      deferred: 0,
      skippedRegions: [],
      skippedTick: true,
    });
    expect(mockFindExpected).not.toHaveBeenCalled();
    expect(mockFindPending).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it.each(["frozen", "retired"] as const)(
    "writes nothing when sync is %s",
    async (halt) => {
      mockHalt.mockResolvedValue(halt);

      const outcome = await reconcileSheetRepresentation(
        [{ id: "r1", name: "R1" }],
        new Map(),
        new Set(),
      );

      expect(outcome.skippedTick).toBe(true);
      expect(mockFindExpected).not.toHaveBeenCalled();
      expect(mockFindPending).not.toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
      expect(mockAlert).not.toHaveBeenCalled();
    },
  );

  it("counts only cats refreshCatInSyncQueue actually queued, not every attempt", async () => {
    // catP is already correctly present, keeping r1's snapshot non-empty so
    // looksWiped doesn't fire and mask the two missing repairs below. catA
    // and catB are both missing (absent from every tab); one refresh
    // succeeds (queues an UPDATE and returns the region), the other returns
    // undefined (cat no longer Original / unresolvable) — Finding 3:
    // `restored` must reflect only the former.
    mockFindExpected.mockResolvedValue([
      { cat_id: "catP", region_id: "r1" },
      { cat_id: "catA", region_id: "r1" },
      { cat_id: "catB", region_id: "r1" },
    ]);
    mockRefresh.mockImplementation(async (catId: string) =>
      catId === "catA" ? { id: "r1", name: "R1" } : undefined,
    );

    const outcome = await reconcileSheetRepresentation(
      [{ id: "r1", name: "R1" }],
      new Map([
        ["r1", [{ raw: [], entityId: "catP", lastEditedAt: null, editedBy: null, rowIndex: 3 }]],
      ]),
      new Set(),
    );

    expect(outcome.restored).toBe(1);
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  describe("wrongTab repair guard (repairRegionMove)", () => {
    // catA is expected on r2 but its only row currently sits on r1's tab.
    // catZ is expected AND correctly present on r2, so r2's snapshot isn't
    // empty and looksWiped doesn't fire and mask the repair.
    function arrange() {
      mockFindExpected.mockResolvedValue([
        { cat_id: "catA", region_id: "r2" },
        { cat_id: "catZ", region_id: "r2" },
      ]);
      const states = new Map([
        ["r1", [{ raw: [], entityId: "catA", lastEditedAt: null, editedBy: null, rowIndex: 3 }]],
        ["r2", [{ raw: [], entityId: "catZ", lastEditedAt: null, editedBy: null, rowIndex: 3 }]],
      ]);
      const allRegions = [
        { id: "r1", name: "R1" },
        { id: "r2", name: "R2" },
      ];
      return { allRegions, states };
    }

    it("does not DELETE when refreshCatInSyncQueue resolves nothing (cat gone / unresolvable / no longer Original)", async () => {
      const { allRegions, states } = arrange();
      mockRefresh.mockResolvedValue(undefined);

      const outcome = await reconcileSheetRepresentation(allRegions, states, new Set());

      expect(mockSupersede).not.toHaveBeenCalled();
      expect(mockInsertDelete).not.toHaveBeenCalled();
      expect(outcome.moved).toBe(0);
    });

    it("does not DELETE when refreshCatInSyncQueue resolves back to the SAME (from) region — no real move happened", async () => {
      const { allRegions, states } = arrange();
      mockRefresh.mockResolvedValue({ id: "r1", name: "R1" }); // same as fromRegionId

      const outcome = await reconcileSheetRepresentation(allRegions, states, new Set());

      expect(mockSupersede).not.toHaveBeenCalled();
      expect(mockInsertDelete).not.toHaveBeenCalled();
      expect(outcome.moved).toBe(0);
    });

    it("supersedes the OLD region and queues the DELETE only once resolution confirms a real move", async () => {
      const { allRegions, states } = arrange();
      mockRefresh.mockResolvedValue({ id: "r2", name: "R2" }); // resolves to the new region

      const outcome = await reconcileSheetRepresentation(allRegions, states, new Set());

      expect(mockSupersede).toHaveBeenCalledWith(
        "catA",
        "r1",
        "Superseded by reconciliation",
        expect.anything(),
      );
      expect(mockInsertDelete).toHaveBeenCalledWith("catA", "r1", [], expect.anything());
      expect(outcome.moved).toBe(1);
    });

    it("refresh runs BEFORE supersede/DELETE — order matters (see repairRegionMove's docstring)", async () => {
      const { allRegions, states } = arrange();
      const order: string[] = [];
      mockRefresh.mockImplementation(async () => {
        order.push("refresh");
        return { id: "r2", name: "R2" };
      });
      mockSupersede.mockImplementation(() => {
        order.push("supersede");
      });
      mockInsertDelete.mockImplementation(() => {
        order.push("insertDelete");
      });

      await reconcileSheetRepresentation(allRegions, states, new Set());

      expect(order).toEqual(["refresh", "supersede", "insertDelete"]);
    });
  });
});
