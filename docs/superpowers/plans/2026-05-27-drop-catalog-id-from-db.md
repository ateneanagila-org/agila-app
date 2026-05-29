# Drop `cats.catalog_id` from DB — Sheet as Source of Truth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `cats.catalog_id` from the DB. The Google Sheet's col A becomes the sole source of truth for catalog numbers. Fixes cross-region collision bugs caused by stale DB values surviving region transfers.

**Architecture:** Forward sync stops writing catalog_id to the DB and stops overwriting col A on UPDATE. CREATE-from-app path leaves col A blank; reverse sync (or a backfill pass) assigns the next per-region number directly in the sheet. CREATE-from-sheet path no longer stores the number in DB. Summary sheets ("For RI", "For FA") read catalog numbers from the existing `readAllRegionSheetStates` snapshot instead of from DB.

**Protections:** Lock col A (catalog_id) from volunteer edits, same pattern as col Y (UUID). Service account and Apps Script can still write. Prevents garbage/duplicate numbers from reaching the sheet.

**Tech Stack:** TypeScript, Next.js App Router, Drizzle ORM, `googleapis` SDK, pnpm.

**Verification convention:** Per CLAUDE.md, do NOT run `pnpm dev`. Verify with `pnpm tsc --noEmit` after type-affecting changes and `pnpm build` at the end. Use `pnpm drizzle-kit push` for schema changes.

**Related:**
- Prior bug analysis: this conversation
- Quota budget: [[sync-quota-budget]]
- Sheet protections context: [[sheet-protections]], [[gsheets-sync-deprecated]]

---

## Design Summary

### Current state (broken)
- `cats.catalog_id text` stored in DB; never nulled on region change.
- Three generators: forward-sync (helper.service:315), reverse-sync CREATE (reverse-sync.service:78,131), bulk import (scripts/import-sheets:239).
- All correctly per-region in isolation, but DB value travels with cat across region changes → cross-region collisions.
- No DB uniqueness guard.

### Target state
- `cats.catalog_id` column removed.
- Forward sync UPDATE: writes cols B–V only, leaves col A untouched.
- Forward sync CREATE: still computes `nextCatalogId` from the region's current sheet and writes col A. Does not store in DB.
- Reverse sync CREATE: does not compute or store catalog_id. Backfill pass writes col A for any rows still empty.
- Summary regen: builds `uuid → catalog display` map from the shared snapshot; no DB read for catalog_id.
- Col A protected at sheet level.

### Quota impact
Zero added reads. Backfill writes (~1 per region with new rows) replace the existing DB-update writes that disappear. Headroom unchanged. See [[sync-quota-budget]].

### What this fixes
- Region-transfer staleness (BUG 1)
- DB > sheet drift (BUG 2)
- UNKNOWN-region propagation (BUG 3)
- Missing uniqueness guard (BUG 5, made moot)

Orthogonal: `parseCatalogId` fragility (BUG 4) — fix in same PR (see Task 7).

---

## File Structure

**Modified files:**
- `lib/db/schema.ts` — drop `catalog_id` column from `cats`.
- `lib/validation/cats.ts` — drop `.omit({ catalog_id: true })` references.
- `lib/services/catalog.service.ts` — harden `parseCatalogId`; add `buildCatalogLookup(snapshot)`.
- `lib/services/helper.service.ts`
  - `mapCatToSheetRow` / `mapUnknownCatToSheetRow` — accept `catalogDisplay` param instead of reading `cat.catalog_id`.
  - `refreshCatInSyncQueue` — pass empty col A for CREATE-from-app; pass current col A from snapshot for UPDATE.
  - `syncAndCompactRegion` — UPDATE leaves col A untouched; CREATE-from-app assigns `nextCatalogId`; no DB write of catalog_id.
  - "For RI" / "For FA" regen — consume snapshot-derived lookup.
  - New `backfillCatalogIds(regionId, snapshot, glSheets)` — fills empty col A on volunteer-created rows.
- `lib/services/reverse-sync.service.ts` — remove `maxCatalogNum` calc, remove `catalog_id` from cat insert.
- `scripts/import-sheets.ts` — remove `catalog_id` from cat insert; col A stays in sheet untouched.
- `scripts/sheet-setup.ts` (or wherever protections live) — add col A protection (`A3:A`).

**New files:** none. (`buildCatalogLookup` and `backfillCatalogIds` live in existing services.)

**Migration:**
- `pnpm drizzle-kit push` to drop the column.

---

## Task 1: Harden `parseCatalogId`

**Files:** `lib/services/catalog.service.ts`

Current implementation strips trailing letters only. Volunteer-typed values like `G3-1`, `ARETE 5`, `#7` parse to `null` and are excluded from the max → next CREATE picks a low number → collision.

- [ ] **Step 1: Rewrite `parseCatalogId` to extract the first contiguous digit run.**
  ```ts
  export function parseCatalogId(colA: string): number | null {
    const match = colA.match(/\d+/);
    if (!match) return null;
    const n = parseInt(match[0], 10);
    return isNaN(n) ? null : n;
  }
  ```
- [ ] **Step 2: Add unit cases** (if tests exist for catalog.service): `"G3-1" → 1`, `"#7m" → 7`, `"abc" → null`, `"5" → 5`, `"5m" → 5`.
- [ ] **Step 3: Verify** `pnpm tsc --noEmit`.
- [ ] **Step 4: Commit** — `feat: harden parseCatalogId to extract first digit run`.

---

## Task 2: Add `buildCatalogLookup` helper

**Files:** `lib/services/catalog.service.ts`

Summary regen needs `uuid → "5m"` style display strings without DB access. Build once per snapshot.

- [ ] **Step 1: Add helper.**
  ```ts
  // snapshot: regionId → SheetRow[]
  export function buildCatalogLookup(
    snapshot: Map<string, SheetRow[]>,
  ): Map<string, string> {
    const out = new Map<string, string>();
    for (const rows of snapshot.values()) {
      for (const r of rows) {
        const uuid = r.entityId;
        const colA = String(r.raw[0] ?? "").trim();
        if (uuid && colA) out.set(uuid, colA);
      }
    }
    return out;
  }
  ```
- [ ] **Step 2: Verify** `pnpm tsc --noEmit`.
- [ ] **Step 3: Commit** — `feat: add buildCatalogLookup for snapshot-based summary regen`.

---

## Task 3: Refactor `mapCatToSheetRow` to take catalog display as param

**Files:** `lib/services/helper.service.ts`

Decouple row mapping from `cat.catalog_id`. Caller provides the value (from sheet snapshot or empty).

- [ ] **Step 1: Add `catalogDisplay: string` parameter** to `mapCatToSheetRow` and `mapUnknownCatToSheetRow`. Replace internal `cat.catalog_id` access with the param. Empty string acceptable.
- [ ] **Step 2: Update all callers** to pass `""` for app-created cats or the existing col A value for updates.
- [ ] **Step 3: Verify** `pnpm tsc --noEmit`.
- [ ] **Step 4: Commit** — `refactor: pass catalogDisplay to row mappers instead of reading cat.catalog_id`.

---

## Task 4: Update forward sync to leave col A authoritative

**Files:** `lib/services/helper.service.ts` (`syncAndCompactRegion`)

- [ ] **Step 1: UPDATE branch** — when `idx !== -1`, preserve `currentRows[idx][0]` (existing col A) instead of overwriting with `taskPayload[0]`.
- [ ] **Step 2: CREATE branch** — when `idx === -1`:
  - Compute `nextCatalogId(currentRows.map(r => r[0] ?? ""))`.
  - Build payload with that number for col A.
  - Do NOT write `catalog_id` to DB (column is gone after Task 8 anyway).
  - Push new row to `currentRows` so subsequent iterations see the assigned number.
- [ ] **Step 3: Remove** the `await db.update(cats).set({ catalog_id: newId })` call.
- [ ] **Step 4: Verify** `pnpm tsc --noEmit`.
- [ ] **Step 5: Commit** — `refactor: forward sync no longer stores catalog_id in DB`.

---

## Task 5: Update reverse sync — remove catalog_id assignment

**Files:** `lib/services/reverse-sync.service.ts`

- [ ] **Step 1: Remove** `maxCatalogNum` calculation block (lines ~78–83).
- [ ] **Step 2: Remove** `const catalog_id = String(++maxCatalogNum);` (line ~131).
- [ ] **Step 3: Remove** `catalog_id` from the `tx.insert(cats).values({...})` call in the CREATE branch.
- [ ] **Step 4: Verify** `pnpm tsc --noEmit`.
- [ ] **Step 5: Commit** — `refactor: reverse sync no longer assigns catalog_id`.

---

## Task 6: Add `backfillCatalogIds` for volunteer-created rows

**Files:** `lib/services/helper.service.ts`

When a volunteer adds a row in the sheet, col A may be empty (if protection is on) or garbage (if not yet). On reverse-sync, after the row is matched to a cat in DB via col Y, ensure col A has a valid number.

- [ ] **Step 1: Add function.**
  ```ts
  export async function backfillCatalogIds(
    regionId: string,
    regionName: string,
    snapshot: SheetRow[],
    glSheets: SheetsClient,
    spreadsheetId: string,
  ): Promise<number> {
    const emptyRows = snapshot.filter(r => {
      const colA = String(r.raw[0] ?? "").trim();
      return !colA || parseCatalogId(colA) === null;
    });
    if (emptyRows.length === 0) return 0;

    let max = Math.max(
      0,
      ...snapshot
        .map(r => parseCatalogId(String(r.raw[0] ?? "").trim()))
        .filter((n): n is number => n !== null),
    );

    const data = emptyRows.map(r => ({
      range: `'${regionName}'!A${r.rowIndex}`,
      values: [[String(++max)]],
    }));

    await glSheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data },
    });
    return emptyRows.length;
  }
  ```
- [ ] **Step 2: Call from `reverseSyncRegionsFromState`** (after CREATEs and clears, before audit log). Pass the same snapshot already in scope. One write per region with empty rows — within quota headroom.
- [ ] **Step 3: Verify** `pnpm tsc --noEmit`.
- [ ] **Step 4: Commit** — `feat: backfill col A for volunteer-created rows during reverse sync`.

---

## Task 7: Switch summary regen to snapshot lookup

**Files:** `lib/services/helper.service.ts` ("For RI" and "For FA" regen functions)

- [ ] **Step 1: Change function signatures** to accept the snapshot (or pre-built `Map<string, string>` from `buildCatalogLookup`).
- [ ] **Step 2: Replace** `cat.catalog_id` access with a recomputed display string:
  ```ts
  const colA = lookup.get(cat.id) ?? "";
  const base = parseCatalogId(colA);
  const display = base !== null
    ? `${base}${statusSuffix(cat.cat_status)}`
    : "";
  ```
  **Why recompute (not verbatim):** sheet col A's suffix lags one cron tick when a volunteer changes `cat_status` in col F — reverse-sync writes the new status to DB in this tick, but col A's suffix isn't refreshed until forward-sync runs next tick. Verbatim would show stale "5" instead of "5m" for ~30s after every status change. Recompute uses the snapshot's number + the fresh DB status. Uses existing `parseCatalogId` + `statusSuffix` helpers — no new logic.
- [ ] **Step 3: Update callers** (`syncAllPendingRegions` etc.) to pass snapshot.
- [ ] **Step 4: Verify** `pnpm tsc --noEmit`.
- [ ] **Step 5: Commit** — `refactor: summary regen reads catalog numbers from snapshot`.

---

## Task 8: Update `refreshCatInSyncQueue` and `cats.service`

**Files:** `lib/services/helper.service.ts`, `lib/services/cats.service.ts`

- [ ] **Step 1: `refreshCatInSyncQueue`** — pass `""` (or current col A from a lookup if needed) as `catalogDisplay` to mappers. App-side enqueuers don't know catalog numbers.
- [ ] **Step 2: Verify nothing else in `cats.service` or repos depends on `catalog_id`.** Grep for `catalog_id`.
- [ ] **Step 3: Verify** `pnpm tsc --noEmit`.
- [ ] **Step 4: Commit** — `refactor: refresh queue without catalog_id reference`.

---

## Task 9: Bulk import script cleanup

**Files:** `scripts/import-sheets.ts`

- [ ] **Step 1: Remove** `maxId` calc, `catalogBase`, and `catalog_id` from the insert.
- [ ] **Step 2: Col A stays in sheet untouched** — script's job is DB seed, sheet already has the numbers.
- [ ] **Step 3: Verify** `pnpm tsc --noEmit`.
- [ ] **Step 4: Commit** — `refactor: bulk import no longer assigns catalog_id`.

---

## Task 10: Schema drop

**Files:** `lib/db/schema.ts`, `lib/validation/cats.ts`

- [ ] **Step 1: Remove** `catalog_id: text("catalog_id")` from `cats` table.
- [ ] **Step 2: Remove** `catalog_id: true` from both `.omit(...)` calls in `validation/cats.ts`.
- [ ] **Step 3: Run** `pnpm drizzle-kit push`. Confirm the drop is the only schema change.
- [ ] **Step 4: Verify** `pnpm build`.
- [ ] **Step 5: Commit** — `refactor: drop cats.catalog_id column`.

---

## Task 11: Protect col A in sheet

**Files:** wherever sheet protection setup lives (`scripts/sheet-setup.ts` or similar — confirm via grep for `addProtectedRange`).

- [ ] **Step 1: For each region sheet**, add protection on `A3:A` with editors limited to the service account email. Mirror the existing col Y / col W protection setup.
- [ ] **Step 2: Run the setup script once** against the live spreadsheet.
- [ ] **Step 3: Manual verify** — open a region sheet as a volunteer account, attempt to edit col A → blocked.
- [ ] **Step 4: Commit** — `feat: protect col A (catalog_id) from volunteer edits`.

---

## Task 12: Memory updates

- [ ] Update [[sheet-protections]] memory: col A is now also protected.
- [ ] Update [[sync-quota-budget]] memory if backfill writes shift the budget.
- [ ] Mark [[gsheets-sync-bugs]] entries 1–3 (or whichever map to catalog issues) resolved.

---

## Rollback

- Schema drop: regenerate column via `text("catalog_id")` and `pnpm drizzle-kit push`. Data lost — would need to re-derive from sheet col A via a one-shot script.
- Code changes: standard git revert per commit.
- Col A protection: remove via the same setup script with protections disabled.

Risk profile is low — sheet always holds the authoritative value, so even mid-migration the catalog numbers remain visible to users in the UI they actually use.
