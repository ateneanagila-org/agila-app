import type { sheets_v4 } from "googleapis";

/**
 * Minimum spacing between Sheets API calls (ms).
 * Targets ~50 calls/min — comfortably under the 60 reads/min/user quota.
 */
const PACE_MS = 1200;

/**
 * Retry delays for 429 / 5xx responses (ms). Length = max retries.
 */
const RETRY_DELAYS_MS = [1000, 2000, 4000];

/**
 * Process-local pacing chain. Each call awaits the previous and posts its own
 * promise so the next call waits ≥ PACE_MS after this one's start.
 */
let pacingChain: Promise<void> = Promise.resolve();
let lastCallStartedAt = 0;

function nextPaceSlot(): Promise<void> {
  const slot = pacingChain.then(async () => {
    const elapsed = Date.now() - lastCallStartedAt;
    const wait = Math.max(0, PACE_MS - elapsed);
    if (wait > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, wait));
    }
    lastCallStartedAt = Date.now();
  });
  pacingChain = slot;
  return slot;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusOf(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as { code?: unknown; response?: { status?: unknown } };
  if (typeof e.code === "number") return e.code;
  if (typeof e.response?.status === "number") return e.response.status;
  return undefined;
}

function isRetryable(status: number | undefined): boolean {
  if (status === undefined) return false;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

async function pacedCall<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    await nextPaceSlot();
    try {
      return await fn();
    } catch (err) {
      const status = statusOf(err);
      if (!isRetryable(status) || attempt === RETRY_DELAYS_MS.length) {
        if (isRetryable(status)) {
          console.error(
            `[Sheets] all retries exhausted on ${label} (status=${status})`,
          );
        }
        throw err;
      }
      const delay = RETRY_DELAYS_MS[attempt];
      console.warn(
        `[Sheets] ${status} on ${label} attempt=${attempt + 1}/${RETRY_DELAYS_MS.length} — backing off ${delay}ms`,
      );
      await sleep(delay);
    }
  }
  // Unreachable — loop either returns or throws.
  throw new Error(`[Sheets] pacedCall fell through on ${label}`);
}

export interface WrappedSheetsClient {
  spreadsheets: {
    get: sheets_v4.Resource$Spreadsheets["get"];
    batchUpdate: sheets_v4.Resource$Spreadsheets["batchUpdate"];
    values: {
      get: sheets_v4.Resource$Spreadsheets$Values["get"];
      batchGet: sheets_v4.Resource$Spreadsheets$Values["batchGet"];
      update: sheets_v4.Resource$Spreadsheets$Values["update"];
      batchUpdate: sheets_v4.Resource$Spreadsheets$Values["batchUpdate"];
      clear: sheets_v4.Resource$Spreadsheets$Values["clear"];
    };
  };
}

function wrapMethod<TFn>(label: string, fn: TFn): TFn {
  const wrapped = (...args: unknown[]) =>
    pacedCall(label, () => (fn as unknown as (...a: unknown[]) => Promise<unknown>)(...args));
  return wrapped as unknown as TFn;
}

export function wrapSheetsClient(
  raw: sheets_v4.Sheets,
): WrappedSheetsClient {
  const values = raw.spreadsheets.values;
  const spreadsheets = raw.spreadsheets;
  return {
    spreadsheets: {
      get: wrapMethod("spreadsheets.get", spreadsheets.get.bind(spreadsheets)),
      batchUpdate: wrapMethod(
        "spreadsheets.batchUpdate",
        spreadsheets.batchUpdate.bind(spreadsheets),
      ),
      values: {
        get: wrapMethod("values.get", values.get.bind(values)),
        batchGet: wrapMethod("values.batchGet", values.batchGet.bind(values)),
        update: wrapMethod("values.update", values.update.bind(values)),
        batchUpdate: wrapMethod(
          "values.batchUpdate",
          values.batchUpdate.bind(values),
        ),
        clear: wrapMethod("values.clear", values.clear.bind(values)),
      },
    },
  };
}

/**
 * Test-only: reset the pacing chain between tests. Do not call from app code.
 */
export function __resetPacingForTests(): void {
  pacingChain = Promise.resolve();
  lastCallStartedAt = 0;
}
