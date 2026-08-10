# Sync Quota Hardening — Testing & Rollout

**Date:** 2026-05-25
**Companion to:** [Design Spec](./2026-05-25-sync-quota-hardening-design.md) · [Plain-English Overview](./2026-05-25-sync-quota-hardening-overview.md)

## Pre-merge verification (manual code review)

No dev server per project convention. Verify by reading code paths after each phase of implementation.

### Code-level checks

1. **Trace one cron tick mentally** through the new `syncAllPendingRegions`:
   - Single `readAllRegionSheetStates(allRegions)` call near the top.
   - `importPhotosIfNeeded` receives the map as second arg.
   - `reverseSyncRegionsFromState(sheetStates)` runs after photo-import.
   - `syncAndCompactRegion` runs per pending region.
   - `generateForRi/FaSheet` runs last.

2. **Wrapper coverage audit** — grep every `glSheets.spreadsheets.*` call site in the repo:
   ```
   grep -rn "glSheets\.spreadsheets" lib/ app/ scripts/
   ```
   Every result must trace back to a `connectToSheets()` call that returns the wrapped client. No raw `google.sheets()` instances escaping.

3. **Dead-code confirmation** — these symbols must have zero callers after the PR:
   ```
   grep -rn "syncRegion\b" lib/ app/ scripts/   # (excluding syncRegionSheetNames)
   grep -rn "reverseSyncRegion\b" lib/ app/ scripts/  # (the public wrapper, not Internal)
   ```
   Should return only the (now-deleted) definitions or zero results.

4. **Positional clearSheetEditTimestamps callers** — confirm:
   - `photo-import.service.ts` passes `Array<{entityId, rowIndex}>` (positions from shared read).
   - `reverse-sync.service.ts` (in `reverseSyncRegionsFromState`) passes positions.
   - Any legacy caller still using `string[]` works via the old overload.

5. **`SheetRow` shape** — `rowIndex: number` field present, populated by `readSheetState` and `readAllRegionSheetStates`.

### Type check

After each implementation phase:
```
pnpm tsc --noEmit
```

Must be clean before proceeding to the next phase.

## Post-deploy verification

### Day-1 checks (within ~1 hour of merge to `prod`)

1. **First 1–2 cron ticks**: check Vercel function logs for `/api/cron/sync`. Expected log shape:
   - No `Quota exceeded` errors.
   - May see `[Sheets] 429 ... backing off` warnings — these are healthy (wrapper handled it).
   - Cron tick duration: 60–90s active, ~45s idle.
   - If consistently > 200s, investigate (over-pacing or runaway loop).

2. **Discord channel**: confirm no spurious freeze alerts. Photo-import warnings (if any) should appear as informational, not freeze events.

3. **Audit log spot-check**:
   ```sql
   SELECT direction, status, error_message, started_at, completed_at
   FROM sync_audit_log
   WHERE started_at > NOW() - INTERVAL '1 hour'
   ORDER BY started_at DESC;
   ```
   Expect REVERSE entries (new — didn't exist before this PR). Expect no quota errors.

### Day-1 functional tests

1. **Reverse-sync end-to-end**:
   - Pick a low-traffic region (e.g. `EBAIS`).
   - Manually edit a cat's name in the Google Sheet.
   - Wait one cron cycle (~10 min).
   - Verify the DB reflects the edit (check via app or direct DB query).
   - Before this PR, this only worked when someone opened the region in the app.

2. **Photo-import smoke test** (if any pasted photos pending):
   - Pre-deploy: count cats with `photo_url IS NULL` that have edit timestamps.
   - Post-deploy after 2–3 cron cycles: confirm count went down.

3. **Forward-sync smoke test**:
   - Make a small edit in the app (e.g. cat notes).
   - Wait one cron cycle.
   - Verify the change appears in the Google Sheet.

### 24-hour soak

**Success criterion:** zero `Quota exceeded` errors in `sync_audit_log` over 24 hours.

Baseline: today's audit log shows quota errors on most active cron ticks. After this PR, that count should go to zero.

If a quota error does appear in the 24h window, it means the wrapper exhausted all 3 retries — investigate the specific call site and consider lengthening pacing.

## Rollout plan

### Single PR

The change is interdependent (wrapper + shared read + cron restructure + dead-code delete). Splitting it into multiple PRs would create intermediate states that are worse than the current code (e.g. wrapper without shared read still hits quota on idle reads).

### Branch flow

1. Implement on a feature branch off `dev`.
2. Merge to `dev` first. Let one or two cron cycles run in the dev environment if applicable; otherwise proceed cautiously.
3. Merge `dev` → `prod`.
4. Watch the first cron tick in prod logs.

### Pre-merge checklist

- [ ] `pnpm tsc --noEmit` clean
- [ ] `pnpm build` clean (catches additional issues)
- [ ] Wrapper coverage audit (no escaping raw clients)
- [ ] Dead-code deletion confirmed
- [ ] Spec doc and overview doc updated if design drifted during implementation

## Rollback plan

Single revert commit restores the old code. No schema migrations to roll back, no data changes to undo.

```
git revert <merge-commit-sha>
git push origin prod
```

If a rollback is needed, ALSO investigate the new bugs from memory ([GSheets Sync Bugs](../../memory/project_gsheets_sync_bugs.md)) since this PR was meant to be the foundation for fixing those. Rolling back delays that work.

## Known operational considerations

### Sync freeze recovery

If sync freezes for any reason during/after rollout:
1. Admin opens app, clicks "Unfreeze" button.
2. This now takes 45–90 seconds (was ~10s) — UI should show a loading state.
3. Successful unfreeze runs a full reverse sync of all 37 regions via shared-read pattern.

### Apps Script behavior unchanged

Apps Script in the spreadsheet still writes to col W (timestamp) and col X (edited by) on every manual edit. Our new reverse-sync key triggers on non-empty col W. No Apps Script changes required.

### Cloudflare Worker unchanged

The Cloudflare Worker that pings `/api/cron/sync` every 10 minutes is unchanged. Schedule: `*/10 * * * *`.

## Post-rollout follow-ups

After this ships and is verified stable, the following deferred items become possible:

- Address the 4 known sync bugs (see memory: `project_gsheets_sync_bugs.md`).
- Write the human-readable sync system overview doc (see memory: `project_sync_system_docs_todo.md`).
- Revisit cron-frequency reduction / early-exit-when-idle (memory: `project_cron_cpu_optimization.md`) — may be partially obviated by this PR's cleaner read pattern.
