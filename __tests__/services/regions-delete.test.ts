jest.mock("@/lib/repo/regions.repo", () => ({
  findRegionById: jest.fn(),
  isRegionEmpty: jest.fn(),
  findCatsOnlyInRegion: jest.fn(),
  deleteRegion: jest.fn(),
}));
jest.mock("@/lib/repo/cats.repo", () => ({ deleteCatsByIds: jest.fn() }));
jest.mock("@/lib/services/helper.service", () => ({
  deleteRegionSheetTab: jest.fn(),
  provisionRegionSheets: jest.fn(),
  createRegionSheetTab: jest.fn(),
  renameRegionSheetTab: jest.fn(),
}));
jest.mock("@/lib/services/system.service", () => ({
  isSyncRetired: jest.fn().mockResolvedValue(false),
}));
jest.mock("@/lib/db", () => ({
  db: { transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb({})) },
  Transaction: class {},
}));

import { deleteRegion } from "@/lib/services/regions.service";
import * as regionsRepo from "@/lib/repo/regions.repo";
import * as catsRepo from "@/lib/repo/cats.repo";
import * as helper from "@/lib/services/helper.service";

const mockRepo = regionsRepo as jest.Mocked<typeof regionsRepo>;
const mockCatsRepo = catsRepo as jest.Mocked<typeof catsRepo>;
const mockHelper = helper as jest.Mocked<typeof helper>;

beforeEach(() => jest.clearAllMocks());

describe("deleteRegion", () => {
  it("empty region: deletes region + tab, no cat deletion", async () => {
    mockRepo.findRegionById.mockResolvedValue({ id: "r1", name: "TEST" } as never);
    mockRepo.isRegionEmpty.mockResolvedValue(true);

    await deleteRegion({ id: "r1" });

    expect(mockRepo.deleteRegion).toHaveBeenCalledWith("r1", expect.anything());
    expect(mockCatsRepo.deleteCatsByIds).not.toHaveBeenCalled();
    expect(mockHelper.deleteRegionSheetTab).toHaveBeenCalledWith("TEST");
  });

  it("non-empty region without force: throws qualitative warning, deletes nothing", async () => {
    mockRepo.findRegionById.mockResolvedValue({ id: "r1", name: "TEST" } as never);
    mockRepo.isRegionEmpty.mockResolvedValue(false);

    await expect(deleteRegion({ id: "r1" })).rejects.toThrow(/not empty/);
    expect(mockRepo.deleteRegion).not.toHaveBeenCalled();
    expect(mockHelper.deleteRegionSheetTab).not.toHaveBeenCalled();
  });

  it("non-empty region with force: deletes region + orphaned cats + tab", async () => {
    mockRepo.findRegionById.mockResolvedValue({ id: "r1", name: "TEST" } as never);
    mockRepo.isRegionEmpty.mockResolvedValue(false);
    mockRepo.findCatsOnlyInRegion.mockResolvedValue(["c1", "c2"]);

    await deleteRegion({ id: "r1", force: true });

    expect(mockRepo.deleteRegion).toHaveBeenCalledWith("r1", expect.anything());
    expect(mockCatsRepo.deleteCatsByIds).toHaveBeenCalledWith(
      ["c1", "c2"],
      expect.anything(),
    );
    expect(mockHelper.deleteRegionSheetTab).toHaveBeenCalledWith("TEST");
  });
});
