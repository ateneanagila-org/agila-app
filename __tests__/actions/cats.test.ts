jest.mock("@/lib/repo/cats.repo", () => ({
  insertCat: jest.fn(),
  insertCatHealthRecord: jest.fn(),
  updateCat: jest.fn(),
  updateCatHealthRecord: jest.fn(),
  deleteCat: jest.fn(),
}));
jest.mock("@/lib/repo/sessions.repo", () => ({ resolveCatRegion: jest.fn() }));
jest.mock("@/lib/services/helper.service", () => ({ refreshCatInSyncQueue: jest.fn() }));
jest.mock("@/lib/services/system-session.service", () => ({ linkCatToSystemSession: jest.fn() }));
jest.mock("@/lib/db", () => ({
  db: { transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb({})) },
  Transaction: class {},
}));

import { createCat } from "@/lib/services/cats.service";
import * as catsRepo from "@/lib/repo/cats.repo";
import { linkCatToSystemSession } from "@/lib/services/system-session.service";
import { refreshCatInSyncQueue } from "@/lib/services/helper.service";

const mockInsertCat = catsRepo.insertCat as jest.Mock;
const mockInsertHealthRecord = catsRepo.insertCatHealthRecord as jest.Mock;
const mockLink = linkCatToSystemSession as jest.Mock;
const mockRefresh = refreshCatInSyncQueue as jest.Mock;

const baseCat = {
  name: "Pesto",
  color: "Gray Tabby",
  age: "Kitten",
  sex: "Male",
  region_id: "R-1",
  condition: "Healthy",
  is_neutered: false,
} as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockInsertCat.mockResolvedValue([{ id: "c1", name: "Pesto" }]);
  mockInsertHealthRecord.mockResolvedValue(undefined);
  mockLink.mockResolvedValue(undefined);
  mockRefresh.mockResolvedValue(undefined);
});

describe("createCat", () => {
  it("systemSession=true: sets entry_status to Original", async () => {
    await createCat(baseCat, { systemSession: true });

    expect(mockInsertCat).toHaveBeenCalledWith(
      expect.objectContaining({ entry_status: "Original" }),
      expect.anything(),
    );
  });

  it("systemSession=true: triggers link and sync queue", async () => {
    await createCat(baseCat, { systemSession: true });

    expect(mockLink).toHaveBeenCalledWith("c1", "R-1", expect.anything());
    expect(mockRefresh).toHaveBeenCalledWith("c1", expect.anything());
  });

  it("no systemSession: does not force entry_status", async () => {
    await createCat(baseCat);

    const [insertedData] = mockInsertCat.mock.calls[0];
    expect(insertedData).not.toHaveProperty("entry_status");
  });

  it("no systemSession: skips link and sync queue", async () => {
    await createCat(baseCat);

    expect(mockLink).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("returns the newly created cat", async () => {
    const result = await createCat(baseCat, { systemSession: true });
    expect(result).toEqual({ id: "c1", name: "Pesto" });
  });
});
