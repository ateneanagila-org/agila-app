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

import {
  getPhotoStorageUsage,
  shouldRunPhotoGc,
  markPhotoGcRun,
} from "@/lib/services/system.service";
import * as storageRepo from "@/lib/repo/storage.repo";
import * as systemRepo from "@/lib/repo/system.repo";
import { STORAGE_CAP_BYTES } from "@/lib/constants";

const mockRepo = storageRepo as jest.Mocked<typeof storageRepo>;
const mockSystemRepo = systemRepo as jest.Mocked<typeof systemRepo>;

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

describe("shouldRunPhotoGc", () => {
  const NOW = new Date("2026-08-14T12:00:00.000Z");

  it("runs when no timestamp has ever been recorded", async () => {
    mockSystemRepo.findSystemConfigByKey.mockResolvedValue(undefined as never);

    await expect(shouldRunPhotoGc(NOW)).resolves.toBe(true);
  });

  it("runs when the last sweep was over a week ago", async () => {
    mockSystemRepo.findSystemConfigByKey.mockResolvedValue({
      key: "last_photo_gc_at",
      value: "2026-08-06T12:00:00.000Z",
    } as never);

    await expect(shouldRunPhotoGc(NOW)).resolves.toBe(true);
  });

  it("skips when the last sweep was within the week", async () => {
    mockSystemRepo.findSystemConfigByKey.mockResolvedValue({
      key: "last_photo_gc_at",
      value: "2026-08-12T12:00:00.000Z",
    } as never);

    await expect(shouldRunPhotoGc(NOW)).resolves.toBe(false);
  });

  it("runs when the stored timestamp is unparseable", async () => {
    mockSystemRepo.findSystemConfigByKey.mockResolvedValue({
      key: "last_photo_gc_at",
      value: "not a date",
    } as never);

    // Better to sweep an extra time than to never sweep again because one
    // bad write poisoned the guard forever.
    await expect(shouldRunPhotoGc(NOW)).resolves.toBe(true);
  });
});

describe("markPhotoGcRun", () => {
  it("stores the timestamp as an ISO string", async () => {
    const now = new Date("2026-08-14T12:00:00.000Z");

    await markPhotoGcRun(now);

    expect(mockSystemRepo.upsertSystemConfig).toHaveBeenCalledWith(
      "last_photo_gc_at",
      "2026-08-14T12:00:00.000Z",
    );
  });
});
