jest.mock("@/lib/repo/regions.repo", () => ({
  findRegionById: jest.fn(),
  findRegionByName: jest.fn(),
  updateRegion: jest.fn(),
}));
jest.mock("@/lib/services/helper.service", () => ({
  renameRegionSheetTab: jest.fn(),
  provisionRegionSheets: jest.fn(),
  createRegionSheetTab: jest.fn(),
  deleteRegionSheetTab: jest.fn(),
  syncRegionSheetNames: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  db: { transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb({})) },
  Transaction: class {},
}));

import { updateRegion } from "@/lib/services/regions.service";
import * as regionsRepo from "@/lib/repo/regions.repo";
import * as helper from "@/lib/services/helper.service";

const mockRepo = regionsRepo as jest.Mocked<typeof regionsRepo>;
const mockHelper = helper as jest.Mocked<typeof helper>;

const EXISTING = { id: "r1", name: "GATE 3", color: "Green" };

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.findRegionById.mockResolvedValue(EXISTING as never);
  mockRepo.findRegionByName.mockResolvedValue(undefined as never);
  mockRepo.updateRegion.mockResolvedValue([
    { ...EXISTING, color: "Blue" },
  ] as never);
});

describe("updateRegion", () => {
  it("colour-only change never touches the spreadsheet", async () => {
    await updateRegion({ id: "r1", color: "Blue" });

    expect(mockRepo.updateRegion).toHaveBeenCalledWith("r1", {
      color: "Blue",
    });
    expect(mockHelper.renameRegionSheetTab).not.toHaveBeenCalled();
    expect(mockHelper.provisionRegionSheets).not.toHaveBeenCalled();
  });

  it("name change renames the sheet tab and re-provisions", async () => {
    await updateRegion({ id: "r1", name: "GATE 4" });

    expect(mockRepo.updateRegion).toHaveBeenCalledWith("r1", {
      name: "GATE 4",
    });
    expect(mockHelper.renameRegionSheetTab).toHaveBeenCalledWith(
      "GATE 3",
      "GATE 4",
    );
    expect(mockHelper.provisionRegionSheets).toHaveBeenCalled();
  });

  it("name and colour together update both and rename once", async () => {
    await updateRegion({ id: "r1", name: "GATE 4", color: "Red" });

    expect(mockRepo.updateRegion).toHaveBeenCalledWith("r1", {
      name: "GATE 4",
      color: "Red",
    });
    expect(mockHelper.renameRegionSheetTab).toHaveBeenCalledTimes(1);
  });

  it("submitting the unchanged name is not treated as a rename", async () => {
    await updateRegion({ id: "r1", name: "GATE 3", color: "Red" });

    expect(mockRepo.updateRegion).toHaveBeenCalledWith("r1", { color: "Red" });
    expect(mockHelper.renameRegionSheetTab).not.toHaveBeenCalled();
  });

  it("rejects a name that collides with another region", async () => {
    mockRepo.findRegionByName.mockResolvedValue({
      id: "r2",
      name: "ARETE",
    } as never);

    await expect(updateRegion({ id: "r1", name: "ARETE" })).rejects.toThrow(
      /already exists/,
    );
    expect(mockRepo.updateRegion).not.toHaveBeenCalled();
    expect(mockHelper.renameRegionSheetTab).not.toHaveBeenCalled();
  });

  it("throws when the region does not exist", async () => {
    mockRepo.findRegionById.mockResolvedValue(undefined as never);

    await expect(updateRegion({ id: "nope", color: "Red" })).rejects.toThrow(
      /not found/,
    );
  });
});
