const mockExecute = jest.fn();

jest.mock("@/lib/db", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    jest.resetModules();
    mockExecute.mockReset();
  });

  it("returns 200 and healthy when the database responds", async () => {
    mockExecute.mockResolvedValue([{ "?column?": 1 }]);
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "healthy" });
  });

  it("returns 503 without leaking the database error", async () => {
    mockExecute.mockRejectedValue(
      new Error("connect ECONNREFUSED db.internal.example:5432"),
    );
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("unhealthy");
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(body)).not.toContain("db.internal.example");
  });

  it("serves a second call from cache without querying again", async () => {
    mockExecute.mockResolvedValue([{ "?column?": 1 }]);
    const { GET } = await import("@/app/api/health/route");
    await GET();
    await GET();
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("caches a failure too — a second call within the TTL stays 503 without re-querying", async () => {
    // The failure cache is the important half: without it, a persistent outage
    // lets every request through to the connection pool — exactly the flood
    // this cache exists to prevent.
    mockExecute.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const { GET } = await import("@/app/api/health/route");
    const first = await GET();
    const second = await GET();
    expect(first.status).toBe(503);
    expect(second.status).toBe(503);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("re-queries after the cache TTL expires", async () => {
    jest.useFakeTimers();
    try {
      mockExecute.mockResolvedValue([{ "?column?": 1 }]);
      const { GET } = await import("@/app/api/health/route");
      await GET();
      expect(mockExecute).toHaveBeenCalledTimes(1);

      // Still within the 10s TTL — no re-query.
      jest.advanceTimersByTime(9_999);
      await GET();
      expect(mockExecute).toHaveBeenCalledTimes(1);

      // Past the TTL — the cache must expire and re-query.
      jest.advanceTimersByTime(2);
      await GET();
      expect(mockExecute).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
