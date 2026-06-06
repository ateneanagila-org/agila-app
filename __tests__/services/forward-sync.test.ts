// ── Mock the seams BEFORE importing the module under test ───────────────────
// connectToSheets() builds a googleapis client and wraps it. We mock googleapis
// to hand back a per-test fake (stored on globalThis so the factory can read it
// lazily at call time) and make wrapSheetsClient an identity pass-through so no
// 1.2s pacing runs in tests.
jest.mock("googleapis", () => ({
  google: {
    auth: {
      GoogleAuth: class {
        async getAccessToken() {
          return "token";
        }
      },
    },
    sheets: () =>
      (globalThis as unknown as { __fakeSheets: unknown }).__fakeSheets,
  },
}));

jest.mock("@/lib/services/sheets-client.service", () => ({
  wrapSheetsClient: (raw: unknown) => raw,
  __resetPacingForTests: () => {},
}));

jest.mock("@/lib/db", () => ({ db: {}, Transaction: class {} }));
jest.mock("@/lib/services/system.service", () => ({ isSyncFrozen: jest.fn() }));
jest.mock("@/lib/repo/cats.repo", () => ({ findCatsByIds: jest.fn() }));
jest.mock("@/lib/repo/regions.repo", () => ({ findRegionById: jest.fn() }));
jest.mock("@/lib/repo/sessions.repo", () => ({
  resolveCatRegion: jest.fn(),
  findLatestSessionDateForCat: jest.fn().mockResolvedValue(null),
}));

import {
  syncAndCompactRegion,
  clearSheetEditTimestamps,
  backfillCatalogIds,
  type SheetRow,
} from "@/lib/services/helper.service";
import { db } from "@/lib/db";
import { isSyncFrozen } from "@/lib/services/system.service";
import * as catsRepo from "@/lib/repo/cats.repo";
import * as regionsRepo from "@/lib/repo/regions.repo";

// ── Fakes ───────────────────────────────────────────────────────────────────

interface FakeSheets {
  spreadsheets: {
    get: jest.Mock;
    batchUpdate: jest.Mock;
    values: {
      get: jest.Mock;
      batchGet: jest.Mock;
      update: jest.Mock;
      batchUpdate: jest.Mock;
      clear: jest.Mock;
    };
  };
}

function makeFakeSheets(): FakeSheets {
  return {
    spreadsheets: {
      get: jest.fn().mockResolvedValue({ data: { sheets: [] } }),
      batchUpdate: jest.fn().mockResolvedValue({ data: {} }),
      values: {
        get: jest.fn().mockResolvedValue({ data: { values: [] } }),
        batchGet: jest.fn().mockResolvedValue({ data: {} }),
        update: jest.fn().mockResolvedValue({ data: {} }),
        batchUpdate: jest.fn().mockResolvedValue({ data: {} }),
        clear: jest.fn().mockResolvedValue({ data: {} }),
      },
    },
  };
}

let fakeSheets: FakeSheets;
const dbm = db as unknown as Record<string, jest.Mock | unknown>;
const frozenMock = isSyncFrozen as jest.Mock;
const findCatsByIdsMock = catsRepo.findCatsByIds as jest.Mock;
const findRegionByIdMock = regionsRepo.findRegionById as jest.Mock;

/** A no-op chainable for db.update(...).set(...).where(...). */
function chainableUpdate() {
  return jest.fn(() => ({
    set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
  }));
}

/** A 25-wide sheet row; pass column→value overrides. */
function row(overrides: Record<number, string>): string[] {
  const r = new Array<string>(25).fill("");
  for (const [idx, val] of Object.entries(overrides)) r[Number(idx)] = val;
  return r;
}

beforeAll(() => {
  process.env.SERVICE_ACCOUNT_CREDENTIALS = JSON.stringify({
    client_email: "svc@example.com",
    private_key: "key",
  });
  process.env.CATALOG_SPREADSHEET_ID = "SHEET_ID";
});

beforeEach(() => {
  fakeSheets = makeFakeSheets();
  (globalThis as unknown as { __fakeSheets: FakeSheets }).__fakeSheets =
    fakeSheets;

  frozenMock.mockResolvedValue(false);
  findCatsByIdsMock.mockResolvedValue([]);

  dbm.query = {
    regions: { findFirst: jest.fn() },
    gsheetSyncQueue: { findMany: jest.fn().mockResolvedValue([]) },
    cats: { findFirst: jest.fn() },
    catHealthRecords: { findFirst: jest.fn().mockResolvedValue(null) },
    interventions: { findMany: jest.fn().mockResolvedValue([]) },
  };
  dbm.insert = jest.fn(() => ({
    values: jest.fn().mockResolvedValue(undefined),
  }));
  dbm.update = chainableUpdate();
});

// ── syncAndCompactRegion ─────────────────────────────────────────────────────

describe("syncAndCompactRegion", () => {
  const REGION = { id: "r1", name: "GATE 3" };

  function task(overrides: Record<string, unknown>) {
    return {
      id: "t1",
      action: "UPDATE",
      entityId: "u1",
      payload: row({}),
      retryCount: 0,
      ...overrides,
    };
  }

  it("skips entirely when sync is frozen", async () => {
    frozenMock.mockResolvedValue(true);
    await syncAndCompactRegion("r1");
    expect(fakeSheets.spreadsheets.values.get).not.toHaveBeenCalled();
  });

  it("returns early without touching the sheet when there are no pending tasks", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([]);
    await syncAndCompactRegion("r1");
    expect(fakeSheets.spreadsheets.values.get).not.toHaveBeenCalled();
  });

  it("UPDATE keeps the existing catalog number but refreshes the status suffix from col L", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    fakeSheets.spreadsheets.values.get.mockResolvedValue({
      data: { values: [row({ 0: "5", 2: "Bella", 24: "u1" })] },
    });
    const payload = row({ 0: "ignored", 2: "Bella", 11: "MIA", 24: "u1" });
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([
      task({ entityId: "u1", payload }),
    ]);

    await syncAndCompactRegion("r1");

    // First update writes the data block to A3.
    const dataUpdate = fakeSheets.spreadsheets.values.update.mock.calls.find(
      (c) => String(c[0].range).endsWith("!A3"),
    );
    expect(dataUpdate).toBeDefined();
    const written = dataUpdate![0].requestBody.values as string[][];
    expect(written[0][0]).toBe("5m"); // number preserved, suffix recomputed
  });

  it("UPDATE preserves the sheet's date_last_seen (col N) when the payload has no DB date", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    // Sheet already has a valid date in col N (13); DB has no session → payload "N/A".
    fakeSheets.spreadsheets.values.get.mockResolvedValue({
      data: { values: [row({ 0: "5", 2: "Bella", 13: "1/2/2024", 24: "u1" })] },
    });
    const payload = row({ 0: "x", 2: "Bella", 13: "N/A", 24: "u1" });
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([
      task({ entityId: "u1", payload }),
    ]);

    await syncAndCompactRegion("r1");

    const dataUpdate = fakeSheets.spreadsheets.values.update.mock.calls.find(
      (c) => String(c[0].range).endsWith("!A3"),
    )!;
    const written = dataUpdate[0].requestBody.values as string[][];
    expect(written[0][13]).toBe("1/2/2024"); // sheet date kept, not blanked to N/A
  });

  it("UPDATE lets a real DB date_last_seen win over the sheet value", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    fakeSheets.spreadsheets.values.get.mockResolvedValue({
      data: { values: [row({ 0: "5", 2: "Bella", 13: "1/2/2024", 24: "u1" })] },
    });
    // Payload carries a fresh session-derived date → it should win.
    const payload = row({ 0: "x", 2: "Bella", 13: "6/1/2026", 24: "u1" });
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([
      task({ entityId: "u1", payload }),
    ]);

    await syncAndCompactRegion("r1");

    const dataUpdate = fakeSheets.spreadsheets.values.update.mock.calls.find(
      (c) => String(c[0].range).endsWith("!A3"),
    )!;
    const written = dataUpdate[0].requestBody.values as string[][];
    expect(written[0][13]).toBe("6/1/2026"); // DB date wins
  });

  it("CREATE (UUID absent from sheet) assigns the next catalog number from col A", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    fakeSheets.spreadsheets.values.get.mockResolvedValue({
      data: { values: [row({ 0: "3", 2: "Zoe", 24: "u-existing" })] },
    });
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([
      task({ id: "t2", entityId: "u-new", payload: row({}) }),
    ]);
    (
      dbm.query as { cats: { findFirst: jest.Mock } }
    ).cats.findFirst.mockResolvedValue({
      id: "u-new",
      cat_status: null,
      name: "Aaa",
      is_adoptable: false,
    });

    await syncAndCompactRegion("r1");

    const dataUpdate = fakeSheets.spreadsheets.values.update.mock.calls.find(
      (c) => String(c[0].range).endsWith("!A3"),
    )!;
    const written = dataUpdate[0].requestBody.values as string[][];
    // Sorted by catalog number: existing "3" (Zoe) before new "4" (Aaa).
    expect(written[0][0]).toBe("3");
    expect(written[1][0]).toBe("4"); // 3 + 1
    expect(written[1][2]).toBe("Aaa");
  });

  it("DELETE removes the row and writes only the survivors", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    fakeSheets.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          row({ 0: "1", 2: "Anna", 24: "u1" }),
          row({ 0: "2", 2: "Zoe", 24: "u2" }),
        ],
      },
    });
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([
      task({ id: "t3", action: "DELETE", entityId: "u1" }),
    ]);

    await syncAndCompactRegion("r1");

    const dataUpdate = fakeSheets.spreadsheets.values.update.mock.calls.find(
      (c) => String(c[0].range).endsWith("!A3"),
    )!;
    const written = dataUpdate[0].requestBody.values as string[][];
    expect(written).toHaveLength(1);
    expect(written[0][24]).toBeUndefined(); // slice(0,22) drops col Y from data block
    // UUID column is written separately and contains only the survivor.
    const uuidUpdate = fakeSheets.spreadsheets.values.update.mock.calls.find(
      (c) => String(c[0].range).endsWith("!Y3"),
    )!;
    expect(uuidUpdate[0].requestBody.values).toEqual([["u2"]]);
  });

  it("compacts blank-UUID rows out and sorts the rest by catalog number", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    fakeSheets.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          row({ 0: "2", 2: "Zoe", 24: "u2" }),
          row({ 2: "Ghost" }), // no UUID — must be dropped
          row({ 0: "1", 2: "Anna", 24: "u1" }),
        ],
      },
    });
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([
      task({ entityId: "u1", payload: row({ 0: "x", 2: "Anna", 24: "u1" }) }),
    ]);

    await syncAndCompactRegion("r1");

    const uuidUpdate = fakeSheets.spreadsheets.values.update.mock.calls.find(
      (c) => String(c[0].range).endsWith("!Y3"),
    )!;
    expect(uuidUpdate[0].requestBody.values).toEqual([["u1"], ["u2"]]); // Anna, then Zoe
  });

  it("clears A3:V before writing and never writes W/X", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    fakeSheets.spreadsheets.values.get.mockResolvedValue({
      data: { values: [row({ 0: "1", 2: "Anna", 24: "u1" })] },
    });
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([
      task({ entityId: "u1", payload: row({ 0: "x", 2: "Anna", 24: "u1" }) }),
    ]);

    await syncAndCompactRegion("r1");

    expect(fakeSheets.spreadsheets.values.clear).toHaveBeenCalledWith(
      expect.objectContaining({ range: "'GATE 3'!A3:V" }),
    );
    const writtenRanges = fakeSheets.spreadsheets.values.update.mock.calls.map(
      (c) => c[0].range,
    );
    expect(writtenRanges.some((r: string) => /![WX]/.test(r))).toBe(false);
  });

  it("preserves an untouched row's photo by rebuilding col B from DB", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    // Sheet read returns col B = "" for the photo row (=IMAGE() flattens under
    // FORMATTED_VALUE). u-photo is NOT in the task list — only u-other is.
    fakeSheets.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          row({ 0: "1", 2: "Bella", 24: "u-photo" }),
          row({ 0: "2", 2: "Max", 24: "u-other" }),
        ],
      },
    });
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([
      task({ entityId: "u-other", payload: row({ 0: "x", 2: "Max", 24: "u-other" }) }),
    ]);
    findCatsByIdsMock.mockResolvedValue([
      { id: "u-photo", photo_url: "http://p/cat.jpg" },
      { id: "u-other", photo_url: null },
    ]);

    await syncAndCompactRegion("r1");

    const dataUpdate = fakeSheets.spreadsheets.values.update.mock.calls.find(
      (c) => String(c[0].range).endsWith("!A3"),
    )!;
    const written = dataUpdate[0].requestBody.values as string[][];
    // Sorted by catalog number: u-photo (1) first, u-other (2) second.
    expect(written[0][1]).toBe('=IMAGE("http://p/cat.jpg")'); // rebuilt from DB
    expect(written[1][1]).toBe(""); // u-other has no photo
  });

  it("re-stamps an untouched row's col A suffix from DB status (number from sheet)", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    // u-drift is NOT tasked. Sheet col A "5" (plain — looks active); DB says
    // Deceased. u-task is the only queued row (needed so sync runs at all).
    fakeSheets.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          row({ 0: "5", 2: "Bella", 24: "u-drift" }),
          row({ 0: "6", 2: "Max", 24: "u-task" }),
        ],
      },
    });
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([
      task({ entityId: "u-task", payload: row({ 0: "x", 2: "Max", 11: "", 24: "u-task" }) }),
    ]);
    findCatsByIdsMock.mockResolvedValue([
      { id: "u-drift", photo_url: null, cat_status: "Deceased" },
      { id: "u-task", photo_url: null, cat_status: null },
    ]);

    await syncAndCompactRegion("r1");

    const dataUpdate = fakeSheets.spreadsheets.values.update.mock.calls.find(
      (c) => String(c[0].range).endsWith("!A3"),
    )!;
    const written = dataUpdate[0].requestBody.values as string[][];
    // Sorted by catalog number: u-drift (5) first, u-task (6) second.
    expect(written[0][0]).toBe("5d"); // number kept from sheet, suffix from DB status
    expect(written[1][0]).toBe("6"); // active stays plain
  });

  it("leaves col A unchanged for an unnumbered survivor (no '<null>d')", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    // u-blank has a blank col A (no catalog number yet). Must not become "NaNd".
    fakeSheets.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          row({ 0: "", 2: "Ghost", 24: "u-blank" }),
          row({ 0: "6", 2: "Max", 24: "u-task" }),
        ],
      },
    });
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([
      task({ entityId: "u-task", payload: row({ 0: "x", 2: "Max", 11: "", 24: "u-task" }) }),
    ]);
    findCatsByIdsMock.mockResolvedValue([
      { id: "u-blank", photo_url: null, cat_status: "Deceased" },
      { id: "u-task", photo_url: null, cat_status: null },
    ]);

    await syncAndCompactRegion("r1");

    const dataUpdate = fakeSheets.spreadsheets.values.update.mock.calls.find(
      (c) => String(c[0].range).endsWith("!A3"),
    )!;
    const written = dataUpdate[0].requestBody.values as string[][];
    // u-task (6) sorts first; unnumbered u-blank sinks to the bottom, col A still "".
    expect(written[0][0]).toBe("6");
    expect(written[1][0]).toBe("");
  });

  it("does not re-stamp col A on UNKNOWN (no suffix layout)", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue({ id: "r-unk", name: "UNKNOWN" });
    fakeSheets.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          row({ 0: "5", 2: "Loc", 24: "u-drift" }),
          row({ 0: "6", 2: "Loc2", 24: "u-task" }),
        ],
      },
    });
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([
      task({ entityId: "u-task", payload: row({ 0: "x", 24: "u-task" }) }),
    ]);
    findCatsByIdsMock.mockResolvedValue([
      { id: "u-drift", photo_url: null, cat_status: "Deceased" },
      { id: "u-task", photo_url: null, cat_status: null },
    ]);

    await syncAndCompactRegion("r-unk");

    const dataUpdate = fakeSheets.spreadsheets.values.update.mock.calls.find(
      (c) => String(c[0].range).endsWith("!A3"),
    )!;
    const written = dataUpdate[0].requestBody.values as string[][];
    expect(written[0][0]).toBe("5"); // untouched, no suffix on UNKNOWN
  });

  it("returns the post-write region state for snapshot merge", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    fakeSheets.spreadsheets.values.get.mockResolvedValue({
      data: { values: [row({ 0: "5", 2: "Bella", 24: "u1" })] },
    });
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([
      task({ entityId: "u1", payload: row({ 0: "x", 2: "Bella", 24: "u1" }) }),
    ]);

    const result = await syncAndCompactRegion("r1");

    expect(result).not.toBeNull();
    expect(result!.map((r) => r.entityId)).toEqual(["u1"]);
    expect(result![0].raw[0]).toBe("5"); // col A preserved
    expect(result![0].rowIndex).toBe(3);
  });

  it("returns null when there are no pending tasks", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([]);
    expect(await syncAndCompactRegion("r1")).toBeNull();
  });

  it("on a sheet read failure, increments retryCount and still writes an audit log", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([task({ entityId: "u1" })]);
    fakeSheets.spreadsheets.values.get.mockRejectedValue(new Error("boom"));

    await syncAndCompactRegion("r1");

    expect(dbm.update).toHaveBeenCalled(); // retry bookkeeping
    expect(dbm.insert).toHaveBeenCalled(); // audit log in finally
  });
});

// ── clearSheetEditTimestamps ─────────────────────────────────────────────────

describe("clearSheetEditTimestamps", () => {
  const REGION = { id: "r1", name: "GATE 3" };

  it("does nothing (no region lookup) for an empty argument", async () => {
    await clearSheetEditTimestamps("r1", []);
    expect(
      (dbm.query as { regions: { findFirst: jest.Mock } }).regions.findFirst,
    ).not.toHaveBeenCalled();
  });

  it("positional path: clears only rows whose col W still matches the snapshot", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    // Re-read of W3:W — row 3 unchanged ("T1"), row 4 changed since snapshot.
    fakeSheets.spreadsheets.values.get.mockResolvedValue({
      data: { values: [["T1"], ["CHANGED"]] },
    });

    await clearSheetEditTimestamps("r1", [
      { entityId: "u1", rowIndex: 3, expectedTimestamp: "T1" },
      { entityId: "u2", rowIndex: 4, expectedTimestamp: "T2" },
    ]);

    expect(fakeSheets.spreadsheets.values.batchUpdate).toHaveBeenCalledTimes(1);
    const data =
      fakeSheets.spreadsheets.values.batchUpdate.mock.calls[0][0].requestBody
        .data;
    expect(data).toHaveLength(1);
    expect(data[0].range).toBe("'GATE 3'!W3:X3");
    expect(data[0].values).toEqual([["", ""]]);
  });

  it("positional path: skips entries with a null expected timestamp", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);

    await clearSheetEditTimestamps("r1", [
      { entityId: "u1", rowIndex: 3, expectedTimestamp: null },
    ]);

    // All entries filtered out before any re-read or write.
    expect(fakeSheets.spreadsheets.values.get).not.toHaveBeenCalled();
    expect(fakeSheets.spreadsheets.values.batchUpdate).not.toHaveBeenCalled();
  });

  it("legacy entity-id path: locates rows via a col-Y read then clears them", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    fakeSheets.spreadsheets.values.get.mockResolvedValue({
      data: { values: [["u1"], ["u2"]] }, // Y3:Y → u1 at row 3, u2 at row 4
    });

    await clearSheetEditTimestamps("r1", ["u2"]);

    const data =
      fakeSheets.spreadsheets.values.batchUpdate.mock.calls[0][0].requestBody
        .data;
    expect(data).toHaveLength(1);
    expect(data[0].range).toBe("'GATE 3'!W4:X4");
  });
});

// ── backfillCatalogIds ───────────────────────────────────────────────────────

describe("backfillCatalogIds", () => {
  const REGION = { id: "r1", name: "GATE 3" };

  function snap(colA: string, entityId: string, rowIndex: number): SheetRow {
    return {
      raw: row({ 0: colA, 24: entityId }),
      entityId,
      lastEditedAt: null,
      editedBy: null,
      rowIndex,
    };
  }

  it("returns 0 and writes nothing when every row already has a number", async () => {
    findRegionByIdMock.mockResolvedValue(REGION);
    const result = await backfillCatalogIds("r1", [
      snap("5", "u1", 3),
      snap("6", "u2", 4),
    ]);
    expect(result).toBe(0);
    expect(fakeSheets.spreadsheets.values.batchUpdate).not.toHaveBeenCalled();
  });

  it("numbers unnumbered rows from max+1 and appends the DB status suffix", async () => {
    findRegionByIdMock.mockResolvedValue(REGION);
    findCatsByIdsMock.mockResolvedValue([{ id: "u-new", cat_status: "MIA" }]);

    const result = await backfillCatalogIds("r1", [
      snap("5", "u1", 3), // already numbered → currentMax = 5
      snap("", "u-new", 4), // needs a number
    ]);

    expect(result).toBe(1);
    const data =
      fakeSheets.spreadsheets.values.batchUpdate.mock.calls[0][0].requestBody
        .data;
    expect(data).toHaveLength(1);
    expect(data[0].range).toBe("'GATE 3'!A4");
    expect(data[0].values).toEqual([["6m"]]); // 5 + 1, MIA → "m"
  });
});
