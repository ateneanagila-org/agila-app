# Sync Quota Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate Sheets API quota errors on the cron path, wire reverse-sync into the cron, and make transient API failures self-healing instead of triggering auto-freeze.

**Architecture:** Introduce a single wrapped Sheets client that enforces 1.2s pacing + 429/5xx exponential-backoff retry across all callers. Add a shared "read all region states once per cron tick" helper that photo-import and reverse-sync both consume. Restructure `syncAllPendingRegions` to orchestrate the shared read → photo-import → reverse-sync → forward-sync → summary regen pipeline. Delete dead `syncRegion` / `reverseSyncRegion` (public wrapper) code.

**Tech Stack:** TypeScript, Next.js App Router server actions, Drizzle ORM, `googleapis` SDK, Jest (sparingly), pnpm.

**Related docs:**
- Spec: `docs/superpowers/specs/2026-05-25-sync-quota-hardening-design.md`
- Overview: `docs/superpowers/specs/2026-05-25-sync-quota-hardening-overview.md`
- Testing & rollout: `docs/superpowers/specs/2026-05-25-sync-quota-hardening-testing-rollout.md`

**Branch:** `feature/api-limits-fix` (already checked out)

**Verification convention:** Per CLAUDE.md, do NOT run `pnpm dev`. Verify with `pnpm tsc --noEmit` after type-affecting changes and `pnpm build` at the end. Focused Jest unit test only for the pacing/retry wrapper (pure logic).

---

## File Structure

**New files:**
- `lib/services/sheets-client.service.ts` — wrapped Sheets v4 client (pacing + retry)
- `tests/services/sheets-client.test.ts` — unit test for pacing + retry behavior

**Modified files:**
- `lib/services/helper.service.ts`
  - `connectToSheets` returns wrapped client
  - `SheetRow` gains `rowIndex: number`
  - `readSheetState` populates `rowIndex`
  - New `readAllRegionSheetStates(regions)`
  - `clearSheetEditTimestamps` adds positional overload
- `lib/services/photo-import.service.ts`
  - `importPhotosIfNeeded` accepts optional pre-read state
  - Uses positional `clearSheetEditTimestamps`
- `lib/services/reverse-sync.service.ts`
  - New `reverseSyncRegionsFromState`
  - Delete public `reverseSyncRegion` wrapper
  - Refactor `fullReverseSync` to use shared read
  - Use positional `clearSheetEditTimestamps`
- `app/actions/google-sheets.ts`
  - Delete dead `syncRegion`
  - Restructure `syncAllPendingRegions`
- `app/actions/system.ts`
  - Add `export const maxDuration = 120`

---

## Task 1: Create wrapped Sheets client (pacing + retry)

**Files:**
- Create: `lib/services/sheets-client.service.ts`
- Test: `tests/services/sheets-client.test.ts`

The wrapper exposes the same method shape as `google.sheets({version:"v4"}).spreadsheets`, but routes every call through a pacing chain (≥1200ms between starts) and retry-on-429/5xx logic (1s/2s/4s exponential backoff, max 3 retries).

- [ ] **Step 1: Create the wrapper module skeleton**

Create `lib/services/sheets-client.service.ts`:

```ts
import { google, sheets_v4 } from "googleapis";
import { GoogleAuth } from "google-auth-library";

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

function nextPaceSlot(): Promise<void> {
  const slot = pacingChain.then(
    () => new Promise<void>((resolve) => setTimeout(resolve, PACE_MS)),
  );
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

export function wrapSheetsClient(
  raw: sheets_v4.Sheets,
): WrappedSheetsClient {
  const values = raw.spreadsheets.values;
  const spreadsheets = raw.spreadsheets;
  return {
    spreadsheets: {
      get: ((params, options) =>
        pacedCall("spreadsheets.get", () =>
          spreadsheets.get(params, options),
        )) as sheets_v4.Resource$Spreadsheets["get"],
      batchUpdate: ((params, options) =>
        pacedCall("spreadsheets.batchUpdate", () =>
          spreadsheets.batchUpdate(params, options),
        )) as sheets_v4.Resource$Spreadsheets["batchUpdate"],
      values: {
        get: ((params, options) =>
          pacedCall("values.get", () =>
            values.get(params, options),
          )) as sheets_v4.Resource$Spreadsheets$Values["get"],
        batchGet: ((params, options) =>
          pacedCall("values.batchGet", () =>
            values.batchGet(params, options),
          )) as sheets_v4.Resource$Spreadsheets$Values["batchGet"],
        update: ((params, options) =>
          pacedCall("values.update", () =>
            values.update(params, options),
          )) as sheets_v4.Resource$Spreadsheets$Values["update"],
        batchUpdate: ((params, options) =>
          pacedCall("values.batchUpdate", () =>
            values.batchUpdate(params, options),
          )) as sheets_v4.Resource$Spreadsheets$Values["batchUpdate"],
        clear: ((params, options) =>
          pacedCall("values.clear", () =>
            values.clear(params, options),
          )) as sheets_v4.Resource$Spreadsheets$Values["clear"],
      },
    },
  };
}

/**
 * Test-only: reset the pacing chain between tests. Do not call from app code.
 */
export function __resetPacingForTests(): void {
  pacingChain = Promise.resolve();
}
```

- [ ] **Step 2: Type-check the new file**

Run: `pnpm tsc --noEmit`
Expected: no errors related to `sheets-client.service.ts`. If there are unrelated pre-existing errors, ignore and proceed.

- [ ] **Step 3: Write unit tests for pacing + retry**

Create `tests/services/sheets-client.test.ts`:

```ts
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

  it("paces sequential calls by at least PACE_MS", async () => {
    const get = jest.fn().mockResolvedValue({ data: {} });
    const client = wrapSheetsClient(makeFakeRaw({ get }));
    const start = Date.now();
    await client.spreadsheets.values.get({} as never);
    await client.spreadsheets.values.get({} as never);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(1200);
  }, 10_000);
});
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `pnpm test tests/services/sheets-client.test.ts`
Expected: 5 tests pass. Total runtime ~10–20s due to real pacing delays.

If Jest config doesn't resolve `@/lib/...`, the test file uses an alias that must already be configured (it is — existing tests use it). If config trouble appears, replace with relative path `../../lib/services/sheets-client.service`.

- [ ] **Step 5: Commit**

```bash
git add lib/services/sheets-client.service.ts tests/services/sheets-client.test.ts
git commit -m "feat(sync): wrapped Sheets client with pacing + 429 retry

Adds lib/services/sheets-client.service.ts wrapping the v4 client with:
- 1.2s pacing chain between calls (process-local)
- exponential backoff (1s, 2s, 4s) on 429 and 5xx, max 3 retries
- structured logging on retry and final failure

Unit tests cover retry-on-429, retry-on-5xx, no-retry-on-403,
exhaustion, and pacing enforcement.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Route `connectToSheets` through the wrapper

**Files:**
- Modify: `lib/services/helper.service.ts:24-45`

`connectToSheets` currently returns the raw `glSheets`. Change it to wrap before returning. Call surface (`glSheets.spreadsheets.values.*`) is preserved by the wrapper, so no call sites change.

- [ ] **Step 1: Import the wrapper and rewrap the return**

Edit `lib/services/helper.service.ts`. Find:

```ts
import { google } from "googleapis";
```

Add immediately below:

```ts
import { wrapSheetsClient, type WrappedSheetsClient } from "./sheets-client.service";
```

Find the `connectToSheets` function (around line 24):

```ts
export async function connectToSheets() {
  const serviceAccountCredentials = JSON.parse(
    process.env.SERVICE_ACCOUNT_CREDENTIALS!,
  );
  const privateKey = serviceAccountCredentials.private_key.replace(
    /\\n/g,
    "\n",
  );

  const glAuth = new google.auth.GoogleAuth({
    credentials: { ...serviceAccountCredentials, private_key: privateKey },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });

  return {
    glAuth,
    glSheets: google.sheets({ version: "v4", auth: glAuth }),
  };
}
```

Replace with:

```ts
export async function connectToSheets(): Promise<{
  glAuth: InstanceType<typeof google.auth.GoogleAuth>;
  glSheets: WrappedSheetsClient;
}> {
  const serviceAccountCredentials = JSON.parse(
    process.env.SERVICE_ACCOUNT_CREDENTIALS!,
  );
  const privateKey = serviceAccountCredentials.private_key.replace(
    /\\n/g,
    "\n",
  );

  const glAuth = new google.auth.GoogleAuth({
    credentials: { ...serviceAccountCredentials, private_key: privateKey },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });

  const raw = google.sheets({ version: "v4", auth: glAuth });
  return { glAuth, glSheets: wrapSheetsClient(raw) };
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean. Some downstream type narrowing may surface — if any errors appear in files that destructure `glSheets`, see Step 3.

- [ ] **Step 3: Fix any caller type fallout (if Step 2 produced errors)**

Most callers do `const { glAuth, glSheets } = await connectToSheets();` and then call `glSheets.spreadsheets.values.*` — those work unchanged because `WrappedSheetsClient` has the same shape.

If a caller passes `glSheets` to a helper expecting `ReturnType<typeof google.sheets>`, change that helper's parameter type to `WrappedSheetsClient` (import from `./sheets-client.service`).

If a caller does `glSheets.spreadsheets.developerMetadata.*` or any property NOT in `WrappedSheetsClient`, that call site needs to be reviewed — none should exist (audit during Task 9), but if it does, add that method to the wrapper interface and `wrapSheetsClient` function in Task 1's file before continuing.

- [ ] **Step 4: Re-run type check**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add lib/services/helper.service.ts
git commit -m "feat(sync): route connectToSheets through wrapped client

All Sheets API calls now go through the paced/retrying wrapper.
Call surface unchanged (WrappedSheetsClient preserves method shape).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Add `rowIndex` to `SheetRow` and create `readAllRegionSheetStates`

**Files:**
- Modify: `lib/services/helper.service.ts` (around the `SheetRow` interface and `readSheetState` function, ~line 1057–1087)

`SheetRow` gains a `rowIndex: number` field (1-based sheet row position). `readSheetState` populates it. New `readAllRegionSheetStates(regions)` does one paced read per region and returns `Map<regionId, SheetRow[]>`.

- [ ] **Step 1: Find the `SheetRow` interface**

Run: `grep -n "interface SheetRow\|export interface SheetRow\|type SheetRow" lib/services/helper.service.ts`

It should be declared near `readSheetState`. The interface currently has:

```ts
export interface SheetRow {
  raw: string[];
  entityId: string;
  lastEditedAt: string | null;
  editedBy: string | null;
}
```

(Exact location: search the file.)

- [ ] **Step 2: Add `rowIndex` field**

Replace with:

```ts
export interface SheetRow {
  raw: string[];
  entityId: string;
  lastEditedAt: string | null;
  editedBy: string | null;
  /** 1-based sheet row position (data starts at row 3, so first data row is 3) */
  rowIndex: number;
}
```

- [ ] **Step 3: Populate `rowIndex` in `readSheetState`**

Find `readSheetState` (around line 1061). The current map step:

```ts
return rows
  .filter((row) => row[24] && String(row[24]).trim() !== "") // require UUID in col Y
  .map((row) => ({
    raw: row as string[],
    entityId: String(row[24]).trim(), // col Y UUID
    lastEditedAt: row[22] ? String(row[22]).trim() : null, // col W
    editedBy: row[23] ? String(row[23]).trim() : null, // col X
  }));
```

Replace with (note: data range is `A3:Y`, so array index `i` maps to sheet row `i + 3`):

```ts
return rows
  .map((row, i) => ({ row, rowIndex: i + 3 })) // capture position BEFORE filtering
  .filter(({ row }) => row[24] && String(row[24]).trim() !== "")
  .map(({ row, rowIndex }) => ({
    raw: row as string[],
    entityId: String(row[24]).trim(),
    lastEditedAt: row[22] ? String(row[22]).trim() : null,
    editedBy: row[23] ? String(row[23]).trim() : null,
    rowIndex,
  }));
```

- [ ] **Step 4: Add `readAllRegionSheetStates`**

Immediately after `readSheetState` (still in `lib/services/helper.service.ts`), add:

```ts
/**
 * Reads sheet state for every region in one paced pass. The wrapped client
 * spaces calls automatically, so for N regions this takes roughly N * 1.2s.
 *
 * Per-region failures (after the wrapper's retries are exhausted) are logged
 * and the region maps to an empty array — the cron should make progress on
 * healthy regions even if one is broken.
 */
export async function readAllRegionSheetStates(
  regionList: { id: string; name: string }[],
): Promise<Map<string, SheetRow[]>> {
  const result = new Map<string, SheetRow[]>();
  for (const region of regionList) {
    try {
      const rows = await readSheetState(region.id);
      result.set(region.id, rows);
    } catch (error) {
      console.error(
        `[ReadAllRegionSheetStates] region ${region.name} (${region.id}) failed:`,
        error instanceof Error ? error.message : error,
      );
      result.set(region.id, []);
    }
  }
  return result;
}
```

- [ ] **Step 5: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean. If any existing constructor of `SheetRow` (e.g. test fixtures) breaks because it lacks `rowIndex`, fix those call sites by adding a `rowIndex` value.

- [ ] **Step 6: Commit**

```bash
git add lib/services/helper.service.ts
git commit -m "feat(sync): add rowIndex to SheetRow + readAllRegionSheetStates

SheetRow now carries the 1-based sheet row position so downstream
callers can write back to specific rows without re-reading the
spreadsheet. New readAllRegionSheetStates(regions) does one paced
read per region for shared consumption across cron phases.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Positional overload for `clearSheetEditTimestamps`

**Files:**
- Modify: `lib/services/helper.service.ts:1093-1136`

Add a second signature accepting `Array<{entityId, rowIndex}>` so callers with positions don't re-read col Y. Keep the existing string-array signature for paths without positions.

- [ ] **Step 1: Replace `clearSheetEditTimestamps` with overloads**

Find the existing function (around line 1093). Replace the entire function body with:

```ts
/**
 * Clears the last_edited_at (col W) and edited_by (col X) for specific rows
 * after successful reverse sync / photo import. Prevents re-importing the
 * same edits.
 *
 * Two call shapes:
 *   - With known row positions (from a shared readSheetState pass): no
 *     additional Sheets read needed.
 *   - With only entity IDs (legacy / standalone paths): one extra read of
 *     col Y to locate row positions.
 */
export async function clearSheetEditTimestamps(
  regionId: string,
  entityIds: string[],
): Promise<void>;
export async function clearSheetEditTimestamps(
  regionId: string,
  entries: Array<{ entityId: string; rowIndex: number }>,
): Promise<void>;
export async function clearSheetEditTimestamps(
  regionId: string,
  arg: string[] | Array<{ entityId: string; rowIndex: number }>,
): Promise<void> {
  if (arg.length === 0) return;

  const region = await db.query.regions.findFirst({
    where: eq(regions.id, regionId),
  });
  if (!region) return;

  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;

  // Normalize input to positional entries
  let positional: Array<{ rowIndex: number }>;
  if (typeof arg[0] === "string") {
    // Legacy path — must read col Y to find positions
    const response = await glSheets.spreadsheets.values.get({
      auth: glAuth,
      spreadsheetId,
      range: `'${region.name}'!Y3:Y`,
    });
    const uuidColumn = response.data.values || [];
    positional = [];
    for (const entityId of arg as string[]) {
      const rowIdx = uuidColumn.findIndex(
        (row) => String(row[0] ?? "").trim() === entityId,
      );
      if (rowIdx === -1) continue;
      positional.push({ rowIndex: rowIdx + 3 });
    }
  } else {
    positional = (arg as Array<{ entityId: string; rowIndex: number }>).map(
      (e) => ({ rowIndex: e.rowIndex }),
    );
  }

  if (positional.length === 0) return;

  const requests = positional.map((p) => ({
    range: `'${region.name}'!W${p.rowIndex}:X${p.rowIndex}`,
    values: [["", ""]],
  }));

  await glSheets.spreadsheets.values.batchUpdate({
    auth: glAuth,
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data: requests },
  });
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean. Existing callers passing `string[]` continue to match the first overload.

- [ ] **Step 3: Commit**

```bash
git add lib/services/helper.service.ts
git commit -m "feat(sync): positional overload for clearSheetEditTimestamps

Callers with row positions (from a shared readSheetState pass) can
now skip the col-Y re-read by passing Array<{entityId, rowIndex}>.
String-array signature retained for legacy paths.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Photo-import accepts shared state and uses positional clears

**Files:**
- Modify: `lib/services/photo-import.service.ts` (specifically `importPhotosIfNeeded`, ~line 389–457)

Add an optional second parameter `sheetStates?: Map<string, SheetRow[]>`. When provided, skip internal `readSheetState` loop and use the map. Capture `rowIndex` per imported cat and pass positional entries to `clearSheetEditTimestamps`.

- [ ] **Step 1: Update the `SheetRow` import (if not already imported)**

At the top of `lib/services/photo-import.service.ts`, the import from `./helper.service` should include `SheetRow` (it likely already does — confirm by reading line 8-12 of the file). If missing, add it:

```ts
import {
  connectToSheets,
  readSheetState,
  refreshCatInSyncQueue,
  clearSheetEditTimestamps,
  type SheetRow,
} from "./helper.service";
```

- [ ] **Step 2: Rewrite `importPhotosIfNeeded` signature and body**

Find `importPhotosIfNeeded` (around line 389). Replace the entire function with:

```ts
/**
 * Phase 1 of the sync cycle. Called once per cycle.
 *
 * Reads sheet state for each region (same data reverse sync needs) and
 * identifies candidate rows: lastEditedAt is set AND col B is "".
 * Only fires the xlsx export when candidates exist.
 *
 * If `sheetStates` is provided (typical cron path), skips internal reads
 * and uses the pre-read map. Otherwise reads each region itself.
 *
 * Known limitation: cats whose pasted photo predates the lastEditedAt
 * tracking system require the bulk script (scripts/import-photos.ts).
 */
export async function importPhotosIfNeeded(
  allRegions: { id: string; name: string }[],
  sheetStates?: Map<string, SheetRow[]>,
): Promise<PhotoImportResult> {
  const candidateUuids = new Set<string>();
  const uuidToRegion = new Map<string, string>();
  const uuidToRowIndex = new Map<string, number>();

  for (const region of allRegions) {
    const rows = sheetStates?.get(region.id) ?? (await readSheetState(region.id));
    for (const row of rows) {
      if (row.lastEditedAt && (row.raw[1] ?? "").trim() === "") {
        candidateUuids.add(row.entityId);
        uuidToRegion.set(row.entityId, region.id);
        uuidToRowIndex.set(row.entityId, row.rowIndex);
      }
    }
  }

  if (candidateUuids.size === 0) {
    return { triggered: false, imported: 0, errors: [] };
  }

  const regionIdToName = new Map(allRegions.map((r) => [r.id, r.name]));
  const regionNamesWithCandidates = new Set<string>();
  for (const regionId of uuidToRegion.values()) {
    const name = regionIdToName.get(regionId);
    if (name) regionNamesWithCandidates.add(name);
  }
  const regionNamesToScan = allRegions
    .map((r) => r.name)
    .filter((n) => regionNamesWithCandidates.has(n));

  const photoMap = await fetchPhotosFromXlsx(candidateUuids, regionNamesToScan);

  if (photoMap.size === 0) {
    return { triggered: true, imported: 0, errors: [] };
  }

  const supabase = await createAdminClient();
  const entries = [...photoMap.entries()];
  const { imported, errors } = await processBatch(entries, supabase);

  // Clear edit timestamps for successfully imported cats so the next cycle
  // doesn't re-detect them. Pass positional entries to skip the col-Y re-read.
  const erroredIds = new Set(errors.map((e) => e.catId));
  const importedByRegion = new Map<
    string,
    Array<{ entityId: string; rowIndex: number }>
  >();
  for (const [uuid] of entries) {
    if (erroredIds.has(uuid)) continue;
    const regionId = uuidToRegion.get(uuid);
    const rowIndex = uuidToRowIndex.get(uuid);
    if (!regionId || rowIndex === undefined) continue;
    if (!importedByRegion.has(regionId)) importedByRegion.set(regionId, []);
    importedByRegion.get(regionId)!.push({ entityId: uuid, rowIndex });
  }
  for (const [regionId, posEntries] of importedByRegion) {
    try {
      await clearSheetEditTimestamps(regionId, posEntries);
    } catch (err) {
      console.error(
        `[PhotoImport] Failed to clear timestamps for region ${regionId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(
    `[PhotoImport] triggered=true candidates=${candidateUuids.size} found=${photoMap.size} imported=${imported} errors=${errors.length}`,
    errors.length > 0 ? errors.slice(0, 5) : "",
  );

  return { triggered: true, imported, errors };
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add lib/services/photo-import.service.ts
git commit -m "feat(sync): photo-import consumes shared sheet state

importPhotosIfNeeded accepts an optional Map<regionId, SheetRow[]>
so the cron can supply pre-read state and skip the per-region read
loop. Imported cats now carry rowIndex into clearSheetEditTimestamps,
eliminating the post-import col-Y re-read.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Reverse-sync from shared state; refactor `fullReverseSync`; delete dead wrapper

**Files:**
- Modify: `lib/services/reverse-sync.service.ts`

Add `reverseSyncRegionsFromState(sheetStates)` that runs the existing per-row import logic over regions where any row has `lastEditedAt`. Refactor `fullReverseSync` to call `readAllRegionSheetStates` once internally. Delete the now-unused public `reverseSyncRegion`.

- [ ] **Step 1: Refactor `reverseSyncRegionInternal` to accept pre-read rows**

Find `reverseSyncRegionInternal` (around line 42). Currently it calls `readSheetState(regionId)` inside. Change the signature to accept optional pre-read rows so callers with shared state don't re-read.

Find the existing declaration:

```ts
async function reverseSyncRegionInternal(
  regionId: string,
  force = false,
): Promise<ReverseSyncResult> {
```

Replace with:

```ts
async function reverseSyncRegionInternal(
  regionId: string,
  force = false,
  preReadRows?: SheetRow[],
): Promise<ReverseSyncResult> {
```

Then find the existing read block inside the function:

```ts
let sheetRows: SheetRow[];
try {
  sheetRows = await readSheetState(regionId);
} catch (error) {
  const msg = error instanceof Error ? error.message : "Failed to read sheet";
  await db.insert(syncAuditLog).values({
    regionId,
    direction: "REVERSE",
    tasksProcessed: 0,
    tasksFailed: 0,
    errorMessage: msg,
    startedAt,
    completedAt: new Date(),
  });
  throw error;
}
```

Replace with:

```ts
let sheetRows: SheetRow[];
if (preReadRows) {
  sheetRows = preReadRows;
} else {
  try {
    sheetRows = await readSheetState(regionId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to read sheet";
    await db.insert(syncAuditLog).values({
      regionId,
      direction: "REVERSE",
      tasksProcessed: 0,
      tasksFailed: 0,
      errorMessage: msg,
      startedAt,
      completedAt: new Date(),
    });
    throw error;
  }
}
```

Now find the existing `clearSheetEditTimestamps` call at the bottom of the function (around line 213):

```ts
// Clear GSheet timestamps for successfully imported rows
// so they won't be re-imported on the next cycle
try {
  await clearSheetEditTimestamps(regionId, importedIds);
} catch (error) {
  console.error(
    `[ReverseSync] Failed to clear timestamps for region ${regionId}:`,
    error instanceof Error ? error.message : error,
  );
  // Non-fatal — worst case is re-importing the same edit next cycle (idempotent)
}
```

Replace with (note: `importedIds` is the current array of entity IDs; we now also need positions from `sheetRows`):

```ts
// Clear GSheet timestamps for successfully imported rows
// so they won't be re-imported on the next cycle.
// Pass positional entries to skip the col-Y re-read.
try {
  const rowByEntity = new Map(sheetRows.map((r) => [r.entityId, r.rowIndex]));
  const positionalEntries: Array<{ entityId: string; rowIndex: number }> = [];
  for (const entityId of importedIds) {
    const rowIndex = rowByEntity.get(entityId);
    if (rowIndex !== undefined) {
      positionalEntries.push({ entityId, rowIndex });
    }
  }
  if (positionalEntries.length > 0) {
    await clearSheetEditTimestamps(regionId, positionalEntries);
  }
} catch (error) {
  console.error(
    `[ReverseSync] Failed to clear timestamps for region ${regionId}:`,
    error instanceof Error ? error.message : error,
  );
  // Non-fatal — worst case is re-importing the same edit next cycle (idempotent)
}
```

- [ ] **Step 2: Add `reverseSyncRegionsFromState`**

Add this new exported function in `lib/services/reverse-sync.service.ts`, after the existing `reverseSyncRegionInternal` and before `fullReverseSync`:

```ts
/**
 * Cron-path reverse sync. Iterates regions where any row has a non-empty
 * lastEditedAt (col W) — skips regions with no manual edits entirely.
 * Uses pre-read sheet states to avoid re-reading per region.
 *
 * Checks the freeze flag once at the top; if frozen, no-ops the whole pass.
 */
export async function reverseSyncRegionsFromState(
  sheetStates: Map<string, SheetRow[]>,
): Promise<{ regionsProcessed: number; totalImported: number; totalErrors: number }> {
  const frozen = await isSyncFrozen();
  if (frozen) {
    console.log("[ReverseSync] Frozen — skipping all regions");
    return { regionsProcessed: 0, totalImported: 0, totalErrors: 0 };
  }

  let regionsProcessed = 0;
  let totalImported = 0;
  let totalErrors = 0;

  for (const [regionId, rows] of sheetStates) {
    const hasEdits = rows.some((r) => r.lastEditedAt);
    if (!hasEdits) continue;

    try {
      const result = await reverseSyncRegionInternal(regionId, false, rows);
      regionsProcessed++;
      totalImported += result.imported;
      totalErrors += result.errors.length;
    } catch (error) {
      console.error(
        `[ReverseSync] Region ${regionId} failed:`,
        error instanceof Error ? error.message : error,
      );
      totalErrors++;
    }
  }

  return { regionsProcessed, totalImported, totalErrors };
}
```

- [ ] **Step 3: Delete the public `reverseSyncRegion` wrapper**

Find this block (around line 239–252):

```ts
/**
 * Public reverse sync for a single region — checks freeze flag first.
 * Called by the normal cron cycle.
 */
export async function reverseSyncRegion(
  regionId: string,
): Promise<ReverseSyncResult> {
  const frozen = await isSyncFrozen();
  if (frozen) {
    console.log(`[ReverseSync] Frozen — skipping region ${regionId}`);
    return { imported: 0, skipped: 0, errors: [] };
  }
  return reverseSyncRegionInternal(regionId);
}
```

**Delete the entire block.** Its only consumer is the dead `syncRegion` in `app/actions/google-sheets.ts`, which we delete in Task 7.

- [ ] **Step 4: Refactor `fullReverseSync` to share reads**

Find `fullReverseSync` (around line 263). Replace the entire function with:

```ts
/**
 * Full reverse sync for ALL regions. Used during unfreeze recovery.
 * Bypasses the freeze check since it's called explicitly during recovery.
 *
 * Does NOT discard PENDING forward sync tasks — those are still valid
 * for cats that managers didn't touch during the freeze.
 * importSheetRowToDB's conflict resolution cancels PENDING tasks only
 * for cats where a newer GSheet edit was imported.
 *
 * Uses one shared read pass for all regions to minimize API calls.
 */
export async function fullReverseSync(force = false): Promise<{
  regions: number;
  totalImported: number;
  totalErrors: number;
  allErrors: Array<{ region: string; entityId: string; error: string }>;
}> {
  const allRegions = await db.query.regions.findMany();
  const sheetStates = await readAllRegionSheetStates(allRegions);

  let totalImported = 0;
  let totalErrors = 0;
  const allErrors: Array<{ region: string; entityId: string; error: string }> = [];

  for (const region of allRegions) {
    const rows = sheetStates.get(region.id) ?? [];
    try {
      const result = await reverseSyncRegionInternal(region.id, force, rows);
      totalImported += result.imported;
      totalErrors += result.errors.length;
      for (const e of result.errors) {
        allErrors.push({ region: region.name, ...e });
      }
    } catch (error) {
      console.error(
        `[FullReverseSync] Region ${region.id} failed:`,
        error instanceof Error ? error.message : error,
      );
      totalErrors++;
    }
  }

  return { regions: allRegions.length, totalImported, totalErrors, allErrors };
}
```

- [ ] **Step 5: Add the new import for `readAllRegionSheetStates`**

At the top of `lib/services/reverse-sync.service.ts`, find the import from `./helper.service` (around line 10):

```ts
import {
  readSheetState,
  SheetRow,
  clearSheetEditTimestamps,
  refreshCatInSyncQueue,
} from "./helper.service";
```

Replace with:

```ts
import {
  readSheetState,
  readAllRegionSheetStates,
  SheetRow,
  clearSheetEditTimestamps,
  refreshCatInSyncQueue,
} from "./helper.service";
```

- [ ] **Step 6: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add lib/services/reverse-sync.service.ts
git commit -m "feat(sync): reverse-sync uses shared state; delete dead wrapper

Adds reverseSyncRegionsFromState(sheetStates) for the cron path —
iterates only regions with non-empty col W and uses pre-read rows.
reverseSyncRegionInternal accepts an optional preReadRows arg to
skip per-region reads. fullReverseSync now does one shared read pass.
Deletes the public reverseSyncRegion wrapper (only consumer was the
dead syncRegion, removed in the next commit).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Restructure cron path; delete dead `syncRegion`

**Files:**
- Modify: `app/actions/google-sheets.ts`

Delete `syncRegion`. Restructure `syncAllPendingRegions` to do one shared read, then orchestrate photo-import → reverse-sync-from-state → forward-sync per pending → summary regen. Photo-import errors alert Discord without freezing.

- [ ] **Step 1: Replace the entire file**

The file is small and the changes are pervasive. Replace `app/actions/google-sheets.ts` contents with:

```ts
"use server";
import { db } from "@/lib/db";
import { gsheetSyncQueue } from "@/lib/db/schema";
import {
  syncAndCompactRegion,
  generateForRiSheet,
  generateForFaSheet,
  readAllRegionSheetStates,
} from "@/lib/services/helper.service";
import { reverseSyncRegionsFromState } from "@/lib/services/reverse-sync.service";
import { importPhotosIfNeeded } from "@/lib/services/photo-import.service";
import { sendSyncAlert } from "@/lib/services/discord.service";
import { eq } from "drizzle-orm";

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function syncAllPendingRegions() {
  const allRegions = await db.query.regions.findMany();

  // Phase 0: One paced read pass shared by photo-import and reverse-sync.
  const sheetStates = await readAllRegionSheetStates(allRegions);

  // Phase 1: Photo import — detect pasted images. Non-fatal; alert on failure
  // but do not freeze. Photos are non-critical and quota errors are already
  // handled by the wrapper's retry logic.
  try {
    await importPhotosIfNeeded(allRegions, sheetStates);
  } catch (error) {
    const msg = errMsg(error);
    console.error("[PhotoImport] Failed:", msg);
    try {
      await sendSyncAlert(`Photo import failed (non-fatal): ${msg}`);
    } catch (alertErr) {
      console.error("[PhotoImport] Alert delivery failed:", errMsg(alertErr));
    }
  }

  // Phase 2: Reverse sync — only regions with non-empty col W. Hard errors
  // propagate to the cron route's auto-freeze.
  await reverseSyncRegionsFromState(sheetStates);

  // Phase 3: Forward sync only regions with pending tasks — sequential to stay
  // within write quota.
  const pendingTasks = await db
    .selectDistinct({ regionId: gsheetSyncQueue.regionId })
    .from(gsheetSyncQueue)
    .where(eq(gsheetSyncQueue.status, "PENDING"));
  for (const task of pendingTasks) {
    await syncAndCompactRegion(task.regionId);
  }

  // Phase 4: Regenerate summary sheets. Non-fatal — purely cosmetic.
  try {
    await generateForRiSheet();
    await generateForFaSheet();
    console.log("[SummarySheets] For RI + For FA regenerated");
  } catch (error) {
    console.error("[SummarySheets] Failed:", errMsg(error));
  }
}
```

(The `syncRegion` function and `requireAuth` / `reverseSyncRegion` imports are intentionally absent — `syncRegion` is dead code, `requireAuth` is no longer needed since this server module is only called from the cron route which checks its own bearer token, and the single-region reverse-sync wrapper is gone.)

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean. If any other file imports `syncRegion` or `reverseSyncRegion` (the public wrapper), the type-check will surface it — fix by removing those imports / call sites.

- [ ] **Step 3: Confirm no callers of the deleted symbols remain**

Run: `grep -rn "syncRegion\b" lib/ app/ scripts/ tests/ | grep -v "syncRegionSheetNames"`
Expected: no matches (or only matches in `docs/`, which are historical).

Run: `grep -rn "reverseSyncRegion\b" lib/ app/ scripts/ tests/ | grep -v "reverseSyncRegionsFromState\|reverseSyncRegionInternal"`
Expected: no matches.

If either grep returns matches, remove the import / call site and re-run.

- [ ] **Step 4: Commit**

```bash
git add app/actions/google-sheets.ts
git commit -m "feat(sync): restructure cron path; delete dead syncRegion

syncAllPendingRegions now does one shared sheet-state read up front,
then runs photo-import (non-fatal w/ Discord alert), reverse-sync
(only regions with edits), forward-sync per pending region, and
summary regen (non-fatal). Deletes the dead syncRegion server action.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Bump `unfreezeSync` server action max duration

**Files:**
- Modify: `app/actions/system.ts`

With pacing, `fullReverseSync` for 37 regions can take ~45–90s. Default server action timeout is 300s on current Vercel, but explicitly declare it for safety and to document the expectation.

- [ ] **Step 1: Add the `maxDuration` export**

At the top of `app/actions/system.ts` (after the `"use server";` directive), add:

```ts
export const maxDuration = 120;
```

So the top of the file looks like:

```ts
"use server";

export const maxDuration = 120;

import {
  isSyncFrozen,
  setSyncFrozen,
  getSyncFreezeReason,
} from "@/lib/services/system.service";
// ... rest unchanged
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/actions/system.ts
git commit -m "feat(sync): bump unfreezeSync maxDuration to 120s

fullReverseSync with paced reads takes ~45-90s for 37 regions.
Explicit maxDuration documents the expectation and guards against
the function timing out during recovery.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: Final audit + build

**Files:**
- Read-only verification across the repo.

Confirm no raw `google.sheets()` instances escape the wrapper, no dead-code callers remain, build succeeds.

- [ ] **Step 1: Wrapper coverage audit**

Run: `grep -rn "google\.sheets(" lib/ app/ scripts/`

Expected: exactly **one** match — the line inside `connectToSheets` (`lib/services/helper.service.ts`). Every other use of Sheets goes through the wrapped client returned by `connectToSheets`.

If additional matches appear (other than test fakes or scripts), refactor them to use `connectToSheets` instead.

- [ ] **Step 2: Dead-code audit**

Run: `grep -rn "syncRegion\b" lib/ app/ scripts/ tests/ | grep -v "syncRegionSheetNames"`
Expected: no matches.

Run: `grep -rn "reverseSyncRegion\b" lib/ app/ scripts/ tests/ | grep -v "reverseSyncRegionsFromState\|reverseSyncRegionInternal"`
Expected: no matches.

- [ ] **Step 3: Full type-check + build**

Run: `pnpm tsc --noEmit`
Expected: clean.

Run: `pnpm build`
Expected: build succeeds. (This also runs Next.js's own type pass and catches App Router server-action issues.)

- [ ] **Step 4: Run the wrapper unit tests one more time**

Run: `pnpm test tests/services/sheets-client.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Final commit (only if audit prompted any fixes)**

If Steps 1–4 are clean with no edits required, skip this step.

If any fixes were made:

```bash
git add -A
git commit -m "chore(sync): post-implementation audit fixes

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Post-implementation handoff

After all tasks complete, follow `docs/superpowers/specs/2026-05-25-sync-quota-hardening-testing-rollout.md`:

1. Push `feature/api-limits-fix` and open a PR into `dev`.
2. After merge to `dev`, watch first 1–2 cron ticks in Vercel logs.
3. If clean, merge to `prod`.
4. 24h soak: confirm zero "Quota exceeded" entries in `sync_audit_log`.
5. Run the day-1 functional tests (manual edit → reverse sync verification; UI edit → forward sync verification).

The memory note `project_sync_system_docs_todo.md` triggers writing the human-readable sync overview after this ships and is verified stable.
