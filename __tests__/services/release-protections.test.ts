// Mock the seams BEFORE importing the module under test, mirroring
// __tests__/services/region-sheet-tab.test.ts. googleapis hands back a
// per-test fake stored on globalThis; wrapSheetsClient becomes a
// pass-through so the 1.2s pacing never runs in tests.
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
jest.mock("@/lib/repo/regions.repo", () => ({ findRegions: jest.fn() }));
jest.mock("@/lib/repo/sessions.repo", () => ({
  resolveCatRegion: jest.fn(),
  findLatestSessionDateForCat: jest.fn(),
}));

import { releaseSystemColProtections } from "@/lib/services/helper.service";
import * as regionsRepo from "@/lib/repo/regions.repo";

const findRegionsMock = regionsRepo.findRegions as jest.Mock;

interface FakeSheets {
  spreadsheets: {
    get: jest.Mock;
    batchUpdate: jest.Mock;
  };
}

function makeFakeSheets(): FakeSheets {
  return {
    spreadsheets: {
      get: jest.fn().mockResolvedValue({ data: { sheets: [] } }),
      batchUpdate: jest.fn().mockResolvedValue({ data: {} }),
    },
  };
}

/** A protectedRange entry for the given column range. */
function protection(
  protectedRangeId: number,
  startColumnIndex: number,
  endColumnIndex: number,
) {
  return {
    protectedRangeId,
    range: { startColumnIndex, endColumnIndex },
  };
}

let fakeSheets: FakeSheets;

beforeAll(() => {
  process.env.SERVICE_ACCOUNT_CREDENTIALS = JSON.stringify({
    client_email: "svc@example.com",
    private_key: "key",
  });
});

beforeEach(() => {
  fakeSheets = makeFakeSheets();
  (globalThis as unknown as { __fakeSheets: FakeSheets }).__fakeSheets =
    fakeSheets;
  findRegionsMock.mockResolvedValue([
    { id: "1", name: "GATE 3" },
    { id: "2", name: "ARETE" },
  ]);
});

describe("releaseSystemColProtections", () => {
  it("deletes protections matching column A and columns W–Y on region tabs, and issues no addProtectedRange", async () => {
    fakeSheets.spreadsheets.get.mockResolvedValue({
      data: {
        sheets: [
          {
            properties: { sheetId: 1, title: "GATE 3" },
            protectedRanges: [
              protection(101, 0, 1), // col A
              protection(102, 22, 25), // cols W–Y
            ],
          },
        ],
      },
    });

    const result = await releaseSystemColProtections();

    expect(result).toEqual({ released: 2 });

    const call = fakeSheets.spreadsheets.batchUpdate.mock.calls[0][0];
    const requests = call.requestBody.requests;

    expect(requests).toEqual([
      { deleteProtectedRange: { protectedRangeId: 101 } },
      { deleteProtectedRange: { protectedRangeId: 102 } },
    ]);

    // The whole point of retirement's release step: nothing is re-applied.
    expect(
      requests.some((r: Record<string, unknown>) => "addProtectedRange" in r),
    ).toBe(false);
    expect(
      call.requestBody.requests.every(
        (r: Record<string, unknown>) => !("addProtectedRange" in r),
      ),
    ).toBe(true);
  });

  it("leaves protections on other column ranges alone", async () => {
    fakeSheets.spreadsheets.get.mockResolvedValue({
      data: {
        sheets: [
          {
            properties: { sheetId: 1, title: "GATE 3" },
            protectedRanges: [
              protection(101, 0, 1), // col A — deleted
              protection(200, 2, 10), // unrelated data range — untouched
              protection(201, 1, 2), // col B, not col A — untouched
            ],
          },
        ],
      },
    });

    await releaseSystemColProtections();

    const requests =
      fakeSheets.spreadsheets.batchUpdate.mock.calls[0][0].requestBody
        .requests;

    expect(requests).toEqual([
      { deleteProtectedRange: { protectedRangeId: 101 } },
    ]);
    // Confirm the untouched protections' ids never appear in any request.
    const deletedIds = requests.map(
      (r: { deleteProtectedRange: { protectedRangeId: number } }) =>
        r.deleteProtectedRange.protectedRangeId,
    );
    expect(deletedIds).not.toContain(200);
    expect(deletedIds).not.toContain(201);
  });

  it("ignores tabs that are not current regions", async () => {
    fakeSheets.spreadsheets.get.mockResolvedValue({
      data: {
        sheets: [
          {
            properties: { sheetId: 1, title: "GATE 3" },
            protectedRanges: [protection(101, 0, 1)],
          },
          {
            properties: { sheetId: 2, title: "TEMPLATE" }, // not a region
            protectedRanges: [protection(999, 0, 1), protection(998, 22, 25)],
          },
          {
            properties: { sheetId: 3, title: "_config" }, // not a region
            protectedRanges: [protection(997, 22, 25)],
          },
        ],
      },
    });

    const result = await releaseSystemColProtections();

    expect(result).toEqual({ released: 1 });
    const requests =
      fakeSheets.spreadsheets.batchUpdate.mock.calls[0][0].requestBody
        .requests;
    expect(requests).toEqual([
      { deleteProtectedRange: { protectedRangeId: 101 } },
    ]);
  });

  it("resolves { released: 0 } without calling batchUpdate at all when nothing needs to be deleted", async () => {
    fakeSheets.spreadsheets.get.mockResolvedValue({
      data: {
        sheets: [
          {
            properties: { sheetId: 1, title: "GATE 3" },
            protectedRanges: [],
          },
          {
            properties: { sheetId: 2, title: "ARETE" },
            // Only a non-system protection present — nothing to release.
            protectedRanges: [protection(500, 2, 10)],
          },
        ],
      },
    });

    const result = await releaseSystemColProtections();

    expect(result).toEqual({ released: 0 });
    expect(fakeSheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });
});
