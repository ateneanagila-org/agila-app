// Mock the seams BEFORE importing the module under test, mirroring
// __tests__/services/forward-sync.test.ts. googleapis hands back a per-test
// fake stored on globalThis; wrapSheetsClient becomes a pass-through so the
// 1.2s pacing never runs in tests.
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
jest.mock("@/lib/repo/regions.repo", () => ({
  findRegions: jest.fn(),
  findRegionById: jest.fn(),
}));
jest.mock("@/lib/repo/sessions.repo", () => ({
  resolveCatRegion: jest.fn(),
  findLatestSessionDateForCat: jest.fn(),
}));

import { createRegionSheetTab } from "@/lib/services/helper.service";

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
      batchUpdate: jest.fn().mockResolvedValue({
        data: { replies: [{ duplicateSheet: { properties: { sheetId: 99 } } }] },
      }),
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

/** A spreadsheets.get reply listing the given tab titles. */
function sheetsNamed(...titles: string[]) {
  return {
    data: {
      sheets: titles.map((title, i) => ({
        properties: { title, sheetId: i + 1 },
      })),
    },
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
});

describe("createRegionSheetTab", () => {
  it("duplicates the tab named TEMPLATE, not the first region tab", async () => {
    // GATE 3 sorts first and is what the old NON_REGION_TABS-based lookup picked.
    fakeSheets.spreadsheets.get.mockResolvedValue(
      sheetsNamed("GATE 3", "ARETE", "TEMPLATE"),
    );

    await createRegionSheetTab("LIBRARY");

    const req =
      fakeSheets.spreadsheets.batchUpdate.mock.calls[0][0].requestBody
        .requests[0];
    // TEMPLATE is third in the list above, so sheetId 3.
    expect(req.duplicateSheet.sourceSheetId).toBe(3);
    expect(req.duplicateSheet.newSheetName).toBe("LIBRARY");
  });

  it("throws a clear error when no TEMPLATE tab exists", async () => {
    fakeSheets.spreadsheets.get.mockResolvedValue(
      sheetsNamed("GATE 3", "ARETE"),
    );

    await expect(createRegionSheetTab("LIBRARY")).rejects.toThrow(/TEMPLATE/);
    expect(fakeSheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });

  it("stamps row 1 with the new region name", async () => {
    fakeSheets.spreadsheets.get.mockResolvedValue(sheetsNamed("TEMPLATE"));

    await createRegionSheetTab("LIBRARY");

    const titleWrite = fakeSheets.spreadsheets.values.update.mock.calls.find(
      (c) => String(c[0].range).endsWith("!A1"),
    );
    expect(titleWrite).toBeDefined();
    expect(titleWrite![0].requestBody.values).toEqual([["LIBRARY"]]);
  });

  it("clears the data rows but leaves the header rows intact", async () => {
    fakeSheets.spreadsheets.get.mockResolvedValue(sheetsNamed("TEMPLATE"));

    await createRegionSheetTab("LIBRARY");

    expect(fakeSheets.spreadsheets.values.clear).toHaveBeenCalledWith(
      expect.objectContaining({ range: "'LIBRARY'!A3:Z" }),
    );
  });

  it("is a no-op when a tab with that name already exists", async () => {
    fakeSheets.spreadsheets.get.mockResolvedValue(
      sheetsNamed("TEMPLATE", "LIBRARY"),
    );

    await createRegionSheetTab("LIBRARY");

    expect(fakeSheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });
});
