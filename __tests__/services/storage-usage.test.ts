jest.mock("@/lib/repo/storage.repo", () => ({
  sumPhotoStorageBytes: jest.fn(),
}));
jest.mock("@/lib/repo/system.repo", () => ({
  findSystemConfig: jest.fn(),
  findSystemConfigByKey: jest.fn(),
  upsertSystemConfig: jest.fn(),
  deleteSystemConfigKey: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  db: { query: { systemConfig: { findFirst: jest.fn() } } },
  Transaction: class {},
}));

import { getPhotoStorageUsage } from "@/lib/services/system.service";
import * as storageRepo from "@/lib/repo/storage.repo";
import { STORAGE_CAP_BYTES } from "@/lib/constants";

const mockRepo = storageRepo as jest.Mocked<typeof storageRepo>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getPhotoStorageUsage", () => {
  it("returns the summed bytes and the cap", async () => {
    mockRepo.sumPhotoStorageBytes.mockResolvedValue(121_634_816 as never);

    await expect(getPhotoStorageUsage()).resolves.toEqual({
      bytes: 121_634_816,
      capBytes: STORAGE_CAP_BYTES,
    });
  });

  it("reports zero usage as zero, not as unavailable", async () => {
    mockRepo.sumPhotoStorageBytes.mockResolvedValue(0 as never);

    const usage = await getPhotoStorageUsage();

    expect(usage.bytes).toBe(0);
  });

  it("reports null — not zero — when the read fails", async () => {
    mockRepo.sumPhotoStorageBytes.mockRejectedValue(
      new Error("relation does not exist") as never,
    );

    const usage = await getPhotoStorageUsage();

    // Zero would render as a reassuring "0 MB used"; null renders as
    // "Unavailable", which is the truth.
    expect(usage.bytes).toBeNull();
    expect(usage.capBytes).toBe(STORAGE_CAP_BYTES);
  });
});
