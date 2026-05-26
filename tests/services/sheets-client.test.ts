import {
  wrapSheetsClient,
  __resetPacingForTests,
} from "@/lib/services/sheets-client.service";
import type { sheets_v4 } from "googleapis";

function makeFakeRaw(impl: {
  get?: jest.Mock;
  update?: jest.Mock;
  batchUpdate?: jest.Mock;
}): sheets_v4.Sheets {
  const values = {
    get: impl.get ?? jest.fn(),
    batchGet: jest.fn(),
    update: impl.update ?? jest.fn(),
    batchUpdate: impl.batchUpdate ?? jest.fn(),
    clear: jest.fn(),
  };
  const spreadsheets = {
    get: jest.fn(),
    batchUpdate: jest.fn(),
    values,
  };
  return { spreadsheets } as unknown as sheets_v4.Sheets;
}

beforeEach(() => {
  __resetPacingForTests();
});

describe("wrapSheetsClient", () => {
  it("retries on 429 and eventually succeeds", async () => {
    const get = jest
      .fn()
      .mockRejectedValueOnce({ code: 429, message: "rate limited" })
      .mockResolvedValueOnce({ data: { values: [["ok"]] } });
    const client = wrapSheetsClient(makeFakeRaw({ get }));
    const result = await client.spreadsheets.values.get({} as never);
    expect((result as { data: { values: string[][] } }).data.values[0][0]).toBe("ok");
    expect(get).toHaveBeenCalledTimes(2);
  }, 15_000);

  it("retries on 5xx and eventually succeeds", async () => {
    const update = jest
      .fn()
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValueOnce({ data: {} });
    const client = wrapSheetsClient(makeFakeRaw({ update }));
    await client.spreadsheets.values.update({} as never);
    expect(update).toHaveBeenCalledTimes(2);
  }, 15_000);

  it("does NOT retry on 4xx other than 429", async () => {
    const get = jest.fn().mockRejectedValue({ code: 403, message: "forbidden" });
    const client = wrapSheetsClient(makeFakeRaw({ get }));
    await expect(
      client.spreadsheets.values.get({} as never),
    ).rejects.toMatchObject({ code: 403 });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("gives up after 3 retries on persistent 429", async () => {
    const get = jest.fn().mockRejectedValue({ code: 429 });
    const client = wrapSheetsClient(makeFakeRaw({ get }));
    await expect(
      client.spreadsheets.values.get({} as never),
    ).rejects.toMatchObject({ code: 429 });
    expect(get).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  }, 30_000);

  it("first call is immediate; second call waits ≥ PACE_MS after first start", async () => {
    const get = jest.fn().mockResolvedValue({ data: {} });
    const client = wrapSheetsClient(makeFakeRaw({ get }));

    const t0 = Date.now();
    await client.spreadsheets.values.get({} as never);
    const t1 = Date.now();
    await client.spreadsheets.values.get({} as never);
    const t2 = Date.now();

    // First call: should be effectively immediate (no pacing wait yet).
    expect(t1 - t0).toBeLessThan(200);
    // Second call: must wait ≥ PACE_MS after first call's start.
    expect(t2 - t0).toBeGreaterThanOrEqual(1200);
    // And shouldn't wait much longer than necessary.
    expect(t2 - t0).toBeLessThan(1500);
  }, 5_000);
});
