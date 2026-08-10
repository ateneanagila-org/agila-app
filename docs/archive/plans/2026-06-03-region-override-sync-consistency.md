# Region-Override Sync Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every sync/sheet path resolve a cat's region with the same override-first precedence the app already uses, and clean up the old tab row when a cat moves region — so the app and the Google Sheet never disagree.

**Architecture:** One override-aware resolver (`resolveCatRegion`) replaces the latest-session-only resolver and feeds both the forward-sync UPDATE routing and the DELETE routing. `editCat` detects a region move (old effective region ≠ new effective region) and queues a DELETE to the old region's tab, while the existing `refreshCatInSyncQueue` queues the UPDATE to the new tab. The two summary sheets swap their session-only grouping predicate for the effective-region predicate.

**Tech Stack:** TypeScript, Drizzle ORM (postgres-js), Jest, Google Sheets API. Package manager: **pnpm**.

**Reference spec:** `docs/superpowers/specs/2026-06-03-region-override-sync-consistency-design.md`

---

## File Structure

- **Modify** `lib/repo/sessions.repo.ts` — rewrite `findCatRegionByLatestSession` → `resolveCatRegion` (override-first).
- **Modify** `lib/services/helper.service.ts` — `refreshCatInSyncQueue` uses `resolveCatRegion` and returns the resolved region; For-RI / For-FA summary predicates become override-aware.
- **Modify** `lib/services/cats.service.ts` — `editCat` move-cleanup; `removeCat` uses `resolveCatRegion`.
- **Create** `__tests__/repo/resolve-cat-region.test.ts` — resolver precedence.
- **Create** `__tests__/services/cats-region-routing.test.ts` — `editCat` move + `removeCat` routing.

Type check throughout with `pnpm tsc --noEmit`. Run tests with `pnpm jest <path>`.

---

## Task 1: Override-aware resolver `resolveCatRegion`

**Files:**
- Modify: `lib/repo/sessions.repo.ts:71-95`
- Test: `__tests__/repo/resolve-cat-region.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/repo/resolve-cat-region.test.ts`:

```ts
jest.mock("@/lib/db", () => ({ db: {}, Transaction: class {} }));

import { resolveCatRegion } from "@/lib/repo/sessions.repo";

// A fake drizzle client. findFirst fakes ignore their where/with builders and
// just return the queued value, so the predicate closures never execute.
function makeClient(opts: {
  cat?: { region_id: string | null } | undefined;
  region?: { id: string; name: string } | undefined;
  session?: { region: { id: string; name: string } } | undefined;
}) {
  return {
    query: {
      cats: { findFirst: jest.fn().mockResolvedValue(opts.cat) },
      regions: { findFirst: jest.fn().mockResolvedValue(opts.region) },
      sessions: { findFirst: jest.fn().mockResolvedValue(opts.session) },
    },
  } as never;
}

describe("resolveCatRegion", () => {
  it("override set: returns the override region, never reads sessions", async () => {
    const client = makeClient({
      cat: { region_id: "R-OVERRIDE" },
      region: { id: "R-OVERRIDE", name: "Override" },
      session: { region: { id: "R-SESSION", name: "Session" } },
    });
    const region = await resolveCatRegion("c1", client);
    expect(region).toEqual({ id: "R-OVERRIDE", name: "Override" });
    expect((client as never as { query: { sessions: { findFirst: jest.Mock } } }).query.sessions.findFirst)
      .not.toHaveBeenCalled();
  });

  it("override null: falls back to the latest session's region", async () => {
    const client = makeClient({
      cat: { region_id: null },
      session: { region: { id: "R-SESSION", name: "Session" } },
    });
    const region = await resolveCatRegion("c1", client);
    expect(region).toEqual({ id: "R-SESSION", name: "Session" });
  });

  it("no override and no sessions: returns undefined", async () => {
    const client = makeClient({ cat: { region_id: null }, session: undefined });
    const region = await resolveCatRegion("c1", client);
    expect(region).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest __tests__/repo/resolve-cat-region.test.ts`
Expected: FAIL — `resolveCatRegion` is not exported from `@/lib/repo/sessions.repo`.

- [ ] **Step 3: Rewrite the resolver**

In `lib/repo/sessions.repo.ts`, replace the whole `findCatRegionByLatestSession` function (lines 71-95) with:

```ts
/**
 * Resolves a cat's effective region with the same precedence as the app read
 * path (regionSubquery in cats.repo.ts): the manual `cats.region_id` override
 * wins; otherwise fall back to the most recent session's region.
 * Returns the region row (id, name, ...) or undefined when the cat has neither.
 */
export async function resolveCatRegion(catId: string, client: DB = db) {
  const cat = await client.query.cats.findFirst({
    where: (c, { eq }) => eq(c.id, catId),
    columns: { region_id: true },
  });

  if (cat?.region_id) {
    return client.query.regions.findFirst({
      where: (r, { eq }) => eq(r.id, cat.region_id!),
    });
  }

  const latestSession = await client.query.sessions.findFirst({
    where: (sessions, { exists }) =>
      exists(
        db
          .select()
          .from(sessionCats)
          .where(
            and(
              eq(sessionCats.session_id, sessions.id),
              eq(sessionCats.cat_id, catId),
            ),
          ),
      ),
    orderBy: [desc(sessions.created_at)],
    with: { region: true },
  });

  return latestSession?.region;
}
```

(The existing imports `eq, and, desc` and `sessions, sessionCats` are already present at the top of the file and stay.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest __tests__/repo/resolve-cat-region.test.ts`
Expected: PASS (3 passing).

- [ ] **Step 5: Type check**

Run: `pnpm tsc --noEmit`
Expected: errors only of the form `sessionsRepo.findCatRegionByLatestSession is not...` in `helper.service.ts` and `cats.service.ts` (fixed in Tasks 2-4). No errors inside `sessions.repo.ts`.

- [ ] **Step 6: Commit**

```bash
git add lib/repo/sessions.repo.ts __tests__/repo/resolve-cat-region.test.ts
git commit -m "feat(sync): override-aware resolveCatRegion (replaces findCatRegionByLatestSession)"
```

---

## Task 2: `refreshCatInSyncQueue` uses the resolver and returns the region

**Files:**
- Modify: `lib/services/helper.service.ts:228-259`

No new test — behavior is covered by Task 3's `editCat` test (which asserts the UPDATE routes to the new region). This task only swaps the resolver and surfaces its result.

- [ ] **Step 1: Update the function**

In `lib/services/helper.service.ts`, change the call at line 242 and the early returns + final line so the function returns the resolved region. The function body becomes:

```ts
export async function refreshCatInSyncQueue(catId: string, tx: Transaction) {
  const cat = await tx.query.cats.findFirst({
    where: (cols, { eq }) => eq(cols.id, catId),
    with: {
      catHealthRecords: true,
      interventions: {
        orderBy: (cols, { desc }) => [desc(cols.requested_at)],
      },
    },
  });

  if (!cat) return undefined;

  const region = await sessionsRepo.resolveCatRegion(catId, tx);
  if (!region) return undefined;

  const rowData =
    region.name === "UNKNOWN"
      ? mapUnknownCatToSheetRow(cat, cat.catHealthRecords)
      : mapCatToSheetRow(cat, cat.catHealthRecords, cat.interventions);

  await tx.insert(gsheetSyncQueue).values({
    action: "UPDATE",
    entityId: catId,
    regionId: region.id,
    payload: rowData,
  });

  return region;
}
```

Keep the existing JSDoc and the `catalogDisplay defaults to ""` comment above the `rowData` line.

- [ ] **Step 2: Type check**

Run: `pnpm tsc --noEmit`
Expected: no new errors in `helper.service.ts` (the `sessionsRepo.resolveCatRegion` reference now resolves). Remaining error is in `cats.service.ts` (Task 4).

- [ ] **Step 3: Commit**

```bash
git add lib/services/helper.service.ts
git commit -m "feat(sync): refreshCatInSyncQueue routes via resolveCatRegion, returns region"
```

---

## Task 3: `editCat` move-cleanup

**Files:**
- Modify: `lib/services/cats.service.ts:47-72`
- Test: `__tests__/services/cats-region-routing.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/cats-region-routing.test.ts`:

```ts
jest.mock("@/lib/repo/cats.repo", () => ({
  insertCat: jest.fn(),
  insertCatHealthRecord: jest.fn(),
  updateCat: jest.fn(),
  updateCatHealthRecord: jest.fn(),
  deleteCat: jest.fn(),
}));
jest.mock("@/lib/repo/sessions.repo", () => ({ resolveCatRegion: jest.fn() }));
jest.mock("@/lib/services/helper.service", () => ({ refreshCatInSyncQueue: jest.fn() }));
jest.mock("@/lib/services/system-session.service", () => ({ linkCatToSystemSession: jest.fn() }));
jest.mock("@/lib/db", () => {
  const tx = { insert: jest.fn(() => ({ values: jest.fn().mockResolvedValue(undefined) })) };
  return {
    db: { transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)), __tx: tx },
    Transaction: class {},
  };
});

import { editCat, removeCat } from "@/lib/services/cats.service";
import * as catsRepo from "@/lib/repo/cats.repo";
import * as sessionsRepo from "@/lib/repo/sessions.repo";
import { refreshCatInSyncQueue } from "@/lib/services/helper.service";
import { db } from "@/lib/db";

const mockCats = catsRepo as jest.Mocked<typeof catsRepo>;
const resolveRegion = sessionsRepo.resolveCatRegion as jest.Mock;
const refreshQueue = refreshCatInSyncQueue as jest.Mock;
const txInsert = (db as unknown as { __tx: { insert: jest.Mock } }).__tx.insert;

beforeEach(() => {
  jest.clearAllMocks();
  mockCats.updateCat.mockResolvedValue([{ id: "c1" }] as never);
  mockCats.updateCatHealthRecord.mockResolvedValue(undefined as never);
});

const baseEdit = { id: "c1", region_id: "R-NEW" } as never;

describe("editCat move-cleanup", () => {
  it("region changed: queues a DELETE to the OLD region", async () => {
    resolveRegion.mockResolvedValueOnce({ id: "R-OLD", name: "Old" }); // pre-update
    refreshQueue.mockResolvedValueOnce({ id: "R-NEW", name: "New" });   // new region

    await editCat(baseEdit);

    expect(txInsert).toHaveBeenCalledTimes(1);
    const valuesFn = txInsert.mock.results[0].value.values as jest.Mock;
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE", entityId: "c1", regionId: "R-OLD" }),
    );
  });

  it("region unchanged: no DELETE queued", async () => {
    resolveRegion.mockResolvedValueOnce({ id: "R-NEW", name: "New" }); // pre-update
    refreshQueue.mockResolvedValueOnce({ id: "R-NEW", name: "New" });  // new region

    await editCat(baseEdit);

    expect(txInsert).not.toHaveBeenCalled();
  });

  it("override cleared to nowhere (new region null): still DELETEs the OLD region", async () => {
    resolveRegion.mockResolvedValueOnce({ id: "R-OLD", name: "Old" }); // pre-update
    refreshQueue.mockResolvedValueOnce(undefined);                     // resolves to nothing

    await editCat(baseEdit);

    const valuesFn = txInsert.mock.results[0].value.values as jest.Mock;
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE", entityId: "c1", regionId: "R-OLD" }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest __tests__/services/cats-region-routing.test.ts -t "editCat"`
Expected: FAIL — current `editCat` never inserts a DELETE task (no `txInsert` call).

- [ ] **Step 3: Implement the move-cleanup**

In `lib/services/cats.service.ts`, replace `editCat` (lines 47-72) with:

```ts
export const editCat = async (data: EditCatSchema) => {
  return await db.transaction(async (tx) => {
    const { id, condition, is_neutered, neuter_date, vaccination_date, ...catFields } =
      data;

    // Capture the cat's effective region BEFORE the update so we can detect a
    // region move (override changed/cleared) and clean up the old sheet tab.
    const oldRegion = await sessionsRepo.resolveCatRegion(id, tx);

    const [updatedCat] = await catsRepo.updateCat(id, catFields, tx);
    await catsRepo.updateCatHealthRecord(
      id,
      {
        condition,
        is_neutered,
        neuter_date,
        vaccination_date,
      },
      tx,
    );

    if (!updatedCat) throw new AppError("Cat not found");

    // CRITICAL FIX: We fetch the full state (including interventions)
    // before queueing, so we don't wipe out Columns S and T in the sheet.
    // refreshCatInSyncQueue queues the UPDATE to the NEW effective region and
    // returns it.
    const newRegion = await refreshCatInSyncQueue(id, tx);

    // Region move: the cat's row still sits in the old region's tab. Queue a
    // DELETE there so it does not linger as a duplicate. The UPDATE to the new
    // tab was already queued above; the two land in separate region queues.
    if (oldRegion && oldRegion.id !== newRegion?.id) {
      await tx.insert(gsheetSyncQueue).values({
        action: "DELETE",
        entityId: id,
        regionId: oldRegion.id,
        payload: [],
      });
    }

    return updatedCat;
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest __tests__/services/cats-region-routing.test.ts -t "editCat"`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add lib/services/cats.service.ts __tests__/services/cats-region-routing.test.ts
git commit -m "feat(sync): editCat queues DELETE to old tab on region move"
```

---

## Task 4: `removeCat` routes via the resolver

**Files:**
- Modify: `lib/services/cats.service.ts:74-91`
- Test: `__tests__/services/cats-region-routing.test.ts` (same file as Task 3)

- [ ] **Step 1: Add the failing test**

Append inside `__tests__/services/cats-region-routing.test.ts`, after the `editCat` describe block:

```ts
describe("removeCat routing", () => {
  it("DELETE routes to the cat's effective (override) region", async () => {
    mockCats.deleteCat.mockResolvedValue([{ id: "c1" }] as never);
    resolveRegion.mockResolvedValueOnce({ id: "R-OVERRIDE", name: "Override" });

    await removeCat({ id: "c1" } as never);

    const valuesFn = txInsert.mock.results[0].value.values as jest.Mock;
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE", entityId: "c1", regionId: "R-OVERRIDE" }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest __tests__/services/cats-region-routing.test.ts -t "removeCat"`
Expected: FAIL — current `removeCat` calls `findCatRegionByLatestSession`, which is no longer exported (TypeError / undefined), so the mocked `resolveCatRegion` is never used.

- [ ] **Step 3: Update `removeCat`**

In `lib/services/cats.service.ts`, change line 76 only — replace:

```ts
    const region = await sessionsRepo.findCatRegionByLatestSession(data.id, tx);
```

with:

```ts
    const region = await sessionsRepo.resolveCatRegion(data.id, tx);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest __tests__/services/cats-region-routing.test.ts`
Expected: PASS (4 passing total).

- [ ] **Step 5: Type check**

Run: `pnpm tsc --noEmit`
Expected: no errors related to `findCatRegionByLatestSession` anywhere (all call sites migrated). Pre-existing unrelated `.next/types` route errors may remain — ignore those.

- [ ] **Step 6: Commit**

```bash
git add lib/services/cats.service.ts __tests__/services/cats-region-routing.test.ts
git commit -m "feat(sync): removeCat routes DELETE via resolveCatRegion"
```

---

## Task 5: Summary sheets group by effective region

**Files:**
- Modify: `lib/services/helper.service.ts` — For-RI predicate (~552-564) and For-FA predicate (~678-692)

No unit test: the grouping is a Drizzle SQL `where` predicate, which the mocked-`db` suite cannot exercise (predicate closures never run under the fakes). Correctness is verified manually against the mock GSheet in Task 6, and the predicate mirrors the already-proven `regionSubquery` (cats.repo.ts:16) / `findCatsOnlyInRegion` (regions.repo.ts:93).

- [ ] **Step 1: Update the For-RI predicate**

In `generateForRiSheet`, replace the `where` of the `db.query.cats.findMany` call (the block currently reading `where: (c, { exists, eq, and }) => exists(...)`) with:

```ts
      where: (c, { exists, eq, and, or, isNull }) =>
        or(
          // Override wins: cat pinned to this region.
          eq(c.region_id, region.id),
          // No override: include if it has a session in this region.
          and(
            isNull(c.region_id),
            exists(
              db
                .select()
                .from(sessionCats)
                .innerJoin(sessions, eq(sessions.id, sessionCats.session_id))
                .where(
                  and(
                    eq(sessions.region_id, region.id),
                    eq(sessionCats.cat_id, c.id),
                  ),
                ),
            ),
          ),
        ),
```

- [ ] **Step 2: Update the For-FA predicate**

In `generateForFaSheet`, replace the `where` of its `db.query.cats.findMany` call (currently `where: (c, { eq, and, exists, isNull }) => and(and(eq(c.is_adoptable, true), isNull(c.cat_status)), exists(...))`) with:

```ts
      where: (c, { eq, and, or, exists, isNull }) =>
        and(
          eq(c.is_adoptable, true),
          isNull(c.cat_status),
          or(
            eq(c.region_id, region.id),
            and(
              isNull(c.region_id),
              exists(
                db
                  .select()
                  .from(sessionCats)
                  .innerJoin(sessions, eq(sessions.id, sessionCats.session_id))
                  .where(
                    and(
                      eq(sessions.region_id, region.id),
                      eq(sessionCats.cat_id, c.id),
                    ),
                  ),
              ),
            ),
          ),
        ),
```

- [ ] **Step 3: Type check**

Run: `pnpm tsc --noEmit`
Expected: no errors in `helper.service.ts`.

- [ ] **Step 4: Run the full unit suite (no regressions)**

Run: `pnpm jest __tests__`
Expected: all suites green, including the unchanged `__tests__/services/helper-mappers.test.ts` and `forward-sync.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/services/helper.service.ts
git commit -m "feat(sync): For-RI/For-FA summaries group by effective region (override-aware)"
```

---

## Task 6: Manual verification against the mock GSheet

**Files:** none (verification only).

Because the summary grouping and the cross-tab move both run through the Sheets API, verify end-to-end against the mock spreadsheet + duplicate DB.

- [ ] **Step 1: Move a cat via the General tab**

In the app, open a cat that currently lives in region A's tab and change its region to B on the database General tab. Save.

- [ ] **Step 2: Run a sync tick and inspect tabs**

Trigger the sync cron (or the admin sync action). Confirm: the cat's row now appears in **tab B**, and after the next tick its row is **gone from tab A** (transient one-tick overlap is expected).

- [ ] **Step 3: Verify summaries**

Confirm the moved cat (if it has a pending TNVR/Vet intervention, or is adoptable+healthy/sick/injured) appears under **region B** in the For-RI / For-FA sheets, not under region A.

- [ ] **Step 4: Verify delete routing**

Delete a cat that has a region override different from its session region. Confirm its row is removed from the **override region's** tab.

- [ ] **Step 5: Update memory**

Update the `project_region_id_override_precedence` memory to record that the divergence is now resolved on the sync/sheet + summary paths (was flagged NOT resolved). Update the matching `MEMORY.md` index line.

---

## Self-Review

**Spec coverage:**
- Resolver (spec §1) → Task 1. ✔
- `refreshCatInSyncQueue` routing (spec §1) → Task 2. ✔
- `editCat` move-cleanup (spec §2) → Task 3. ✔
- `removeCat` routing (spec §1) → Task 4. ✔
- Summaries (spec §3) → Task 5. ✔
- Reverse-sync safety (spec) → verified during brainstorm, no code change; nothing to implement. ✔
- Testing (spec) → resolver/editCat/removeCat unit-tested (Tasks 1,3,4); summaries manually verified (Task 6) — deviation from spec's "mocked db query" test, justified by the SQL-predicate/mock-harness limitation and called out in Task 5. ✔

**Placeholder scan:** none — every code step shows full code; every run step shows command + expected result.

**Type/name consistency:** `resolveCatRegion(catId, client = db)` defined in Task 1; referenced identically in Tasks 2 (`sessionsRepo.resolveCatRegion`), 3, 4. `refreshCatInSyncQueue` returns the region in Task 2 and is consumed as `newRegion` in Task 3. DELETE task shape `{ action, entityId, regionId, payload }` matches the existing `gsheetSyncQueue` insert in `removeCat`. No dangling references.
