# Region-Override Sync Consistency — Design

**Date:** 2026-06-03
**Status:** Approved (brainstorm) → ready for implementation plan

## Problem

A cat's region is resolved as `COALESCE(cats.region_id /* manual override */, latest-session region)`.
This precedence is honored on the **app read path** (`regionSubquery`, cats.repo.ts:16) and in
force-delete orphan logic (`findCatsOnlyInRegion`, regions.repo.ts:93), but **not on the sync/sheet side**:

| Path | Current resolver | Override-aware? |
|---|---|---|
| App DB display | `regionSubquery` (cats.repo.ts:16) | yes |
| Force-delete orphan set | `findCatsOnlyInRegion` (regions.repo.ts:93) | yes |
| Sync tab routing | `findCatRegionByLatestSession` (sessions.repo.ts:71) | **no** |
| DELETE routing | `findCatRegionByLatestSession` (cats.service.ts:76) | **no** |
| Summary sheets (For RI / For FA) | inline `exists(session→region)` (helper.service.ts:552, 678) | **no** |

The override is **live and manager-triggered**: `editCat` spreads `region_id` into `updateCat`, and the
DB General tab (database-general-screen.tsx:163) plus session-approval crossref
(sessions-approval-crossref-screen.tsx:266) both write it. When a manager changes a cat's region, the app
shows the new region but sync routes the row to the **old** session-region tab — app and sheet disagree.

The override is also the de-facto **region-move** mechanism in this app (region changes happen by writing
`region_id`, not by swapping sessions).

## Goal

Make every sync/sheet path resolve a cat's region using the same override-first precedence as the app, and
handle the region **move** correctly (no duplicate rows across tabs).

## Non-goals

- **No repair pass** for pre-existing stale duplicates. We work against a mock GSheet + DB duplicate, so
  existing strays are disposable. Fix is forward-looking only.
- No schema changes (no `last_synced_region_id` column). Move detection uses an in-transaction pre/post diff.
- No change to the per-region sync-worker design.

## Design

### 1. Single override-aware resolver

Rewrite `findCatRegionByLatestSession` (sessions.repo.ts:71) **in place** and rename to `resolveCatRegion`.
It has exactly two callers, both of which want the effective region.

```
resolveCatRegion(catId, client = db):
  cat = read cats.region_id for catId
  if cat?.region_id is set:
      return findRegionById(cat.region_id, client)   // override wins
  else:
      return latest-session region (existing query, unchanged)
```

Both branches return the same full region object (id, name, …). Stays in `sessions.repo.ts` (zero import
churn). Update the two callers:
- `refreshCatInSyncQueue` (helper.service.ts:242)
- `removeCat` (cats.service.ts:76)

After this, the forward UPDATE and the DELETE both route to the **effective** region's tab.

### 2. Region-move cleanup in `editCat` (cats.service.ts:47)

Realigning routing alone would leave the cat's old-tab row orphaned → cat in two tabs. So `editCat` must
detect a move and remove the old row:

```
editCat (inside the existing transaction):
  oldRegion = resolveCatRegion(id, tx)        // BEFORE updateCat
  ...updateCat + updateCatHealthRecord...
  await refreshCatInSyncQueue(id, tx)         // queues UPDATE to NEW effective region
  newRegion = resolveCatRegion(id, tx)        // AFTER updateCat
  if oldRegion && oldRegion.id !== newRegion?.id:
      queue DELETE task → regionId = oldRegion.id, entityId = id, payload = []
```

The condition covers all cases:
- override set / changed → DELETE old, UPDATE new
- override cleared, falls back to a different session region → DELETE old, UPDATE new
- override cleared with no sessions (newRegion null) → DELETE old, no UPDATE (cat belongs nowhere)
- no move (`oldRegion.id === newRegion.id`) → nothing extra

`DELETE old` and `UPDATE new` land in two different region queues, processed on separate cron ticks. A brief
transient duplication between ticks is acceptable (eventually consistent, self-heals).

### 3. Summary sheets honor the override (tier 2)

`generateForRiSheet` (helper.service.ts:545-565) and `generateForFaSheet` (helper.service.ts:675-694) group
cats by `exists(session_cats → sessions.region_id = region.id)`. Replace that predicate with the
effective-region predicate, mirroring `regionSubquery`:

```
effectiveRegionIs(region.id) :=
    cats.region_id = region.id
 OR (cats.region_id IS NULL AND exists(session_cats → sessions.region_id = region.id))
```

- For-RI: swap the `where` `exists(...)` for `or(eq(c.region_id, region.id), and(isNull(c.region_id), exists(...)))`.
- For-FA: keep the adoptable/status conditions, swap only the region `exists(...)` for the same group.

Result: an overridden cat appears only under its override region; session-only cats (region_id null) appear
under their session region(s) exactly as before.

## Reverse-sync safety (verified, no change needed)

Reverse-sync keys purely on UUID (col Y): match `eq(cats.id, sheetRow.entityId)`; `importSheetRowToDB` writes
no `region_id`. It never infers region from which tab it read, so it cannot re-diverge the override. The only
window effect — an edit to the old-tab row before `DELETE old` runs imports that cat's own data by UUID — is
harmless and clears next tick.

## Testing

- `resolveCatRegion`: override set → returns override region; override null → returns latest-session region;
  neither → null. (Unit, mocked db.)
- `editCat` move-cleanup: override change queues a DELETE to old region + UPDATE to new; no-op when region
  unchanged; override-clear-to-null queues DELETE old and no UPDATE. (Service test, existing mock harness.)
- `removeCat`: DELETE routes to effective (override) region, not latest-session region.
- Summaries: an overridden cat is grouped under its override region, not its session region, in both For-RI
  and For-FA. (Mocked db query.)

## Files touched

- `lib/repo/sessions.repo.ts` — rewrite + rename resolver
- `lib/services/helper.service.ts` — `refreshCatInSyncQueue` caller; For-RI / For-FA predicates
- `lib/services/cats.service.ts` — `editCat` move-cleanup; `removeCat` caller
- `__tests__/…` — resolver, editCat move, removeCat, summary grouping
