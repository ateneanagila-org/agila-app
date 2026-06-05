// ── Mock the seams BEFORE importing the module under test ───────────────────
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
jest.mock("@/lib/repo/sessions.repo", () => ({
  resolveCatRegion: jest.fn(),
  findLatestSessionDateForCat: jest.fn(),
}));

import { refreshCatInSyncQueue } from "@/lib/services/helper.service";
import * as sessionsRepo from "@/lib/repo/sessions.repo";

const resolveRegion = sessionsRepo.resolveCatRegion as jest.Mock;
const latestSession = sessionsRepo.findLatestSessionDateForCat as jest.Mock;

function makeTx(cat: Record<string, unknown> | null) {
  const insertValues = jest.fn().mockResolvedValue(undefined);
  const insert = jest.fn(() => ({ values: insertValues }));
  const tx = {
    query: { cats: { findFirst: jest.fn().mockResolvedValue(cat) } },
    insert,
  };
  return { tx, insert, insertValues };
}

const baseCat = {
  id: "c1",
  photo_url: null,
  name: null,
  color: null,
  age: null,
  sex: null,
  sociability: null,
  cat_status: null,
  spot_last_seen: null,
  caretaker: null,
  notes: null,
  is_adoptable: false,
  paws_id: null,
  catHealthRecords: null,
  interventions: [],
};

beforeEach(() => {
  resolveRegion.mockReset();
  latestSession.mockReset();
  latestSession.mockResolvedValue(null);
});

describe("refreshCatInSyncQueue entry_status gate", () => {
  it("queues an UPDATE for an Original cat", async () => {
    resolveRegion.mockResolvedValue({ id: "R1", name: "GATE 3" });
    const { tx, insert, insertValues } = makeTx({ ...baseCat, entry_status: "Original" });

    const region = await refreshCatInSyncQueue("c1", tx as never);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE", entityId: "c1", regionId: "R1" }),
    );
    expect(region).toEqual({ id: "R1", name: "GATE 3" });
  });

  it("skips the INSERT for a non-Original cat but still returns the region", async () => {
    resolveRegion.mockResolvedValue({ id: "R1", name: "GATE 3" });
    const { tx, insert } = makeTx({ ...baseCat, entry_status: "Unreviewed" });

    const region = await refreshCatInSyncQueue("c1", tx as never);

    expect(insert).not.toHaveBeenCalled();
    expect(region).toEqual({ id: "R1", name: "GATE 3" });
  });
});
