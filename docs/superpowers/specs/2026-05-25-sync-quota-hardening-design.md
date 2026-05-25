# Sync Quota Hardening — Design Spec

**Date:** 2026-05-25
**Status:** Approved, awaiting implementation plan
**Related memory:** [Cron CPU Optimization](../../memory/project_cron_cpu_optimization.md), [GSheets Sync Bugs](../../memory/project_gsheets_sync_bugs.md)

## Problem

The cron path (`syncAllPendingRegions`) consistently produces Sheets API quota errors:

```
[PhotoImport] Failed: Quota exceeded for quota metric 'Read requests'
and limit 'Read requests per minute per user' of service 'sheets.googleapis.com'
```

**Root cause:** `importPhotosIfNeeded` issues one `spreadsheets.values.get` per region (37 regions) back-to-back, plus a follow-up `clearSheetEditTimestamps` read per region with imports. ~37–74 reads land within ~30–60s of a cron tick, exceeding the Sheets v4 default of **60 reads/minute/user**.

Additional issues discovered during analysis:
- Cron path does **not** call reverse sync. Public `reverseSyncRegion` and `syncRegion` are dead code (no callers anywhere in the repo).
- No retry/backoff on transient 429 or 5xx responses. A single transient error auto-freezes the entire sync.
- Photo-import errors are silently swallowed (only `console.error`), so issues hide.

## Goals

1. Eliminate quota errors on the cron path.
2. Run reverse sync on the cron (today only fires via dead code).
3. Make quota errors self-healing (retry, not auto-freeze).
4. Surface photo-import failures to Discord without freezing sync.

## Non-goals

- Adding `values.batchGet` — same quota cost (per-range), complicates retry.
- Adding a "dirty region" flag via Apps Script — out of scope.
- Changing cron interval (stays 10 min).
- Splitting service accounts for higher quota — defer.
- Fixing the 4 known sync bugs from memory — separate work.

## Architecture

Three layered changes:

1. **Sheets client wrapper** — every Sheets call routed through a single module that enforces 1.2s pacing between calls and retries 429/5xx with exponential backoff (1s, 2s, 4s; max 3 retries).
2. **Shared sheet-state read** — one paced read pass per cron tick produces `Map<regionId, SheetRow[]>` consumed by both photo-import and reverse-sync.
3. **Cron path restructure** — `syncAllPendingRegions` orchestrates: shared read → photo-import → reverse-sync (filtered to regions with non-empty col W) → forward-sync pending → summary regen.

## Components

### `lib/services/sheets-client.service.ts` (new)

Wraps `google.sheets({ version: "v4" })` and exposes the same method shape (`values.get`, `values.batchGet`, `values.update`, `values.batchUpdate`, `values.clear`, `spreadsheets.get`, `spreadsheets.batchUpdate`).

**Pacing:** module-level promise chain enforces ≥1200ms between call starts (process-local — fine because cron is single-invocation).

**Retry:** On thrown error, inspect `err.code` / `err.response?.status`.
- `429` or `5xx` → sleep `[1000, 2000, 4000][attempt]` ms then retry. Max 3 retries. On final failure, rethrow.
- `400`/`401`/`403`/`404` → rethrow immediately (bugs or config issues, not transient).

**Logging:**
- Retry: `console.warn("[Sheets] 429 on values.get region=X attempt=1/3 — backing off 1s")`
- Final failure: `console.error("[Sheets] all retries exhausted ...")`

**Migration:** `connectToSheets()` returns the wrapped client. Call surface preserved — no changes at call sites beyond what's already imported.

### `lib/services/helper.service.ts` (extend)

**New:** `readAllRegionSheetStates(regions: {id, name}[]): Promise<Map<string, SheetRow[]>>`
- One paced `values.get` per region for `'<name>'!A3:Y`.
- Returns map of all regions (missing/failed regions map to empty array).
- Per-region read failure (after retries) is logged + swallowed so the cycle makes progress on healthy regions.

**Modified:** `SheetRow` gains `rowIndex: number` (1-based sheet row position).

**Modified:** `clearSheetEditTimestamps` gains an overload:
- `clearSheetEditTimestamps(regionId, entries: Array<{entityId, rowIndex}>)` — uses positions directly, skipping the col Y re-read.
- Old `(regionId, entityIds: string[])` signature stays for paths without positions.

**Existing `readSheetState(regionId)`** — kept as an internal helper called by `readAllRegionSheetStates`. Goes through wrapped client so pacing applies.

### `lib/services/photo-import.service.ts` (modify)

`importPhotosIfNeeded(regions, sheetStates?)` — accepts optional pre-read map. If provided, skips internal per-region reads. If absent, falls back to reading itself (used by future ad-hoc paths or scripts).

Uses positional `clearSheetEditTimestamps` (entries carry `rowIndex` from the shared read).

### `lib/services/reverse-sync.service.ts` (modify)

**New:** `reverseSyncRegionsFromState(sheetStates: Map<string, SheetRow[]>)` — iterates regions where `sheetRows.some(r => r.lastEditedAt)`, runs existing per-row import logic. Uses positional `clearSheetEditTimestamps`.

**Delete:** public `reverseSyncRegion(regionId)` wrapper — only consumer was the dead `syncRegion`.

**Modify:** `fullReverseSync` — internally calls `readAllRegionSheetStates` once then iterates, matching the cron pattern. Eliminates duplicate reads during admin unfreeze.

### `app/actions/google-sheets.ts` (modify)

**Delete:** `syncRegion` — dead code (no callers).

**Restructure `syncAllPendingRegions`:**

```ts
export async function syncAllPendingRegions() {
  const allRegions = await db.query.regions.findMany();

  // Phase 0: One paced read pass
  const sheetStates = await readAllRegionSheetStates(allRegions);

  // Phase 1: Photo import (non-fatal)
  try {
    await importPhotosIfNeeded(allRegions, sheetStates);
  } catch (error) {
    await sendSyncAlert(`Photo import failed (non-fatal): ${msg(error)}`);
  }

  // Phase 2: Reverse sync (only regions with edits)
  await reverseSyncRegionsFromState(sheetStates);

  // Phase 3: Forward sync pending regions
  const pendingTasks = await db
    .selectDistinct({ regionId: gsheetSyncQueue.regionId })
    .from(gsheetSyncQueue)
    .where(eq(gsheetSyncQueue.status, "PENDING"));
  for (const task of pendingTasks) {
    await syncAndCompactRegion(task.regionId);
  }

  // Phase 4: Summary regen (non-fatal)
  try {
    await generateForRiSheet();
    await generateForFaSheet();
  } catch (error) {
    console.error("[SummarySheets] Failed:", msg(error));
  }
}
```

### `app/actions/system.ts` (modify)

Add `export const maxDuration = 120` to ensure `unfreezeSync` doesn't timeout during recovery (37 region reads × 1.2s ≈ 45–90s).

## Data flow

```
Cron route (every 10 min)
  └── after() → syncAllPendingRegions
        ├── readAllRegionSheetStates       [37 reads × 1.2s ≈ 45s]
        ├── importPhotosIfNeeded(states)   [xlsx export if candidates; uploads]
        ├── reverseSyncRegionsFromState    [only regions w/ col W; per-row DB writes]
        ├── per pending region:
        │     syncAndCompactRegion         [1 read + 1 clear + 2 writes per region]
        └── generateForRi/FaSheet          [DB-driven writes]
```

All Sheets calls go through the wrapped client (pacing + retry).

## Error / freeze policy

| Phase | Error type | Behavior |
|---|---|---|
| Any Sheets call | 429 / 5xx | Wrapper retries up to 3× with exp backoff |
| Any Sheets call | 4xx (other) | Rethrow immediately — bug or config issue |
| Photo import | Any error | Alert Discord, do not freeze (non-critical) |
| Reverse sync | Hard error after wrapper retries | Propagates → cron route catches → auto-freeze |
| Forward sync | Hard error per region | Existing behavior: per-task retry count, FAILED at 3 |
| Summary regen | Any error | Log only, do not alert, do not freeze |

Transient quota errors that the wrapper handles never reach the freeze path. Only persistent failures freeze.

## Read budget per cron tick

| Scenario | Today | After |
|---|---|---|
| Idle (no edits, no pending) | 37 reads in ~5s → **quota hit** | 37 reads paced ~45s → **under quota** |
| Active (5 regions with edits + pending) | ~47 reads in <60s → **quota hit** | ~42 reads paced ~60s → **under quota** |

Same total reads — pacing is what fixes the quota burn.

## Latency impact (verified)

| Path | Trigger | Today | After | Notes |
|---|---|---|---|---|
| `syncAllPendingRegions` | Cron `after()` background | ~30s | ~60–90s | Function timeout 300s |
| `fullReverseSync` | Admin unfreeze button | ~10s | ~45–90s | Rare recovery action; needs `maxDuration = 120` |
| Local scripts | Manual | N/A | +pacing | Irrelevant |

UI never triggers Sheets calls. UI writes go to `gsheetSyncQueue`. Cron drains the queue.

## Schema changes

None. No new env vars. No package.json changes.

## Files touched

- `lib/services/sheets-client.service.ts` — **new**
- `lib/services/helper.service.ts` — extend
- `lib/services/photo-import.service.ts` — modify signature
- `lib/services/reverse-sync.service.ts` — add func, delete dead wrapper
- `app/actions/google-sheets.ts` — restructure, delete dead `syncRegion`
- `app/actions/system.ts` — add `maxDuration`

## Open questions

None at design time. Surface during implementation if any.
