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
jest.mock("@/lib/services/sync-cron.service", () => ({
  syncAllPendingRegions: jest.fn(),
}));
jest.mock("@/lib/services/discord.service", () => ({
  sendSyncAlert: jest.fn(),
}));
jest.mock("@/lib/services/photo-import.service", () => ({
  reconcileCatPhotos: jest
    .fn()
    .mockResolvedValue({ scanned: 0, referenced: 0, removed: 0 }),
}));
jest.mock("next/server", () => ({
  after: (fn: () => unknown) => fn(),
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    }),
  },
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

import { POST } from "@/app/api/cron/sync/route";
import { syncAllPendingRegions } from "@/lib/services/sync-cron.service";

const mockSync = syncAllPendingRegions as jest.Mock;

/** Minimal stand-in for NextRequest — the route only reads one header. */
function req(token: string | null) {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "authorization" && token
          ? `Bearer ${token}`
          : null,
    },
  } as unknown as Parameters<typeof POST>[0];
}

describe("cron sync route", () => {
  const OLD_SECRET = process.env.CRON_SECRET;

  beforeAll(() => {
    process.env.CRON_SECRET = "test-secret";
  });
  afterAll(() => {
    process.env.CRON_SECRET = OLD_SECRET;
  });

  it("returns 401 for a bad secret EVEN WHEN retired", async () => {
    setRetired(true);

    const res = (await POST(req("wrong"))) as unknown as { status: number };

    expect(res.status).toBe(401);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("short-circuits without running sync when retired", async () => {
    setRetired(true);

    const res = (await POST(req("test-secret"))) as unknown as {
      body: { retired?: boolean };
    };

    expect(res.body.retired).toBe(true);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("runs sync when not retired", async () => {
    setRetired(false);

    await POST(req("test-secret"));

    expect(mockSync).toHaveBeenCalled();
  });
});
