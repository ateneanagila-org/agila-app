jest.mock("@/lib/repo/system.repo", () => ({
  findSystemConfig: jest.fn(),
  findSystemConfigByKey: jest.fn(),
  upsertSystemConfig: jest.fn(),
  deleteSystemConfigKey: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  db: {
    query: { systemConfig: { findFirst: jest.fn() } },
    transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb({})),
  },
  Transaction: class {},
}));

import {
  isSyncRetired,
  setSyncRetired,
  getSyncHalt,
} from "@/lib/services/system.service";
import * as systemRepo from "@/lib/repo/system.repo";
import { db } from "@/lib/db";

const mockRepo = systemRepo as jest.Mocked<typeof systemRepo>;
const mockDb = db as unknown as {
  query: { systemConfig: { findFirst: jest.Mock } };
};

/** The legacy sync_frozen read still goes through db.query directly. */
function setFrozen(frozen: boolean) {
  mockDb.query.systemConfig.findFirst.mockResolvedValue(
    frozen ? { key: "sync_frozen", value: "true" } : undefined,
  );
}

function setRetired(retired: boolean) {
  mockRepo.findSystemConfigByKey.mockResolvedValue(
    (retired
      ? { key: "sync_retired", value: "true" }
      : undefined) as never,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  setFrozen(false);
  setRetired(false);
});

describe("isSyncRetired", () => {
  it("is false when the row is absent", async () => {
    await expect(isSyncRetired()).resolves.toBe(false);
  });

  it("is true when the row is set", async () => {
    setRetired(true);
    await expect(isSyncRetired()).resolves.toBe(true);
  });

  it("is false when the row holds anything other than \"true\"", async () => {
    mockRepo.findSystemConfigByKey.mockResolvedValue({
      key: "sync_retired",
      value: "false",
    } as never);
    await expect(isSyncRetired()).resolves.toBe(false);
  });
});

describe("fullReverseSync gating", () => {
  it("refuses to run when retired", async () => {
    setRetired(true);

    const { fullReverseSync } = await import(
      "@/lib/services/reverse-sync.service"
    );
    const result = await fullReverseSync();

    // backfillCatalogIds writes column A back to the spreadsheet, so this
    // path must be dead once retired — unfreezeSync stays callable even after
    // its button is hidden.
    expect(result).toEqual({
      regions: 0,
      totalImported: 0,
      totalErrors: 0,
      allErrors: [],
    });
  });
});

describe("setSyncRetired", () => {
  it("writes the flag under the same key isSyncRetired reads", async () => {
    await setSyncRetired();

    expect(mockRepo.upsertSystemConfig).toHaveBeenCalledWith(
      "sync_retired",
      "true",
    );
  });
});

describe("getSyncHalt", () => {
  it("returns null when neither flag is set", async () => {
    await expect(getSyncHalt()).resolves.toBeNull();
  });

  it("returns 'frozen' when only frozen", async () => {
    setFrozen(true);
    await expect(getSyncHalt()).resolves.toBe("frozen");
  });

  it("returns 'retired' when only retired", async () => {
    setRetired(true);
    await expect(getSyncHalt()).resolves.toBe("retired");
  });

  it("prefers 'retired' when both are set — retirement is terminal", async () => {
    setFrozen(true);
    setRetired(true);
    await expect(getSyncHalt()).resolves.toBe("retired");
  });
});
