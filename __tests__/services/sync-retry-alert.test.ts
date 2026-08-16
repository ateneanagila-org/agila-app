// ── Mock the seams BEFORE importing the module under test ───────────────────
// Same mock shape as forward-sync.test.ts: googleapis + wrapSheetsClient are
// stubbed so connectToSheets() resolves against a fake client with no network
// or pacing, and db is a bare object we attach query/update/insert mocks to
// per-test. This test additionally mocks discord.service so sendSyncAlert is
// observable without hitting a real webhook.
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
jest.mock("@/lib/services/system.service", () => ({ getSyncHalt: jest.fn() }));
jest.mock("@/lib/repo/cats.repo", () => ({ findCatsByIds: jest.fn() }));
jest.mock("@/lib/repo/regions.repo", () => ({ findRegionById: jest.fn() }));
jest.mock("@/lib/repo/sessions.repo", () => ({
  resolveCatRegion: jest.fn(),
  findLatestSessionDateForCat: jest.fn().mockResolvedValue(null),
}));

const mockSendSyncAlert = jest.fn();
jest.mock("@/lib/services/discord.service", () => ({
  sendSyncAlert: (...a: unknown[]) => mockSendSyncAlert(...a),
}));

import { syncAndCompactRegion } from "@/lib/services/helper.service";
import { db } from "@/lib/db";
import { getSyncHalt } from "@/lib/services/system.service";

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
const haltMock = getSyncHalt as jest.Mock;

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
  mockSendSyncAlert.mockReset();

  fakeSheets = makeFakeSheets();
  (globalThis as unknown as { __fakeSheets: FakeSheets }).__fakeSheets =
    fakeSheets;

  haltMock.mockResolvedValue(null);

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

describe("retry exhaustion alerting", () => {
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

  it("alerts once when at least one task reaches MAX_RETRIES", async () => {
    // Arrange: region resolves, one queue task already at retryCount 2 (the
    // next failure pushes it to 3 === MAX_RETRIES), and the sheet read
    // rejects so syncAndCompactRegion falls into its catch block.
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([
      task({ entityId: "u1", retryCount: 2 }),
    ]);
    fakeSheets.spreadsheets.values.get.mockRejectedValue(new Error("boom"));

    await syncAndCompactRegion("r1");

    expect(mockSendSyncAlert).toHaveBeenCalledTimes(1);
    expect(mockSendSyncAlert.mock.calls[0][0]).toContain("GATE 3");
  });

  it("does not alert when tasks still have retries left", async () => {
    // Arrange: same failing-read setup, but the task starts at retryCount 0,
    // so after the increment it's still below MAX_RETRIES and stays PENDING.
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([
      task({ entityId: "u1", retryCount: 0 }),
    ]);
    fakeSheets.spreadsheets.values.get.mockRejectedValue(new Error("boom"));

    await syncAndCompactRegion("r1");

    expect(mockSendSyncAlert).not.toHaveBeenCalled();
  });
});
