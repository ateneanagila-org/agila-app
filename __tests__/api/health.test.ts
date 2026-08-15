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
});
