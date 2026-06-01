import {
  wrapSheetsClient,
  __resetPacingForTests,
  type WrappedSheetsClient,
} from "@/lib/services/sheets-client.service";

type RawSheets = Parameters<typeof wrapSheetsClient>[0];

/** Minimal raw sheets stub — only values.get is exercised by these tests. */
function rawWith(getFn: jest.Mock): RawSheets {
  return {
    spreadsheets: {
      get: jest.fn(),
      batchUpdate: jest.fn(),
      values: {
        get: getFn,
        batchGet: jest.fn(),
        update: jest.fn(),
        batchUpdate: jest.fn(),
        clear: jest.fn(),
      },
    },
  } as unknown as RawSheets;
}

function httpError(code: number): Error {
  return Object.assign(new Error(`HTTP ${code}`), { code });
}

/** Advance fake timers repeatedly so pacing waits + retry backoffs elapse. */
async function flushTimers(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await jest.advanceTimersByTimeAsync(5000);
  }
}

describe("wrapSheetsClient — pacing + retry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetPacingForTests();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves and calls the underlying fn once on success", async () => {
    const get = jest.fn().mockResolvedValue({ data: { values: [] } });
    const client: WrappedSheetsClient = wrapSheetsClient(rawWith(get));

    const p = client.spreadsheets.values.get({} as never);
    await flushTimers();

    await expect(p).resolves.toEqual({ data: { values: [] } });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 and then succeeds", async () => {
    const get = jest
      .fn()
      .mockRejectedValueOnce(httpError(429))
      .mockResolvedValueOnce({ data: { ok: true } });
    const client = wrapSheetsClient(rawWith(get));

    const p = client.spreadsheets.values.get({} as never);
    await flushTimers();

    await expect(p).resolves.toEqual({ data: { ok: true } });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("retries on 5xx", async () => {
    const get = jest
      .fn()
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce({ data: { ok: true } });
    const client = wrapSheetsClient(rawWith(get));

    const p = client.spreadsheets.values.get({} as never);
    await flushTimers();

    await expect(p).resolves.toEqual({ data: { ok: true } });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a non-retryable status (404) and rethrows immediately", async () => {
    const get = jest.fn().mockRejectedValue(httpError(404));
    const client = wrapSheetsClient(rawWith(get));

    const p = client.spreadsheets.values.get({} as never);
    p.catch(() => {}); // avoid unhandled-rejection noise
    await flushTimers();

    await expect(p).rejects.toMatchObject({ code: 404 });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("gives up after exhausting retries (1 initial + 3 retries = 4 calls)", async () => {
    const get = jest.fn().mockRejectedValue(httpError(429));
    const client = wrapSheetsClient(rawWith(get));

    const p = client.spreadsheets.values.get({} as never);
    p.catch(() => {});
    await flushTimers();

    await expect(p).rejects.toMatchObject({ code: 429 });
    expect(get).toHaveBeenCalledTimes(4);
  });

  it("reads the status from err.response.status as well as err.code", async () => {
    const get = jest
      .fn()
      .mockRejectedValueOnce({ response: { status: 429 } })
      .mockResolvedValueOnce({ data: { ok: true } });
    const client = wrapSheetsClient(rawWith(get));

    const p = client.spreadsheets.values.get({} as never);
    await flushTimers();

    await expect(p).resolves.toEqual({ data: { ok: true } });
    expect(get).toHaveBeenCalledTimes(2);
  });
});
