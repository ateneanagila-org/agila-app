const mockIsSyncRetired = jest.fn();

jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");
  return { ...actual, after: jest.fn() };
});
jest.mock("@/lib/services/sync-cron.service", () => ({
  syncAllPendingRegions: jest.fn(),
}));
jest.mock("@/lib/services/system.service", () => ({
  isSyncRetired: (...args: unknown[]) => mockIsSyncRetired(...args),
  setSyncFrozen: jest.fn(),
  shouldRunPhotoGc: jest.fn().mockResolvedValue(false),
  markPhotoGcRun: jest.fn(),
}));
jest.mock("@/lib/services/discord.service", () => ({ sendSyncAlert: jest.fn() }));
jest.mock("@/lib/services/photo-import.service", () => ({
  reconcileCatPhotos: jest.fn(),
}));

const SECRET = "test-cron-secret";

const post = async (authorization?: string) => {
  const { POST } = await import("@/app/api/cron/sync/route");
  const { NextRequest } = await import("next/server");
  const request = new NextRequest("https://example.test/api/cron/sync", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
  return POST(request);
};

describe("POST /api/cron/sync authorization", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.resetModules();
    mockIsSyncRetired.mockReset().mockResolvedValue(true);
    process.env.CRON_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.CRON_SECRET = original;
  });

  it("rejects a missing header", async () => {
    expect((await post()).status).toBe(401);
  });

  it("rejects a wrong token", async () => {
    expect((await post("Bearer wrong-secret")).status).toBe(401);
  });

  it("rejects a correct token with the wrong scheme", async () => {
    expect((await post(SECRET)).status).toBe(401);
  });

  it("rejects a token of a different length without throwing", async () => {
    // timingSafeEqual throws on mismatched buffer lengths — the guard must
    // catch this before it reaches the comparison.
    expect((await post("Bearer short")).status).toBe(401);
  });

  it("rejects a same-length, one-character-different token", async () => {
    // Every other rejection case above differs in length from
    // "Bearer test-cron-secret" (23 bytes), so it's caught by the length
    // guard before timingSafeEqual ever runs. This one is deliberately the
    // same length so the comparison itself is what has to reject it — a
    // regression that broke timingSafeEqual (e.g. into a length check only,
    // or an always-true stub) would still pass every other test here.
    const wrongButSameLength = "Bearer test-cron-secreX";
    expect(wrongButSameLength.length).toBe(`Bearer ${SECRET}`.length);
    expect((await post(wrongButSameLength)).status).toBe(401);
  });

  it("rejects everything when CRON_SECRET is unset — fails closed", async () => {
    delete process.env.CRON_SECRET;
    expect((await post(`Bearer ${SECRET}`)).status).toBe(401);
    expect((await post()).status).toBe(401);
  });

  it("accepts the correct token", async () => {
    const res = await post(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    // Retired short-circuit keeps the test off the sync path entirely.
    await expect(res.json()).resolves.toMatchObject({ retired: true });
  });
});
