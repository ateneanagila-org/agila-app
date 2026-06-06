// ── Mock the seams BEFORE importing the module under test ───────────────────
// importSheetRowToDB runs inside db.transaction and, on a status change, calls
// refreshCatInSyncQueue to enqueue a forward re-stamp. We mock the db so the
// transaction callback runs against a fake tx, and mock helper.service so
// refreshCatInSyncQueue is observable (its internals are tested separately).

jest.mock("@/lib/services/helper.service", () => ({
  readSheetState: jest.fn(),
  readAllRegionSheetStates: jest.fn(),
  clearSheetEditTimestamps: jest.fn(),
  refreshCatInSyncQueue: jest.fn(),
  backfillCatalogIds: jest.fn(),
}));
jest.mock("@/lib/services/system.service", () => ({ isSyncFrozen: jest.fn() }));
jest.mock("@/lib/services/system-session.service", () => ({
  linkCatToSystemSession: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  db: {
    transaction: jest.fn((cb: (tx: unknown) => unknown) =>
      cb((globalThis as unknown as { __fakeTx: unknown }).__fakeTx),
    ),
  },
}));

import { importSheetRowToDB } from "@/lib/services/reverse-sync.service";
import { refreshCatInSyncQueue } from "@/lib/services/helper.service";
import type { SheetRowParsed } from "@/lib/validation/reverse-sync";

const refreshMock = refreshCatInSyncQueue as jest.Mock;

let fakeTx: Record<string, unknown>;

function chain() {
  return { set: () => ({ where: () => Promise.resolve(undefined) }) };
}

function makeData(overrides: Partial<SheetRowParsed> = {}): SheetRowParsed {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Bella",
    color: null,
    age: null,
    sex: null,
    sociability: null,
    cat_status: null,
    spot_last_seen: null,
    caretaker: null,
    notes: null,
    is_adoptable: false,
    condition: null,
    is_neutered: null,
    neuter_date: null,
    vaccination_date: null,
    tnvr_signal: "ignore",
    vet_signal: "ignore",
    ...overrides,
  };
}

beforeEach(() => {
  refreshMock.mockReset();
  fakeTx = {
    update: jest.fn(() => chain()),
    insert: jest.fn(() => ({ values: () => Promise.resolve(undefined) })),
    query: {
      interventions: { findFirst: jest.fn().mockResolvedValue(undefined) },
    },
  };
  (globalThis as unknown as { __fakeTx: unknown }).__fakeTx = fakeTx;
});

describe("importSheetRowToDB status-change forward enqueue", () => {
  it("enqueues a forward re-stamp when the sheet changed cat_status", async () => {
    await importSheetRowToDB(makeData({ cat_status: "Deceased" }), null);

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(refreshMock).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000001",
      fakeTx,
    );
  });

  it("does NOT enqueue when cat_status is unchanged", async () => {
    await importSheetRowToDB(makeData({ cat_status: "Deceased" }), "Deceased");

    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("does NOT enqueue when prevStatus is omitted (legacy/recovery callers)", async () => {
    await importSheetRowToDB(makeData({ cat_status: "Deceased" }));

    expect(refreshMock).not.toHaveBeenCalled();
  });
});
