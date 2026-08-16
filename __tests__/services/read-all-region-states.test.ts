// ── Mock the seams BENEATH readSheetState, not the module itself ────────────
// readAllRegionSheetStates calls readSheetState by lexical reference inside
// helper.service.ts, so a partial jest.mock of that module cannot intercept
// it — the function under test would still call the real implementation.
// Instead we mock the seams readSheetState itself depends on: googleapis
// (faked per-test via globalThis, mirroring forward-sync.test.ts) and
// sheets-client.service (wrapSheetsClient made an identity pass-through so
// no 1.2s pacing runs in tests). db.query.regions.findFirst is mocked too,
// since readSheetState looks the region up before reading its tab.
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

import { readAllRegionSheetStates } from "@/lib/services/helper.service";
import { db } from "@/lib/db";

interface FakeSheets {
  spreadsheets: {
    values: {
      get: jest.Mock;
    };
  };
}

function makeFakeSheets(getFn: jest.Mock): FakeSheets {
  return { spreadsheets: { values: { get: getFn } } };
}

const dbm = db as unknown as Record<string, unknown>;

const REGIONS = [
  { id: "r1", name: "ALPHA" },
  { id: "r2", name: "BETA" },
];

beforeAll(() => {
  process.env.SERVICE_ACCOUNT_CREDENTIALS = JSON.stringify({
    client_email: "svc@example.com",
    private_key: "key",
  });
  process.env.CATALOG_SPREADSHEET_ID = "SHEET_ID";
});

describe("readAllRegionSheetStates", () => {
  let findFirstMock: jest.Mock;
  let valuesGetMock: jest.Mock;

  beforeEach(() => {
    findFirstMock = jest.fn();
    valuesGetMock = jest.fn();
    dbm.query = { regions: { findFirst: findFirstMock } };
    (globalThis as unknown as { __fakeSheets: FakeSheets }).__fakeSheets =
      makeFakeSheets(valuesGetMock);
  });

  it("returns states for every region and an empty failed set when all reads succeed", async () => {
    findFirstMock.mockResolvedValue({ id: "r1", name: "ALPHA" });
    valuesGetMock.mockResolvedValue({ data: { values: [] } });

    const { states, failed } = await readAllRegionSheetStates(REGIONS);

    expect(states.size).toBe(2);
    expect(failed.size).toBe(0);
  });

  it("adds a throwing region to failed AND still maps it to [] for existing callers", async () => {
    findFirstMock.mockResolvedValue({ id: "r1", name: "ALPHA" });
    valuesGetMock
      .mockResolvedValueOnce({ data: { values: [] } }) // r1 succeeds
      .mockRejectedValueOnce(new Error("quota exceeded")); // r2 fails

    const { states, failed } = await readAllRegionSheetStates(REGIONS);

    expect(failed.has("r2")).toBe(true);
    expect(failed.has("r1")).toBe(false);
    // Existing callers (photo import, reverse sync) must see the old shape.
    expect(states.get("r2")).toEqual([]);
    expect(states.size).toBe(2);
  });
});
