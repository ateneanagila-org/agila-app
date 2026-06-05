# Forward-Sync Correctness Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop forward sync from nulling photos, fix row ordering, fix the bogus "Date Last Seen" column, fix photo-import/reverse-sync interaction, and make summary sheets see fresh catalog numbers.

**Architecture:** Forward sync (`syncAndCompactRegion`) currently rebuilds a whole region tab by echoing a *lossy* `FORMATTED_VALUE` read, which flattens `=IMAGE()` cells to `""` and re-sorts by nickname. We make DB the source of truth for the photo column, sort by catalog number, derive "Date Last Seen" from the latest census session, stop photo-import from poisoning reverse-sync's conflict check (and reorder the two), and feed forward-sync's post-write state back into the summary snapshot.

**Tech Stack:** TypeScript (strict), Next.js 16, Drizzle ORM (Postgres/Supabase), googleapis Sheets v4, Jest. Package manager: **pnpm only**.

**Verification commands (run from repo root):**
- Targeted tests: `pnpm jest __tests__/services/forward-sync.test.ts`
- Full suite: `pnpm jest __tests__`
- Types: `pnpm tsc --noEmit`

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `lib/services/helper.service.ts` | forward sync worker + mappers | A (col-B rebuild), B (sort), D (mapper col N param), G (return state) |
| `lib/repo/sessions.repo.ts` | session queries | D (latest-session-date query) |
| `lib/repo/cats.repo.ts` | cat queries | D (touchCat) |
| `lib/services/interventions.service.ts` | intervention business logic | D (bump cat timestamp) |
| `lib/services/photo-import.service.ts` | photo import | F (drop last_updated_at bump) |
| `lib/services/sync-cron.service.ts` | cron orchestration | F (reorder), G (merge snapshot) |
| `__tests__/services/forward-sync.test.ts` | forward sync tests | A, B, G test updates |
| `__tests__/services/helper-mappers.test.ts` | mapper tests | D test |
| `__tests__/repo/sessions-repo.test.ts` | new repo test | D test (create) |

---

## Task 1: A — Rebuild col B (photo) from DB in forward sync

**Files:**
- Modify: `lib/services/helper.service.ts` (sort/compact block ~L370-376; survivor rebuild)
- Test: `__tests__/services/forward-sync.test.ts`

- [ ] **Step 1: Add `findCatsByIds` default to the test setup**

In `__tests__/services/forward-sync.test.ts`, inside the top-level `beforeEach` (the one starting at ~L101 that sets `frozenMock.mockResolvedValue(false)`), add this line so the new repo call never returns `undefined`:

```typescript
  findCatsByIdsMock.mockResolvedValue([]);
```

- [ ] **Step 2: Write the failing test**

Add this test inside `describe("syncAndCompactRegion", ...)` in `__tests__/services/forward-sync.test.ts`:

```typescript
  it("preserves an untouched row's photo by rebuilding col B from DB", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    // Sheet read returns col B = "" for the photo row (=IMAGE() flattens under
    // FORMATTED_VALUE). u-photo is NOT in the task list — only u-other is.
    fakeSheets.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          row({ 0: "1", 2: "Bella", 24: "u-photo" }),
          row({ 0: "2", 2: "Max", 24: "u-other" }),
        ],
      },
    });
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([
      task({ entityId: "u-other", payload: row({ 0: "x", 2: "Max", 24: "u-other" }) }),
    ]);
    findCatsByIdsMock.mockResolvedValue([
      { id: "u-photo", photo_url: "http://p/cat.jpg" },
      { id: "u-other", photo_url: null },
    ]);

    await syncAndCompactRegion("r1");

    const dataUpdate = fakeSheets.spreadsheets.values.update.mock.calls.find(
      (c) => String(c[0].range).endsWith("!A3"),
    )!;
    const written = dataUpdate[0].requestBody.values as string[][];
    // Sorted by catalog number: u-photo (1) first, u-other (2) second.
    expect(written[0][1]).toBe('=IMAGE("http://p/cat.jpg")'); // rebuilt from DB
    expect(written[1][1]).toBe(""); // u-other has no photo
  });
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm jest __tests__/services/forward-sync.test.ts -t "preserves an untouched row's photo"`
Expected: FAIL — `written[0][1]` is `""` (the lossy echoed value), not the `=IMAGE(...)` formula.

- [ ] **Step 4: Implement the rebuild**

In `lib/services/helper.service.ts`, locate the COMPACT & SORT block (currently):

```typescript
    // 3. COMPACT & SORT by Nickname (col C, index 2)
    const finalData = currentRows
      .filter((row) => row[24] && String(row[24]).trim() !== "")
      .sort((a, b) => String(a[2] ?? "").localeCompare(String(b[2] ?? "")));

    // 4. WRITE data cols A3:V (never touch W, X â€" Apps Script owns those)
    const dataOnly = finalData.map((r) => r.slice(0, 22));
```

Insert a new block **between** the `finalData` assignment and the `// 4. WRITE` comment:

```typescript
    // 3b. Rebuild col B (photo) from DB photo_url for every surviving row.
    // The A3:Y read returns "" for =IMAGE() cells under FORMATTED_VALUE, so
    // echoing unchanged rows back would null their photos. DB owns photos.
    // Skip UNKNOWN — its col B is "Possible Location" text, not a photo.
    if (region.name !== "UNKNOWN") {
      const survivorIds = finalData
        .map((r) => String(r[24] ?? "").trim())
        .filter((id) => id !== "");
      const survivorCats = await catsRepo.findCatsByIds(survivorIds);
      const photoById = new Map(survivorCats.map((c) => [c.id, c.photo_url]));
      for (const r of finalData) {
        const url = photoById.get(String(r[24] ?? "").trim());
        r[1] = url ? `=IMAGE("${url.replace(/"/g, "")}")` : "";
      }
    }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm jest __tests__/services/forward-sync.test.ts -t "preserves an untouched row's photo"`
Expected: PASS

- [ ] **Step 6: Run the full forward-sync suite (no regressions)**

Run: `pnpm jest __tests__/services/forward-sync.test.ts`
Expected: PASS (all). The `findCatsByIdsMock.mockResolvedValue([])` default keeps the DELETE/compaction tests green.

- [ ] **Step 7: Commit**

```bash
git add lib/services/helper.service.ts __tests__/services/forward-sync.test.ts
git commit -m "fix(sync): rebuild forward-sync col B from DB photo_url to stop photo nulling"
```

---

## Task 2: B — Sort compacted rows by catalog number

**Files:**
- Modify: `lib/services/helper.service.ts` (the `finalData` sort)
- Test: `__tests__/services/forward-sync.test.ts`

- [ ] **Step 1: Update the existing tests that assert nickname order**

In `__tests__/services/forward-sync.test.ts`:

(a) Rename and keep the compaction test. Change the title from
`"compacts blank-UUID rows out and sorts the rest by nickname"` to
`"compacts blank-UUID rows out and sorts the rest by catalog number"`.
Its existing assertion `expect(uuidUpdate[0].requestBody.values).toEqual([["u1"], ["u2"]])` stays valid (u1 col A "1" < u2 col A "2").

(b) Fix the CREATE test (`"CREATE (UUID absent from sheet) assigns the next catalog number from col A"`). Replace its post-`await` assertion block:

```typescript
    const dataUpdate = fakeSheets.spreadsheets.values.update.mock.calls.find(
      (c) => String(c[0].range).endsWith("!A3"),
    )!;
    const written = dataUpdate[0].requestBody.values as string[][];
    // Sorted by name (col C): "Aaa" (new) before "Zoe" (existing).
    expect(written[0][0]).toBe("4"); // 3 + 1
    expect(written[0][2]).toBe("Aaa");
```

with:

```typescript
    const dataUpdate = fakeSheets.spreadsheets.values.update.mock.calls.find(
      (c) => String(c[0].range).endsWith("!A3"),
    )!;
    const written = dataUpdate[0].requestBody.values as string[][];
    // Sorted by catalog number: existing "3" (Zoe) before new "4" (Aaa).
    expect(written[0][0]).toBe("3");
    expect(written[1][0]).toBe("4"); // 3 + 1
    expect(written[1][2]).toBe("Aaa");
```

- [ ] **Step 2: Run those tests to verify they now fail**

Run: `pnpm jest __tests__/services/forward-sync.test.ts -t "assigns the next catalog number"`
Expected: FAIL — current code sorts by nickname, so "Aaa" is at index 0, not "3".

- [ ] **Step 3: Implement catalog-number sort**

In `lib/services/helper.service.ts`, replace the sort:

```typescript
    // 3. COMPACT & SORT by Nickname (col C, index 2)
    const finalData = currentRows
      .filter((row) => row[24] && String(row[24]).trim() !== "")
      .sort((a, b) => String(a[2] ?? "").localeCompare(String(b[2] ?? "")));
```

with:

```typescript
    // 3. COMPACT & SORT by catalog number (col A, index 0). Matches the order
    // the GSheet is kept in. Unnumbered rows sink to the bottom.
    const finalData = currentRows
      .filter((row) => row[24] && String(row[24]).trim() !== "")
      .sort((a, b) => {
        const na = parseCatalogId(String(a[0] ?? ""));
        const nb = parseCatalogId(String(b[0] ?? ""));
        if (na === null && nb === null) return 0;
        if (na === null) return 1;
        if (nb === null) return -1;
        return na - nb;
      });
```

- [ ] **Step 4: Run the forward-sync suite**

Run: `pnpm jest __tests__/services/forward-sync.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add lib/services/helper.service.ts __tests__/services/forward-sync.test.ts
git commit -m "fix(sync): sort forward-sync rows by catalog number, not nickname"
```

---

## Task 3: D (part 1) — "Date Last Seen" from latest census session

**Files:**
- Modify: `lib/repo/sessions.repo.ts` (add `findLatestSessionDateForCat`)
- Modify: `lib/services/helper.service.ts` (`mapCatToSheetRow` gains a `lastSeenDate` param; two call sites pass it)
- Test: `__tests__/services/helper-mappers.test.ts`, `__tests__/repo/sessions-repo.test.ts` (new)

- [ ] **Step 1: Write the failing mapper test**

In `__tests__/services/helper-mappers.test.ts`, add inside `describe("mapCatToSheetRow", ...)`:

```typescript
  it("col N (date last seen, index 13) uses the provided last-seen date, N/A when null", () => {
    expect(
      mapCatToSheetRow(makeCat(), null, [], "", new Date(2025, 7, 18))[13],
    ).toBe("8/18/2025");
    expect(mapCatToSheetRow(makeCat(), null)[13]).toBe("N/A");
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm jest __tests__/services/helper-mappers.test.ts -t "date last seen"`
Expected: FAIL — col N is currently `new Date().toLocaleDateString()` (today), and the mapper has no 5th param.

- [ ] **Step 3: Add the `lastSeenDate` param to `mapCatToSheetRow`**

In `lib/services/helper.service.ts`, change the signature and col N. Current:

```typescript
export function mapCatToSheetRow(
  cat: SelectCat,
  health: SelectCatHealthRecord | null,
  interventions: SelectIntervention[] = [],
  catalogDisplay = "",
): string[] {
```

to:

```typescript
export function mapCatToSheetRow(
  cat: SelectCat,
  health: SelectCatHealthRecord | null,
  interventions: SelectIntervention[] = [],
  catalogDisplay = "",
  lastSeenDate: Date | null = null,
): string[] {
```

And change col N (currently `new Date().toLocaleDateString("en-US"), // 13 (N)`):

```typescript
    lastSeenDate ? lastSeenDate.toLocaleDateString("en-US") : "N/A", // 13 (N) date last seen
```

- [ ] **Step 4: Run the mapper test to verify it passes**

Run: `pnpm jest __tests__/services/helper-mappers.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Add the repo query**

In `lib/repo/sessions.repo.ts`, add at the end of the file (the imports `eq, and, desc`, `db`, `sessions`, `sessionCats` are already present):

```typescript
/**
 * Latest *census* session date the cat appears in (via session_cats).
 * Used as the sheet's "Date Last Seen" (col N). System (anchor) sessions are
 * excluded — they are not real sightings. Returns null when the cat has no
 * census session.
 */
export async function findLatestSessionDateForCat(
  catId: string,
  client: DB = db,
): Promise<Date | null> {
  const latest = await client.query.sessions.findFirst({
    where: (s, { exists }) =>
      and(
        eq(s.is_system, false),
        exists(
          db
            .select()
            .from(sessionCats)
            .where(
              and(
                eq(sessionCats.session_id, s.id),
                eq(sessionCats.cat_id, catId),
              ),
            ),
        ),
      ),
    orderBy: [desc(sessions.created_at)],
    columns: { created_at: true },
  });
  return latest?.created_at ?? null;
}
```

- [ ] **Step 6: Write the repo test**

Create `__tests__/repo/sessions-repo.test.ts`:

```typescript
jest.mock("@/lib/db", () => {
  const findFirst = jest.fn();
  return {
    db: { query: { sessions: { findFirst } } },
    DB: class {},
  };
});

import { findLatestSessionDateForCat } from "@/lib/repo/sessions.repo";
import { db } from "@/lib/db";

const findFirst = (db as unknown as {
  query: { sessions: { findFirst: jest.Mock } };
}).query.sessions.findFirst;

beforeEach(() => findFirst.mockReset());

describe("findLatestSessionDateForCat", () => {
  it("returns the latest session's created_at", async () => {
    const d = new Date(2025, 7, 18);
    findFirst.mockResolvedValue({ created_at: d });
    await expect(findLatestSessionDateForCat("cat-1")).resolves.toBe(d);
  });

  it("returns null when the cat has no census session", async () => {
    findFirst.mockResolvedValue(undefined);
    await expect(findLatestSessionDateForCat("cat-1")).resolves.toBeNull();
  });
});
```

- [ ] **Step 7: Run the repo test**

Run: `pnpm jest __tests__/repo/sessions-repo.test.ts`
Expected: PASS.

- [ ] **Step 8: Wire `lastSeenDate` into the two `mapCatToSheetRow` call sites**

In `lib/services/helper.service.ts`, `refreshCatInSyncQueue` — current:

```typescript
  const rowData =
    region.name === "UNKNOWN"
      ? mapUnknownCatToSheetRow(cat, cat.catHealthRecords)
      : mapCatToSheetRow(cat, cat.catHealthRecords, cat.interventions);
```

becomes:

```typescript
  const lastSeenDate =
    region.name === "UNKNOWN"
      ? null
      : await sessionsRepo.findLatestSessionDateForCat(catId, tx);
  const rowData =
    region.name === "UNKNOWN"
      ? mapUnknownCatToSheetRow(cat, cat.catHealthRecords)
      : mapCatToSheetRow(cat, cat.catHealthRecords, cat.interventions, "", lastSeenDate);
```

In `syncAndCompactRegion`, the new-cat branch — current:

```typescript
          const newPayload =
            region.name === "UNKNOWN"
              ? mapUnknownCatToSheetRow(cat, health ?? null, catalogDisplay)
              : mapCatToSheetRow(
                  cat,
                  health ?? null,
                  interventionsList,
                  catalogDisplay,
                );
```

becomes:

```typescript
          const lastSeenDate =
            region.name === "UNKNOWN"
              ? null
              : await sessionsRepo.findLatestSessionDateForCat(cat.id);
          const newPayload =
            region.name === "UNKNOWN"
              ? mapUnknownCatToSheetRow(cat, health ?? null, catalogDisplay)
              : mapCatToSheetRow(
                  cat,
                  health ?? null,
                  interventionsList,
                  catalogDisplay,
                  lastSeenDate,
                );
```

(`sessionsRepo` is already imported in helper.service.ts as `import * as sessionsRepo from "@/lib/repo/sessions.repo"`.)

- [ ] **Step 9: Type-check + full suite**

Run: `pnpm tsc --noEmit` then `pnpm jest __tests__`
Expected: both PASS.

- [ ] **Step 10: Commit**

```bash
git add lib/repo/sessions.repo.ts lib/services/helper.service.ts __tests__/services/helper-mappers.test.ts __tests__/repo/sessions-repo.test.ts
git commit -m "fix(sync): derive Date Last Seen (col N) from latest census session"
```

---

## Task 4: D (part 2) — Bump `cats.last_updated_at` on intervention writes

**Files:**
- Modify: `lib/repo/cats.repo.ts` (add `touchCat`)
- Modify: `lib/services/interventions.service.ts` (call it)
- Test: `__tests__/services/forward-sync.test.ts` is unrelated; add no new heavy test — verify via tsc + existing suite. (Interventions have no dedicated service test in the suite.)

- [ ] **Step 1: Add `touchCat` to the repo**

In `lib/repo/cats.repo.ts`, add after `updateCat`:

```typescript
// Bumps only last_updated_at — used by flows (e.g. interventions) that change a
// cat's derived sheet state without editing a cats column directly, so reverse-
// sync's last-edit-wins sees the cat as freshly updated.
export const touchCat = (id: string, client: DB = db) =>
  client
    .update(cats)
    .set({ last_updated_at: new Date() })
    .where(eq(cats.id, id));
```

- [ ] **Step 2: Call `touchCat` from each intervention mutation**

In `lib/services/interventions.service.ts`, add the import and a `touchCat` call right after each `refreshCatInSyncQueue`. New import line (top, alongside existing imports):

```typescript
import * as catsRepo from "../repo/cats.repo";
```

`createIntervention` — after `await refreshCatInSyncQueue(data.cat_id, tx);` add:

```typescript
    await catsRepo.touchCat(data.cat_id, tx);
```

`editIntervention` — after `await refreshCatInSyncQueue(updated.cat_id, tx);` add:

```typescript
    await catsRepo.touchCat(updated.cat_id, tx);
```

`removeIntervention` — after `await refreshCatInSyncQueue(deleted.cat_id, tx);` add:

```typescript
    await catsRepo.touchCat(deleted.cat_id, tx);
```

- [ ] **Step 3: Type-check + full suite**

Run: `pnpm tsc --noEmit` then `pnpm jest __tests__`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/repo/cats.repo.ts lib/services/interventions.service.ts
git commit -m "fix(sync): bump cats.last_updated_at on intervention writes"
```

---

## Task 5: G — `syncAndCompactRegion` returns post-write region state

**Files:**
- Modify: `lib/services/helper.service.ts` (`syncAndCompactRegion` signature + returns)
- Test: `__tests__/services/forward-sync.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside `describe("syncAndCompactRegion", ...)` in `__tests__/services/forward-sync.test.ts`:

```typescript
  it("returns the post-write region state for snapshot merge", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    fakeSheets.spreadsheets.values.get.mockResolvedValue({
      data: { values: [row({ 0: "5", 2: "Bella", 24: "u1" })] },
    });
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([
      task({ entityId: "u1", payload: row({ 0: "x", 2: "Bella", 24: "u1" }) }),
    ]);

    const result = await syncAndCompactRegion("r1");

    expect(result).not.toBeNull();
    expect(result!.map((r) => r.entityId)).toEqual(["u1"]);
    expect(result![0].raw[0]).toBe("5"); // col A preserved
    expect(result![0].rowIndex).toBe(3);
  });

  it("returns null when there are no pending tasks", async () => {
    (
      dbm.query as { regions: { findFirst: jest.Mock } }
    ).regions.findFirst.mockResolvedValue(REGION);
    (
      dbm.query as { gsheetSyncQueue: { findMany: jest.Mock } }
    ).gsheetSyncQueue.findMany.mockResolvedValue([]);
    expect(await syncAndCompactRegion("r1")).toBeNull();
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm jest __tests__/services/forward-sync.test.ts -t "post-write region state"`
Expected: FAIL — `syncAndCompactRegion` currently returns `undefined`.

- [ ] **Step 3: Change the signature and the early returns**

In `lib/services/helper.service.ts`, change the signature:

```typescript
export async function syncAndCompactRegion(regionId: string) {
```

to:

```typescript
export async function syncAndCompactRegion(
  regionId: string,
): Promise<SheetRow[] | null> {
```

Change the three early `return;` statements in this function to `return null;`:
- frozen check (`if (frozen) { ... return; }`)
- `if (!region) return;`
- `if (tasks.length === 0) return;`

- [ ] **Step 4: Build and return the final state**

In `syncAndCompactRegion`, after step 5 (the UUID write block that ends with the `}` after the `Y3` update) and before step 6 (`// 6. FINISH`), insert:

```typescript
    // Build the post-write snapshot for this region so the caller can merge it
    // into sheetStates before summary regen (fresh catalog numbers this tick).
    const finalState: SheetRow[] = finalData.map((r, i) => ({
      raw: r,
      entityId: String(r[24] ?? "").trim(),
      lastEditedAt: null,
      editedBy: null,
      rowIndex: i + 3,
    }));
```

Then, at the very end of the `try` block (immediately after the `await db.update(...).set({ status: "COMPLETED" })...` that closes step 6), add:

```typescript
    return finalState;
```

Finally, after the entire `try/catch/finally` block (as the last statement of the function), add:

```typescript
  return null;
```

This makes the error path (catch runs, finally writes the audit log) fall through to `return null`.

- [ ] **Step 5: Run the forward-sync suite**

Run: `pnpm jest __tests__/services/forward-sync.test.ts`
Expected: PASS (all). The "frozen" and "no pending tasks" tests still pass (callers ignore the return).

- [ ] **Step 6: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/services/helper.service.ts __tests__/services/forward-sync.test.ts
git commit -m "feat(sync): syncAndCompactRegion returns post-write state for summary merge"
```

---

## Task 6: F + G wiring — drop photo-import bump, reorder cron, merge snapshot

**Files:**
- Modify: `lib/services/photo-import.service.ts` (remove `last_updated_at` from `uploadAndQueue`)
- Modify: `lib/services/sync-cron.service.ts` (reverse before photo; merge forward state)
- Test: no unit suite for the orchestrator or photo-import; verify via `pnpm tsc --noEmit` + full suite + the reasoning below.

- [ ] **Step 1: Stop photo-import from bumping `cats.last_updated_at`**

In `lib/services/photo-import.service.ts`, `uploadAndQueue` — current:

```typescript
    await tx
      .update(cats)
      .set({ photo_url: publicUrl, last_updated_at: new Date() })
      .where(eq(cats.id, uuid));
```

becomes (photo import owns `photo_url` only; bumping the timestamp poisons reverse-sync's conflict check and drops same-row text edits):

```typescript
    await tx
      .update(cats)
      .set({ photo_url: publicUrl })
      .where(eq(cats.id, uuid));
```

- [ ] **Step 2: Reorder the cron (reverse → photo) and merge forward state**

In `lib/services/sync-cron.service.ts`, replace the whole block from `// Phase 1: Photo import` through the end of Phase 3 (the `for (const task of pendingTasks) { await syncAndCompactRegion(task.regionId); }` loop) with:

```typescript
  // Phase 1: Reverse sync — only regions with non-empty col W. Runs BEFORE photo
  // import so cats created from brand-new sheet rows exist in the DB before we
  // try to attach their imported photo (otherwise the photo orphans).
  const reverseResult = await reverseSyncRegionsFromState(sheetStates);

  // Phase 2: Photo import — non-fatal; alert Discord on failure.
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

  // Phase 3: Forward sync only regions with pending tasks. Merge each region's
  // post-write state into the snapshot so summary regen sees this tick's fresh
  // catalog numbers (e.g. newly assigned IDs).
  for (const task of pendingTasks) {
    const finalRows = await syncAndCompactRegion(task.regionId);
    if (finalRows) sheetStates.set(task.regionId, finalRows);
  }
```

Note: this removes the now-unused `photoImported` local (it was only referenced in a comment).

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS. (Confirms `importPhotosIfNeeded`'s now-unused return is fine and no dangling `photoImported` references remain.)

- [ ] **Step 4: Full suite**

Run: `pnpm jest __tests__`
Expected: PASS (all 100+).

- [ ] **Step 5: Manual correctness review (no automated coverage here)**

Confirm by reading `lib/services/sync-cron.service.ts`:
- Phase order is now read → reverse → photo → forward(+merge) → summary.
- `reverseResult` still feeds the Phase-4 `summariesNeedRegen` gate.
- Both reverse and photo still receive the same Phase-0 `sheetStates` (reverse clearing W on the live sheet does not mutate the in-memory snapshot, so photo import still detects candidates).

- [ ] **Step 6: Commit**

```bash
git add lib/services/photo-import.service.ts lib/services/sync-cron.service.ts
git commit -m "fix(sync): reverse before photo import; stop photo bump; merge forward state into summary snapshot"
```

---

## Self-Review

**Spec coverage:**
- A (photo nulling) → Task 1 ✓ (+ UNKNOWN guard)
- B (catalog-number sort) → Task 2 ✓
- D (Date Last Seen + last_updated_at gap) → Task 3 (col N from latest session) + Task 4 (intervention bump) ✓
- F (photo-import poisoning reverse; new-cat orphan) → Task 6 (drop bump + reorder) ✓
- G (summary sees fresh catalog numbers) → Task 5 (return state) + Task 6 (merge) ✓
- C (blank-UUID expunge) → intentionally **out of scope** (verified rare; documented decision).

**Type consistency:** `findCatsByIds` (Task 1) returns rows with `id`/`photo_url` ✓. `mapCatToSheetRow` 5th param `lastSeenDate: Date | null` used consistently in Task 3 signature + both call sites. `findLatestSessionDateForCat(catId, client)` returns `Date | null`, consumed as `lastSeenDate`. `touchCat(id, client)` (Task 4) matches the `updateCat` signature shape. `syncAndCompactRegion` return type `Promise<SheetRow[] | null>` (Task 5) consumed by Task 6's `if (finalRows)` merge. `SheetRow` is module-local in helper.service.ts.

**Placeholder scan:** none — every code step shows complete code and exact commands.

**Ordering note (accepted, not a gap):** regions idle at tick start that gain forward tasks during reverse/photo are processed next tick (stale `pendingTasks`); summary for a brand-new cat in such a region shows a blank ID for one tick. Consistent with the agreed "latency acceptable" stance (E) and the G scope (merge covers only regions forward-synced this tick).

**Deferred (memory-pinned):** photo-import candidate detection treats `=IMAGE()` cells as empty (can cause one wasted xlsx download on re-edit) — acceptable; future optimization via a FORMULA read of col B.
```
