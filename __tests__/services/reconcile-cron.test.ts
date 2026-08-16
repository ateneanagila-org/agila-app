// ── Phase 0.5 wiring ─────────────────────────────────────────────────────────
// Verifies reconcileSheetRepresentation runs (a) after the shared Phase 0 read,
// (b) before the pending-task query — so a repair is pushed the SAME tick, and
// (c) before the idle early-exit — the exact case that hid drift originally,
// since a drifted cat produces neither a pending task nor a sheet edit.
//
// Mock shape copied from read-all-region-states.test.ts / sync-retirement.test.ts:
// db is a bare object we attach `query` / `selectDistinct` onto per-test, and
// every service sync-cron.service.ts calls is mocked at the module boundary.

const mockReconcile = jest.fn();
jest.mock("@/lib/services/reconcile.service", () => ({
  reconcileSheetRepresentation: (...a: unknown[]) => mockReconcile(...a),
}));

const mockReadAllRegionSheetStates = jest.fn();
const mockSyncAndCompactRegion = jest.fn();
const mockGenerateForRiSheet = jest.fn();
const mockGenerateForFaSheet = jest.fn();
jest.mock("@/lib/services/helper.service", () => ({
  readAllRegionSheetStates: (...a: unknown[]) =>
    mockReadAllRegionSheetStates(...a),
  syncAndCompactRegion: (...a: unknown[]) => mockSyncAndCompactRegion(...a),
  generateForRiSheet: (...a: unknown[]) => mockGenerateForRiSheet(...a),
  generateForFaSheet: (...a: unknown[]) => mockGenerateForFaSheet(...a),
}));

const mockReverseSyncRegionsFromState = jest.fn();
jest.mock("@/lib/services/reverse-sync.service", () => ({
  reverseSyncRegionsFromState: (...a: unknown[]) =>
    mockReverseSyncRegionsFromState(...a),
}));

const mockImportPhotosIfNeeded = jest.fn();
jest.mock("@/lib/services/photo-import.service", () => ({
  importPhotosIfNeeded: (...a: unknown[]) => mockImportPhotosIfNeeded(...a),
}));

jest.mock("@/lib/services/discord.service", () => ({
  sendSyncAlert: jest.fn(),
}));

// selectDistinct().from().where() chain — the pending-task query. Reassigned
// per test via setPendingTasks below.
const mockWhere = jest.fn();
const mockFrom = jest.fn(() => ({ where: mockWhere }));
const mockSelectDistinct = jest.fn((arg: unknown) => {
  void arg;
  return { from: mockFrom };
});

jest.mock("@/lib/db", () => ({
  db: {
    query: { regions: { findMany: jest.fn() } },
    selectDistinct: (arg: unknown) => mockSelectDistinct(arg),
  },
}));

import { syncAllPendingRegions } from "@/lib/services/sync-cron.service";
import { db } from "@/lib/db";

const mockDb = db as unknown as {
  query: { regions: { findMany: jest.Mock } };
};

const REGIONS = [
  { id: "r1", name: "ALPHA" },
  { id: "r2", name: "BETA" },
];

function setPendingTasks(tasks: { regionId: string }[]) {
  mockWhere.mockResolvedValue(tasks);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.query.regions.findMany.mockResolvedValue(REGIONS);
  mockReconcile.mockResolvedValue({
    restored: 0,
    moved: 0,
    deferred: 0,
    skippedRegions: [],
    skippedTick: false,
  });
  mockReadAllRegionSheetStates.mockResolvedValue({
    states: new Map(),
    failed: new Set(),
  });
  mockReverseSyncRegionsFromState.mockResolvedValue({ totalImported: 0 });
  mockImportPhotosIfNeeded.mockResolvedValue(undefined);
  mockSyncAndCompactRegion.mockResolvedValue(undefined);
  setPendingTasks([]);
});

describe("Phase 0.5 wiring", () => {
  it("runs reconciliation even on an otherwise idle tick", async () => {
    // No pending tasks, no snapshot row carrying lastEditedAt, empty failed
    // set — the old code would bail before anything looked at drift.
    mockReadAllRegionSheetStates.mockResolvedValue({
      states: new Map([
        ["r1", []],
        ["r2", []],
      ]),
      failed: new Set(),
    });
    setPendingTasks([]);

    await syncAllPendingRegions();

    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(mockReconcile).toHaveBeenCalledWith(
      REGIONS,
      expect.any(Map),
      expect.any(Set),
    );
    // Confirms the tick really did stay idle otherwise — reconciliation ran
    // despite it, not because idle detection broke.
    expect(mockReverseSyncRegionsFromState).not.toHaveBeenCalled();
  });

  it("queries pending tasks AFTER reconciliation, so a repair is pushed this tick", async () => {
    const calls: string[] = [];
    mockReconcile.mockImplementation(async () => {
      calls.push("reconcile");
      return {
        restored: 1,
        moved: 0,
        deferred: 0,
        skippedRegions: [],
        skippedTick: false,
      };
    });
    mockWhere.mockImplementation(async () => {
      calls.push("pendingQuery");
      return [{ regionId: "r1" }];
    });

    await syncAllPendingRegions();

    expect(calls).toEqual(["reconcile", "pendingQuery"]);
    // A repair queues a task; the pending-task query (run after reconcile)
    // picks it up and forward sync runs for that region this same tick.
    expect(mockSyncAndCompactRegion).toHaveBeenCalledWith("r1");
  });

  it("a reconciliation failure does not fail the tick", async () => {
    mockReconcile.mockRejectedValue(new Error("boom"));
    // Give the tick other work so later phases actually run.
    setPendingTasks([{ regionId: "r1" }]);

    await expect(syncAllPendingRegions()).resolves.not.toThrow();

    expect(mockReverseSyncRegionsFromState).toHaveBeenCalled();
    expect(mockSyncAndCompactRegion).toHaveBeenCalledWith("r1");
  });
});
