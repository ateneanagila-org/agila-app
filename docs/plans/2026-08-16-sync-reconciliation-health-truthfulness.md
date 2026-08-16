# P5 — Sync Reconciliation & Health-Field Truthfulness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sheet a faithful projection of the database — automatically detecting and repairing cats with no row — and stop four health fields from asserting facts the data does not support.

**Architecture:** Strand A adds a reconciliation phase to the existing cron tick, reusing the sheet read that already happens on every tick and the `refreshCatInSyncQueue` write path that already exists. Strand B extracts health-field display into one module and one badge, replacing per-screen derivations. The two strands share no code and can be implemented in either order.

**Tech Stack:** Next.js 16.1.1 (App Router), React 19.2.3, TypeScript strict, Tailwind CSS 4, Drizzle ORM + postgres.js, Supabase Postgres, googleapis (Sheets v4), Jest (`testEnvironment: "node"`).

**Spec:** [docs/specs/2026-08-16-sync-reconciliation-health-truthfulness-design.md](../specs/2026-08-16-sync-reconciliation-health-truthfulness-design.md)

## Global Constraints

- **pnpm only.** Never npm.
- **Never run `pnpm dev` to verify.** Type-check with `pnpm tsc --noEmit`; test with `pnpm jest __tests__`; lint with `pnpm lint`.
- **No schema changes in this plan.** `is_adoptable` is already `boolean` and nullable. Do not run `pnpm drizzle-kit push`.
- **Services must never call `db.*` directly** — new queries go in `lib/repo/`. Pre-existing violations are left alone; introduce no new ones.
- **All Google Sheets calls go through the paced/retried wrapper** (`connectToSheets` in `sheets-client.service.ts`). Never call `google.sheets()` directly. Quota is the binding constraint.
- **Reconciliation must add no Sheets API calls.** Phase 0 already reads every region on every tick, before the idle early-exit. Reconciliation consumes that snapshot.
- **Reconciliation is gated by `getSyncHalt()`** — a frozen or retired system writes nothing.
- **If any region read failed this tick, reconciliation skips the entire tick.** Presence is a global property; a single failed read makes it untrustworthy everywhere.
- **Never hardcode hex values.** Use brand tokens (`brand-green`, `brand-orange`, `brand-cream`, `brand-dark`, `brand-mint`, `brand-cream-dark`, `brand-pink`, `brand-yellow`) or Tailwind semantic classes.
- **`expired` renders as a neutral state label** — never red, never alarm styling. The data cannot support a clinical claim.
- Custom breakpoints: `xs` 375px · `mobile` 480px · `tablet` 768px. No `sm:`/`md:`.
- `pnpm tsc --noEmit` must be completely clean at every task boundary. It is clean now.
- `pnpm lint` baseline is **2 errors + 3 warnings**, all pre-existing in `scripts/find-suffix-drift.ts`, `lib/services/reverse-sync.service.ts`, and `workers/sync-cron/src/index.ts`. Add no new ones.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/db/enums.ts` (modify) | Adds `OFF_CENSUS_STATUSES` beside `CAT_STATUS_VALUES` — the single definition of "off the active census". |
| `lib/services/helper.service.ts` (modify) | `readAllRegionSheetStates` reports failures; three sites use the shared constant; col K three-way in both mappers; alert on retry exhaustion. |
| `lib/validation/reverse-sync.ts` (modify) | Col K three-way read; `condition` returns null on unrecognised input. |
| `lib/repo/cats.repo.ts` (modify) | `effectiveRegionIdSubquery` + `findOriginalCatIdsByEffectiveRegion`. |
| `lib/repo/sync-queue.repo.ts` (create) | Queue reads used by reconciliation, keeping `db.*` out of services. |
| `lib/services/reconcile.service.ts` (create) | Pure repair planning (`planRepairs`, `looksWiped`, `takeWithinBudget`) plus the orchestrator. |
| `lib/services/sync-cron.service.ts` (modify) | Phase 0.5 wiring; pending-task query moves below it. |
| `scripts/reconcile-sheet.ts` (create) | Read-only verification. Writes nothing. |
| `lib/health-display.ts` (create) | Tri-state derivation and labels for neutered / sick / injured. |
| `components/app-pages/shared/health-badge.tsx` (create) | One badge, label + tone. |
| `lib/vaccination.ts` (modify) | `vaccinated` label becomes `Yes`; adds tone mapping. |
| `components/app-pages/catalog/catalog-detail-screen.tsx` (modify) | Four health rows use the module and the badge. |

**Task order.** Task 1 must precede Tasks 5–6. Task 3 is indivisible. Tasks 8–10 are independent of Strand A entirely.

---

## Task 1: Report which region reads failed

**Files:**
- Modify: `lib/services/helper.service.ts` (`readAllRegionSheetStates`, ~line 1415)
- Modify: `lib/services/sync-cron.service.ts` (the Phase 0 call, ~line 22)
- Test: `__tests__/services/read-all-region-states.test.ts` (create)

**Interfaces:**
- Produces: `readAllRegionSheetStates(regionList): Promise<{ states: Map<string, SheetRow[]>; failed: Set<string> }>`

**Background.** The current implementation swallows a per-region read failure and stores `[]`. That is harmless for today's callers, which simply do less work — but Task 5 treats "no rows" as "no cats on this tab", and a transient API error would then make an entire region look absent. This ambiguity must be resolved before reconciliation exists.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/read-all-region-states.test.ts`:

```ts
const mockReadSheetState = jest.fn();

jest.mock("@/lib/db", () => ({ db: {} }));
jest.mock("@/lib/services/sheets-client.service", () => ({}));

jest.mock("@/lib/services/helper.service", () => {
  const actual = jest.requireActual("@/lib/services/helper.service");
  return { ...actual, readSheetState: (...a: unknown[]) => mockReadSheetState(...a) };
});

describe("readAllRegionSheetStates", () => {
  beforeEach(() => {
    jest.resetModules();
    mockReadSheetState.mockReset();
  });

  const REGIONS = [
    { id: "r1", name: "ALPHA" },
    { id: "r2", name: "BETA" },
  ];

  it("returns states for every region and an empty failed set when all reads succeed", async () => {
    mockReadSheetState.mockResolvedValue([]);
    const { readAllRegionSheetStates } = await import("@/lib/services/helper.service");
    const { states, failed } = await readAllRegionSheetStates(REGIONS);
    expect(states.size).toBe(2);
    expect(failed.size).toBe(0);
  });

  it("adds a throwing region to failed AND still maps it to [] for existing callers", async () => {
    mockReadSheetState
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("quota exceeded"));
    const { readAllRegionSheetStates } = await import("@/lib/services/helper.service");
    const { states, failed } = await readAllRegionSheetStates(REGIONS);

    expect(failed.has("r2")).toBe(true);
    expect(failed.has("r1")).toBe(false);
    // Existing callers (photo import, reverse sync) must see the old shape.
    expect(states.get("r2")).toEqual([]);
    expect(states.size).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm jest __tests__/services/read-all-region-states.test.ts
```

Expected: FAIL — the function returns a bare `Map`, so destructuring `{ states, failed }` yields `undefined`.

- [ ] **Step 3: Change the return shape**

In `lib/services/helper.service.ts`, replace `readAllRegionSheetStates` entirely:

```ts
/**
 * One paced read pass over every region tab.
 *
 * Returns the failed region ids alongside the states. A failed read still maps
 * to [] so existing callers (photo import, reverse sync) behave exactly as
 * before — they simply do less work. Reconciliation needs the distinction,
 * because "no rows" and "the read broke" are indistinguishable otherwise and
 * the second one would make a whole region look absent.
 */
export async function readAllRegionSheetStates(
  regionList: { id: string; name: string }[],
): Promise<{ states: Map<string, SheetRow[]>; failed: Set<string> }> {
  const states = new Map<string, SheetRow[]>();
  const failed = new Set<string>();

  for (const region of regionList) {
    try {
      const rows = await readSheetState(region.id);
      states.set(region.id, rows);
    } catch (error) {
      console.error(
        `[ReadAllRegionSheetStates] region ${region.name} (${region.id}) failed:`,
        error instanceof Error ? error.message : error,
      );
      states.set(region.id, []);
      failed.add(region.id);
    }
  }

  return { states, failed };
}
```

- [ ] **Step 4: Update the only caller**

In `lib/services/sync-cron.service.ts`, the Phase 0 line becomes:

```ts
  // Phase 0: One paced read pass shared by photo-import, reverse-sync, and
  // reconciliation. `failed` names regions whose read threw.
  const { states: sheetStates, failed: failedRegions } = await readAllRegionSheetStates(allRegions);
```

`failedRegions` is unused until Task 6. Prefix it or add a `// eslint-disable-next-line` **only if lint complains** — check first; the repo's rule reports unused vars as a *warning*, and the baseline already contains warnings, so a new one is still a new problem. If it warns, name it `failedRegions` and consume it in Task 6 rather than suppressing.

Search for other callers before assuming there is one:

```bash
grep -rn "readAllRegionSheetStates" --include="*.ts" lib/ app/ scripts/ workers/
```

- [ ] **Step 5: Verify**

```bash
pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint
```

Expected: all pass; lint at the known baseline.

- [ ] **Step 6: Commit**

```bash
git add lib/services/helper.service.ts lib/services/sync-cron.service.ts __tests__/services/read-all-region-states.test.ts
git commit -m "feat(sync): report failed region reads from readAllRegionSheetStates

A failed read stored [] indistinguishably from an empty tab. Reconciliation
treats no-rows as no-cats, so that ambiguity would make a transient API error
look like a whole region vanishing. Existing callers keep the old shape."
```

---

## Task 2: One shared off-census set

**Files:**
- Modify: `lib/db/enums.ts` (after `CAT_STATUS_VALUES`, ~line 141)
- Modify: `lib/services/helper.service.ts` (lines ~97, ~140, ~656)
- Modify: `lib/repo/cats.repo.ts` (~line 108)
- Modify: `lib/stats/census-stats.ts` (the local `OFF_CENSUS_STATUSES`)
- Test: `__tests__/services/off-census.test.ts` (create)

**Interfaces:**
- Produces: `OFF_CENSUS_STATUSES: readonly CatStatus[]` from `lib/db/enums.ts`

**Background.** Five sites express "which cats count". Three omit `Fostered`, and the audit found the third only because the list is written out by hand three times. All five fostered cats are `is_adoptable`, so col V currently labels every one of them `Healthy & Adoptable` while the app's catalog excludes them.

Every `cat_status` value is off-census — an active campus cat has `null` status — so `isNull(cat_status)` and `notInArray(cat_status, OFF_CENSUS_STATUSES)` are equivalent in SQL. Use `isNull` in queries (simpler, and matches For FA) and the constant in the two string checks.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/off-census.test.ts`:

```ts
import { OFF_CENSUS_STATUSES, CAT_STATUS_VALUES } from "@/lib/db/enums";
import { getInterventionDisplayStatus, mapCatToSheetRow } from "@/lib/services/helper.service";

describe("OFF_CENSUS_STATUSES", () => {
  it("contains every cat_status value — a non-null status is always off-census", () => {
    expect([...OFF_CENSUS_STATUSES].sort()).toEqual([...CAT_STATUS_VALUES].sort());
  });

  it("includes Fostered", () => {
    expect(OFF_CENSUS_STATUSES).toContain("Fostered");
  });
});

const baseCat = {
  id: "c1", cat_status: null as string | null, is_adoptable: true,
  name: "Test", color: null, age: null, sex: null, sociability: null,
  spot_last_seen: null, date_last_seen: null, caretaker: null, notes: null,
  photo_url: null, region_id: null, merged_into_id: null,
  entry_status: "Original", last_updated_at: null,
  photo_zoom: 1, photo_offset_x: 0, photo_offset_y: 0, photo_rotation: 0,
} as never;

describe("Fostered is treated as off-census", () => {
  it("getInterventionDisplayStatus returns Not Applicable for a Fostered cat", () => {
    const cat = { ...(baseCat as object), cat_status: "Fostered" } as never;
    expect(getInterventionDisplayStatus(cat, [], "TNVR")).toBe("Not Applicable");
  });

  it("col V reads Not Applicable for a Fostered cat even when is_adoptable", () => {
    const cat = { ...(baseCat as object), cat_status: "Fostered", is_adoptable: true } as never;
    const row = mapCatToSheetRow(cat, null, [], "", null);
    expect(row[21]).toBe("Not Applicable");
  });

  it("col V still reads Healthy & Adoptable for an active adoptable cat", () => {
    const row = mapCatToSheetRow(baseCat, null, [], "", null);
    expect(row[21]).toBe("Healthy & Adoptable");
  });
});
```

If `getInterventionDisplayStatus` is not currently exported, export it — the test needs it and it is a pure function.

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm jest __tests__/services/off-census.test.ts
```

Expected: FAIL — `OFF_CENSUS_STATUSES` is not exported from `enums.ts`, and the Fostered assertions fail.

- [ ] **Step 3: Define the constant once**

In `lib/db/enums.ts`, directly after the `CAT_STATUS_VALUES` block:

```ts
/**
 * cat_status values that take a cat off the active census. This is every value —
 * an active campus cat has a null status.
 *
 * Shared by census stats, the adoptable filter, both summary-sheet queries, and
 * the sheet's col T/U/V labels, which must all agree. It exists because the list
 * was previously written out by hand in several places and three of them had
 * drifted, silently omitting Fostered.
 */
export const OFF_CENSUS_STATUSES: readonly CatStatus[] = CAT_STATUS_VALUES;
```

- [ ] **Step 4: Point all five sites at it**

`lib/services/helper.service.ts` — import `OFF_CENSUS_STATUSES` and `type CatStatus` from `@/lib/db/enums`, then:

At ~line 97 (`getInterventionDisplayStatus`):

```ts
  if (OFF_CENSUS_STATUSES.includes(cat.cat_status as CatStatus)) {
    return "Not Applicable";
  }
```

At ~line 140 (`forFaStatus`):

```ts
  let forFaStatus = "Not Ready for FA";
  if (OFF_CENSUS_STATUSES.includes(catStatus as CatStatus)) {
    forFaStatus = "Not Applicable";
  } else if (cat.is_adoptable) {
```

At ~line 656 (the For RI query) — replace the `or(...)` with the same predicate For FA already uses:

```ts
        and(
          eq(c.entry_status, "Original"),
          isNull(c.cat_status),
          or(
```

Remove `notInArray` from that callback's destructured helpers if it becomes unused.

`lib/repo/cats.repo.ts` at ~line 108 (`findAdoptableCats`) — the `or(isNull, notInArray(all four))` is equivalent to `isNull` alone:

```ts
  conditions.push(isNull(cats.cat_status));
```

`lib/stats/census-stats.ts` — replace the local definition with a re-export so existing importers keep working:

```ts
export { OFF_CENSUS_STATUSES } from "@/lib/db/enums";
```

Keep the `OFF_CENSUS_SET` built from it.

- [ ] **Step 5: Verify**

```bash
pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint
```

Existing tests asserting For RI contents may need updating if a fixture uses a `Fostered` cat — that is the behaviour change, not a regression. Read the assertion before editing it.

- [ ] **Step 6: Commit**

```bash
git add lib/db/enums.ts lib/services/helper.service.ts lib/repo/cats.repo.ts lib/stats/census-stats.ts __tests__/services/off-census.test.ts
git commit -m "fix(sync): one shared off-census set; Fostered leaves For RI and col V

Three of five sites omitted Fostered. All five fostered cats are is_adoptable,
so col V called each of them Healthy & Adoptable while the catalog excluded
them. For RI now uses the same isNull(cat_status) predicate as For FA."
```

---

## Task 3: Col K reads all three dropdown options

**Files:**
- Modify: `lib/validation/reverse-sync.ts` (`parseSheetRow`, ~lines 64-86)
- Modify: `lib/services/helper.service.ts` (col K in `mapCatToSheetRow` ~line 163 and `mapUnknownCatToSheetRow`)
- Test: `__tests__/validation/reverse-sync.test.ts` (extend)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `parseSheetRow` returns `is_adoptable: boolean | null` and `condition: string | null`.

**This task is indivisible.** Fixing the parser without the mappers produces a value that survives roughly twenty minutes: a `???` selection becomes `null`, the next forward sync writes `"NO"` because `null` is falsy, and the next reverse sync reads `false`. Both halves ship together or neither does.

**Background.** Every classification column is a `ONE_OF_LIST` dropdown, and each has its own unknown sentinel — `???` for F/G/H/I/J/K, `"None of the above"` for L, none at all for D/E. The parser handles all of them correctly except col K, which reads `=== "YES"` so both `NO` and `???` collapse to `false`. **1 of 481 live rows holds `???` today.**

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/validation/reverse-sync.test.ts`. Build rows with the helper that file already uses if one exists; otherwise a 25-element array where index 24 is a UUID:

```ts
import { parseSheetRow } from "@/lib/validation/reverse-sync";

const UUID = "11111111-1111-4111-8111-111111111111";

/** Standard-layout row: index 8 = col I (sick), 9 = J (injured), 10 = K (adoptable). */
function row(overrides: Record<number, string>): string[] {
  const r = new Array(25).fill("");
  r[24] = UUID;
  for (const [i, v] of Object.entries(overrides)) r[Number(i)] = v;
  return r;
}

describe("parseSheetRow col K (adoptable) reads all three dropdown options", () => {
  it("YES is true", () => {
    expect(parseSheetRow(row({ 10: "YES" }))!.is_adoptable).toBe(true);
  });

  it("NO is false", () => {
    expect(parseSheetRow(row({ 10: "NO" }))!.is_adoptable).toBe(false);
  });

  it("??? is null — the dropdown's own unknown option, not a negative", () => {
    expect(parseSheetRow(row({ 10: "???" }))!.is_adoptable).toBeNull();
  });

  it("a blank cell is null", () => {
    expect(parseSheetRow(row({}))!.is_adoptable).toBeNull();
  });
});

describe("parseSheetRow condition", () => {
  it.each([
    ["NO", "NO", "Healthy"],
    ["YES", "NO", "Sick"],
    ["NO", "YES", "Injured"],
    ["YES", "YES", "Sick and Injured"],
  ])("I=%s J=%s yields %s", (i, j, expected) => {
    expect(parseSheetRow(row({ 8: i, 9: j }))!.condition).toBe(expected);
  });

  it("??? in either column is null", () => {
    expect(parseSheetRow(row({ 8: "???", 9: "NO" }))!.condition).toBeNull();
    expect(parseSheetRow(row({ 8: "NO", 9: "???" }))!.condition).toBeNull();
  });

  it("a blank column is null, not Healthy — absence is not a clean bill of health", () => {
    expect(parseSheetRow(row({ 8: "", 9: "NO" }))!.condition).toBeNull();
    expect(parseSheetRow(row({ 8: "NO", 9: "" }))!.condition).toBeNull();
    expect(parseSheetRow(row({}))!.condition).toBeNull();
  });

  it("an unrecognised value is null", () => {
    expect(parseSheetRow(row({ 8: "maybe", 9: "NO" }))!.condition).toBeNull();
  });
});
```

And the mapper side, in `__tests__/services/helper-mappers.test.ts`:

```ts
import { mapCatToSheetRow } from "@/lib/services/helper.service";

const cat = (is_adoptable: boolean | null) =>
  ({
    id: "c1", cat_status: null, is_adoptable, name: "T", color: null, age: null,
    sex: null, sociability: null, spot_last_seen: null, date_last_seen: null,
    caretaker: null, notes: null, photo_url: null, region_id: null,
    merged_into_id: null, entry_status: "Original", last_updated_at: null,
    photo_zoom: 1, photo_offset_x: 0, photo_offset_y: 0, photo_rotation: 0,
  }) as never;

describe("col K is written three ways, matching col G", () => {
  it("true writes YES", () => {
    expect(mapCatToSheetRow(cat(true), null, [], "", null)[10]).toBe("YES");
  });
  it("false writes NO", () => {
    expect(mapCatToSheetRow(cat(false), null, [], "", null)[10]).toBe("NO");
  });
  it("null writes ??? — without this the null cannot survive a round trip", () => {
    expect(mapCatToSheetRow(cat(null), null, [], "", null)[10]).toBe("???");
  });
});

describe("is_adoptable round-trips through the sheet without collapsing", () => {
  it("null -> ??? -> null", () => {
    const written = mapCatToSheetRow(cat(null), null, [], "", null)[10];
    const r = new Array(25).fill("");
    r[24] = "11111111-1111-4111-8111-111111111111";
    r[10] = written;
    const { parseSheetRow } = jest.requireActual("@/lib/validation/reverse-sync");
    expect(parseSheetRow(r).is_adoptable).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm jest __tests__/validation/reverse-sync.test.ts __tests__/services/helper-mappers.test.ts
```

Expected: FAIL — `???` currently yields `false`, blanks yield `Healthy`/`false`, and col K writes `"NO"` for null.

- [ ] **Step 3: Fix the parser**

In `lib/validation/reverse-sync.ts`, replace the `condition` block and the `is_adoptable` line:

```ts
  // Cols I (Sick) and J (Injured) are YES/NO/??? dropdowns. Both must carry a
  // recognised token for the pair to mean anything: a four-value enum cannot
  // express "sick, injured unknown", so null is the only honest answer when
  // either side is missing. A blank must not fall through to "Healthy" — that
  // would turn a cleared cell into a positive medical claim.
  const TRISTATE_TOKENS = new Set(["YES", "NO", "???"]);
  const rawSick = String(row[8] ?? "").trim().toUpperCase();
  const rawInjured = String(row[9] ?? "").trim().toUpperCase();

  let condition: string | null;
  if (
    !TRISTATE_TOKENS.has(rawSick) ||
    !TRISTATE_TOKENS.has(rawInjured) ||
    rawSick === "???" ||
    rawInjured === "???"
  ) {
    condition = null;
  } else if (rawSick === "YES" && rawInjured === "YES") {
    condition = "Sick and Injured";
  } else if (rawSick === "YES") {
    condition = "Sick";
  } else if (rawInjured === "YES") {
    condition = "Injured";
  } else {
    condition = "Healthy";
  }
```

```ts
  // Col K is a YES/NO/??? dropdown like col G. Reading it as `=== "YES"`
  // collapsed both NO and ??? to false, so a volunteer selecting the sheet's own
  // "unknown" option was recorded as a definite negative.
  const rawAdoptable = String(row[10] ?? "").trim().toUpperCase();
  const is_adoptable =
    rawAdoptable === "YES" ? true : rawAdoptable === "NO" ? false : null;
```

Update the zod schema in the same file so `is_adoptable` is `z.boolean().nullable()`.

- [ ] **Step 4: Fix both mappers**

In `lib/services/helper.service.ts`, col K in `mapCatToSheetRow` (~line 163):

```ts
    cat.is_adoptable === true
      ? "YES"
      : cat.is_adoptable === false
        ? "NO"
        : "???", // 10 (K)
```

Apply the identical change to col K in `mapUnknownCatToSheetRow`. Find it with:

```bash
grep -n "is_adoptable ? \"YES\" : \"NO\"" lib/services/helper.service.ts
```

Both occurrences must change. Leaving either one flattens `null` back to `"NO"`.

- [ ] **Step 5: Verify**

```bash
pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint
```

Downstream consumers of `is_adoptable` may now see `null`. Check `importSheetRowToDB` in `reverse-sync.service.ts` passes it through rather than coercing.

- [ ] **Step 6: Commit**

```bash
git add lib/validation/reverse-sync.ts lib/services/helper.service.ts __tests__/validation/reverse-sync.test.ts __tests__/services/helper-mappers.test.ts
git commit -m "fix(sync): col K reads YES/NO/???; blank I or J no longer means Healthy

Col K was read as === \"YES\", so the dropdown's own ??? option became a definite
false. 1 of 481 live rows holds ??? today. Both mappers now write ??? for null —
without that the round trip flattens it back to NO within one tick."
```

- [ ] **Step 7: Report the manual data correction**

The single row already holding `???` has `is_adoptable = false` in the database and **does not self-heal**: reverse sync only re-imports rows carrying a col-W edit timestamp. Report to the controller that a one-time correction is needed, identified by Task 7's script.

---

## Task 4: Alert when a task exhausts its retries

**Files:**
- Modify: `lib/services/helper.service.ts` (`syncAndCompactRegion` catch block, ~lines 514-533)
- Test: `__tests__/services/sync-retry-alert.test.ts` (create)

**Interfaces:**
- Consumes: `sendSyncAlert` from `lib/services/discord.service`.

**Background.** After `MAX_RETRIES` (3) a task is marked `FAILED` — correct, so it stops lingering `PENDING`. But `syncAndCompactRegion` then catches and returns `null`, so the cron's own try/catch never fires and no alert is sent. Reconciliation will repair the missing row, which fixes the symptom while leaving the cause invisible.

- [ ] **Step 1: Write the failing test**

```ts
const mockSendSyncAlert = jest.fn();
jest.mock("@/lib/services/discord.service", () => ({
  sendSyncAlert: (...a: unknown[]) => mockSendSyncAlert(...a),
}));

describe("retry exhaustion alerting", () => {
  beforeEach(() => { jest.resetModules(); mockSendSyncAlert.mockReset(); });

  it("alerts once when at least one task reaches MAX_RETRIES", async () => {
    // Arrange a region whose sheet read throws, with a task already at retryCount 2.
    // (Mock db + connectToSheets per this repo's existing sync-test style — see
    // __tests__/services/reverse-sync.test.ts for the established mock shape.)
    // Assert: mockSendSyncAlert called exactly once, message contains the region name.
    expect(mockSendSyncAlert).toHaveBeenCalledTimes(1);
  });

  it("does not alert when tasks still have retries left", async () => {
    expect(mockSendSyncAlert).not.toHaveBeenCalled();
  });
});
```

**These are skeletons, not the deliverable.** Before writing them, open
`__tests__/services/reverse-sync.test.ts` and copy its `db` / `connectToSheets` mock
shape — that file already stubs the same seams this test needs. Every `expect` above
must be preceded by an arrange block that actually drives `syncAndCompactRegion` to the
failure path; an assertion with no arrange passes vacuously and is worse than no test.

Concretely, the first case needs: a region row, one queue task with `retryCount: 2`, and
`connectToSheets` (or the values.get it calls) rejecting. The second needs the same with
`retryCount: 0`.

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm jest __tests__/services/sync-retry-alert.test.ts
```

Expected: FAIL — no alert is sent today.

- [ ] **Step 3: Implement**

In the catch block, track which tasks crossed the threshold and alert once afterwards:

```ts
    const exhausted: string[] = [];
    for (const task of tasks) {
      const newRetryCount = task.retryCount + 1;
      if (newRetryCount >= MAX_RETRIES) exhausted.push(task.entityId);
      await db
        .update(gsheetSyncQueue)
        .set({
          retryCount: newRetryCount,
          lastError: errMsg,
          ...(newRetryCount >= MAX_RETRIES ? { status: "FAILED" as const } : {}),
        })
        .where(eq(gsheetSyncQueue.id, task.id));
    }

    console.error(`[Sync] Region ${regionId} failed:`, errMsg);

    // A FAILED task is abandoned: it is no longer PENDING, so nothing retries it
    // and reconciliation will quietly repair the missing row. Alert so a
    // repeatedly failing region cannot hide behind that self-healing.
    if (exhausted.length > 0) {
      try {
        await sendSyncAlert(
          `Sync gave up on ${exhausted.length} task(s) in region ${region.name} after ${MAX_RETRIES} attempts. Last error: ${errMsg}`,
        );
      } catch (alertErr) {
        console.error(
          "[Sync] Alert delivery failed:",
          alertErr instanceof Error ? alertErr.message : alertErr,
        );
      }
    }
```

Import `sendSyncAlert` if not already imported. The alert is wrapped so a Discord outage cannot mask the original sync error.

- [ ] **Step 4: Verify**

```bash
pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add lib/services/helper.service.ts __tests__/services/sync-retry-alert.test.ts
git commit -m "feat(sync): alert when a task exhausts its retries

A FAILED task stops being PENDING, so nothing retries it and reconciliation
repairs the row silently. That fixes the symptom and hides the cause."
```

---

## Task 5: Reconciliation planning

**Files:**
- Modify: `lib/repo/cats.repo.ts` (add `effectiveRegionIdSubquery`, `findOriginalCatIdsByEffectiveRegion`)
- Create: `lib/repo/sync-queue.repo.ts`
- Create: `lib/services/reconcile.service.ts`
- Test: `__tests__/services/reconcile.test.ts` (create)

**Interfaces:**
- Consumes: `readAllRegionSheetStates(...)` → `{ states, failed }` (Task 1); `getSyncHalt()` from `lib/services/system.service`; `refreshCatInSyncQueue(catId, tx)` from `lib/services/helper.service`.
- Produces:
  - `planRepairs(expectedByRegion, presentByRegion, pendingCatIds): RepairPlan`
  - `looksWiped(expected: number, present: number): boolean`
  - `takeWithinBudget<T>(items: T[], budget: number): { taken: T[]; deferred: number }`
  - `RECONCILE_MAX_REPAIRS_PER_TICK: 25`
  - `reconcileSheetRepresentation(allRegions, states, failed): Promise<ReconcileOutcome>`

**Background.** Presence is evaluated **globally**, across every region's snapshot — never per region. A per-region check would append a cat that already sits on a stale tab, producing the "cat appears on two sheets" failure. Global presence also yields the invariant that makes this safe: reconciliation only ever acts on cats absent from *every* tab, and reverse sync only processes rows that exist, so the two sets are disjoint and reverse sync can never cancel a reconciliation task.

- [ ] **Step 1: Write the failing tests for the pure functions**

Create `__tests__/services/reconcile.test.ts`:

```ts
import {
  planRepairs,
  looksWiped,
  takeWithinBudget,
} from "@/lib/services/reconcile.service";

describe("planRepairs", () => {
  it("queues a cat absent from every tab", () => {
    const plan = planRepairs(
      new Map([["r1", ["catA"]]]),
      new Map([["r1", new Set<string>()]]),
      new Set(),
    );
    expect(plan.missing).toEqual([{ catId: "catA", regionId: "r1" }]);
    expect(plan.wrongTab).toEqual([]);
  });

  it("leaves a cat that is already present alone", () => {
    const plan = planRepairs(
      new Map([["r1", ["catA"]]]),
      new Map([["r1", new Set(["catA"])]]),
      new Set(),
    );
    expect(plan.missing).toEqual([]);
    expect(plan.wrongTab).toEqual([]);
  });

  it("classifies a cat sitting on another region's tab as wrongTab, not missing", () => {
    const plan = planRepairs(
      new Map([["r1", ["catA"]], ["r2", []]]),
      new Map([["r1", new Set<string>()], ["r2", new Set(["catA"])]]),
      new Set(),
    );
    expect(plan.missing).toEqual([]);
    expect(plan.wrongTab).toEqual([
      { catId: "catA", fromRegionId: "r2", toRegionId: "r1" },
    ]);
  });

  it("skips any cat with a PENDING task — Phase 3 will append it anyway", () => {
    const plan = planRepairs(
      new Map([["r1", ["catA"]]]),
      new Map([["r1", new Set<string>()]]),
      new Set(["catA"]),
    );
    expect(plan.missing).toEqual([]);
  });
});

describe("looksWiped", () => {
  it("trips when a region expects cats but its snapshot is empty", () => {
    expect(looksWiped(40, 0)).toBe(true);
  });

  it("does not trip for a genuinely empty region", () => {
    expect(looksWiped(0, 0)).toBe(false);
  });

  it("does not trip whenever the tab holds anything at all", () => {
    expect(looksWiped(40, 1)).toBe(false);
    expect(looksWiped(3, 3)).toBe(false);
  });
});

describe("takeWithinBudget", () => {
  it("returns everything when it fits", () => {
    const { taken, deferred } = takeWithinBudget([1, 2, 3], 25);
    expect(taken).toEqual([1, 2, 3]);
    expect(deferred).toBe(0);
  });

  it("truncates to the budget and reports what was left", () => {
    const { taken, deferred } = takeWithinBudget([1, 2, 3, 4, 5], 2);
    expect(taken).toEqual([1, 2]);
    expect(deferred).toBe(3);
  });

  it("takes nothing once the budget is spent", () => {
    const { taken, deferred } = takeWithinBudget([1, 2], 0);
    expect(taken).toEqual([]);
    expect(deferred).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm jest __tests__/services/reconcile.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/services/reconcile.service'`.

- [ ] **Step 3: Add the repo queries**

In `lib/repo/cats.repo.ts`. **Do not add a second copy of the rule beside
`regionSubquery`** — the two would be identical but for `r.name` vs `r.id`, which is
exactly the duplication `CLAUDE.md` warns about. Define the rule once as the ID resolver,
then **rewrite `regionSubquery` to derive from it**:

```ts
// THE effective-region rule, expressed once: cats.region_id is an authoritative
// override; otherwise the most recent session's region. Both branches join
// through `regions`, so an id pointing at a since-deleted region falls through
// rather than resolving to a dangling value.
//
// CLAUDE.md flags this rule as living in several places that must agree.
// regionSubquery below now DERIVES from this one, leaving resolveCatRegion
// (sessions.repo.ts) as the only other expression.
export const effectiveRegionIdSubquery = sql<string | null>`COALESCE(
  (SELECT r2.id FROM regions r2 WHERE r2.id = cats.region_id),
  (SELECT r.id FROM regions r
    INNER JOIN sessions s ON s.region_id = r.id
    INNER JOIN session_cats sc ON sc.session_id = s.id
    WHERE sc.cat_id = cats.id
    ORDER BY s.created_at DESC
    LIMIT 1)
)`;

// Name of whichever region the rule above resolved. Replaces the previous
// hand-written COALESCE, which duplicated the rule verbatim. Behaviour is
// unchanged: a null effective id yields `WHERE r.id = NULL`, which matches no
// rows and returns NULL, exactly as the old version did.
export const regionSubquery = sql<string | null>`(
  SELECT r.name FROM regions r WHERE r.id = ${effectiveRegionIdSubquery}
)`;

/** Every Original cat with the region its row belongs on. */
export const findOriginalCatIdsByEffectiveRegion = (
  client: DB = db,
): Promise<{ cat_id: string; region_id: string | null }[]> =>
  client
    .select({ cat_id: cats.id, region_id: effectiveRegionIdSubquery })
    .from(cats)
    .where(eq(cats.entry_status, "Original"));
```

Create `lib/repo/sync-queue.repo.ts`:

```ts
import { db, type DB } from "@/lib/db";
import { gsheetSyncQueue } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** Cat ids with a PENDING forward-sync task. */
export const findPendingSyncCatIds = (client: DB = db): Promise<string[]> =>
  client
    .selectDistinct({ entityId: gsheetSyncQueue.entityId })
    .from(gsheetSyncQueue)
    .where(eq(gsheetSyncQueue.status, "PENDING"))
    .then((rows) => rows.map((r) => r.entityId));
```

Match `lib/db`'s actual exports for `DB` — check `lib/repo/cats.repo.ts`'s imports and copy them.

**`regionSubquery` feeds every cat list read in the app.** After rewriting it, run the full
suite and confirm nothing that displays a region name regressed — the dashboard list, the
public catalog, and the session screens all consume it.

- [ ] **Step 4: Implement the service**

Create `lib/services/reconcile.service.ts`:

```ts
import { db } from "@/lib/db";
import type { SheetRow } from "@/lib/services/helper.service";
import { refreshCatInSyncQueue } from "@/lib/services/helper.service";
import { getSyncHalt } from "@/lib/services/system.service";
import { sendSyncAlert } from "@/lib/services/discord.service";
import * as catsRepo from "@/lib/repo/cats.repo";
import * as queueRepo from "@/lib/repo/sync-queue.repo";

export type RepairPlan = {
  missing: { catId: string; regionId: string }[];
  wrongTab: { catId: string; fromRegionId: string; toRegionId: string }[];
};

export type ReconcileOutcome = {
  restored: number;
  moved: number;
  /** Repairs left for the next tick because the budget ran out. */
  deferred: number;
  skippedRegions: string[];
  skippedTick: boolean;
};

/**
 * Presence is global on purpose. Checking only the cat's own region would append
 * a cat that already sits on a stale tab, producing the double-listing failure
 * this is meant to prevent.
 */
export function planRepairs(
  expectedByRegion: Map<string, string[]>,
  presentByRegion: Map<string, Set<string>>,
  pendingCatIds: Set<string>,
): RepairPlan {
  const locationOf = new Map<string, string>();
  for (const [regionId, ids] of presentByRegion) {
    for (const id of ids) locationOf.set(id, regionId);
  }

  const plan: RepairPlan = { missing: [], wrongTab: [] };
  for (const [regionId, catIds] of expectedByRegion) {
    for (const catId of catIds) {
      // A pending task already produces the row: Phase 3 hits idx === -1 and
      // appends it as part of the same operation.
      if (pendingCatIds.has(catId)) continue;
      const found = locationOf.get(catId);
      if (found === regionId) continue;
      if (found === undefined) plan.missing.push({ catId, regionId });
      else plan.wrongTab.push({ catId, fromRegionId: found, toRegionId: regionId });
    }
  }
  return plan;
}

/**
 * A region that expects cats but whose snapshot came back completely empty.
 * Reads succeeded (a failed read skips the whole tick), so the API genuinely
 * returned nothing for a tab we believe holds rows — the signature of a wipe or
 * a botched script, not of ordinary drift. Pause and alert rather than rewriting
 * the tab underneath whoever is working on it.
 *
 * The escape is deliberately cheap: restore or add any single row and this stops
 * tripping, after which the per-tick budget clears the rest automatically. That
 * is why this stays a hard skip while a proportional "too many repairs" cap was
 * rejected — the cap's only escape was repairing more by hand than it allowed,
 * i.e. doing this function's job manually.
 */
export function looksWiped(expected: number, present: number): boolean {
  return expected > 0 && present === 0;
}

/**
 * Per-tick repair budget. Bounds how much a mis-plan can do in one tick without
 * ever refusing to converge: whatever is deferred is simply retried next tick,
 * and ticks run every 20 minutes.
 *
 * 25 is derived, not picked: observed drift over the app's lifetime is 6 cats,
 * the largest region holds 71, and the census is 558. 25 is roughly four times
 * normal drift — so ordinary operation always clears in a single tick — while
 * remaining well under a single region, so no bug can rewrite a whole tab at
 * once. Worst case, a full-census mis-plan drains in under a day.
 */
export const RECONCILE_MAX_REPAIRS_PER_TICK = 25;

export function takeWithinBudget<T>(
  items: T[],
  budget: number,
): { taken: T[]; deferred: number } {
  const taken = items.slice(0, Math.max(0, budget));
  return { taken, deferred: items.length - taken.length };
}

export async function reconcileSheetRepresentation(
  allRegions: { id: string; name: string }[],
  states: Map<string, SheetRow[]>,
  failed: Set<string>,
): Promise<ReconcileOutcome> {
  const empty: ReconcileOutcome = {
    restored: 0, moved: 0, deferred: 0, skippedRegions: [], skippedTick: true,
  };

  if (await getSyncHalt()) return empty;

  // Presence is a global property: one failed read makes it untrustworthy
  // everywhere, because a cat living on that tab looks absent from all of them.
  if (failed.size > 0) {
    console.log(
      `[Reconcile] Skipping tick — ${failed.size} region read(s) failed.`,
    );
    return empty;
  }

  const [rows, pendingIds] = await Promise.all([
    catsRepo.findOriginalCatIdsByEffectiveRegion(),
    queueRepo.findPendingSyncCatIds(),
  ]);

  const expectedByRegion = new Map<string, string[]>();
  for (const { cat_id, region_id } of rows) {
    if (!region_id) continue; // no resolvable region — nowhere to put it
    const list = expectedByRegion.get(region_id) ?? [];
    list.push(cat_id);
    expectedByRegion.set(region_id, list);
  }

  const presentByRegion = new Map<string, Set<string>>();
  for (const region of allRegions) {
    const ids = new Set<string>();
    for (const r of states.get(region.id) ?? []) {
      const id = String(r.entityId ?? "").trim();
      if (id) ids.add(id);
    }
    presentByRegion.set(region.id, ids);
  }

  const plan = planRepairs(expectedByRegion, presentByRegion, new Set(pendingIds));

  const skippedRegions: string[] = [];
  let restored = 0;
  let moved = 0;
  let deferred = 0;

  // Drop repairs aimed at a region whose tab looks wiped, then spend one shared
  // budget across everything that remains. Wrong-tab repairs count against the
  // same budget precisely because they are the destructive path.
  const eligible: Array<
    | { kind: "missing"; catId: string; regionId: string }
    | { kind: "wrongTab"; catId: string; fromRegionId: string; toRegionId: string }
  > = [];

  for (const region of allRegions) {
    const expected = expectedByRegion.get(region.id)?.length ?? 0;
    const present = presentByRegion.get(region.id)?.size ?? 0;
    if (looksWiped(expected, present)) {
      skippedRegions.push(region.name);
      continue;
    }
    for (const m of plan.missing.filter((x) => x.regionId === region.id)) {
      eligible.push({ kind: "missing", ...m });
    }
    for (const w of plan.wrongTab.filter((x) => x.toRegionId === region.id)) {
      eligible.push({ kind: "wrongTab", ...w });
    }
  }

  const { taken, deferred: notTaken } = takeWithinBudget(
    eligible,
    RECONCILE_MAX_REPAIRS_PER_TICK,
  );
  deferred = notTaken;

  for (const item of taken) {
    if (item.kind === "missing") {
      await db.transaction(async (tx) => {
        await refreshCatInSyncQueue(item.catId, tx);
      });
      restored++;
    } else {
      await repairRegionMove(item.catId, item.fromRegionId, item.toRegionId);
      moved++;
    }
  }

  if (restored + moved + deferred + skippedRegions.length > 0) {
    const parts: string[] = [];
    if (restored) parts.push(`restored ${restored} missing row(s)`);
    if (moved) parts.push(`moved ${moved} row(s) to the correct tab`);
    // Report the remainder, or a partial repair reads as a complete one.
    if (deferred) parts.push(`${deferred} more queued for the next tick`);
    if (skippedRegions.length) {
      parts.push(`skipped ${skippedRegions.join(", ")} — tab looks wiped`);
    }
    try {
      await sendSyncAlert(
        `Sheet reconciliation: ${parts.join("; ")}. Deleting a row does not delete a cat — set column L status instead.`,
      );
    } catch (err) {
      console.error(
        "[Reconcile] Alert delivery failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { restored, moved, deferred, skippedRegions, skippedTick: false };
}
```

And `repairRegionMove`, in the same file. It mirrors the sequence `editCat` already
uses at `lib/services/cats.service.ts:112-130` — read that block before writing this
one and keep the order identical:

```ts
/**
 * A region move whose DELETE was missed: the row still sits on the old tab.
 * Same three steps editCat performs, in the same order — supersede the cat's
 * pending tasks for the OLD region only, queue a DELETE so the stale row is
 * removed, then queue the UPDATE that appends it to the new tab.
 *
 * The DELETE is the one destructive act in reconciliation. Cols A-V are DB
 * projections and are rewritten at the destination, but cols W/X
 * (last_edited_at, edited_by) are Apps Script-owned and sheet-only, so they do
 * not survive the move.
 */
async function repairRegionMove(
  catId: string,
  fromRegionId: string,
  toRegionId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(gsheetSyncQueue)
      .set({ status: "COMPLETED", lastError: "Superseded by reconciliation" })
      .where(
        and(
          eq(gsheetSyncQueue.entityId, catId),
          eq(gsheetSyncQueue.regionId, fromRegionId),
          eq(gsheetSyncQueue.status, "PENDING"),
        ),
      );

    await tx.insert(gsheetSyncQueue).values({
      action: "DELETE",
      entityId: catId,
      regionId: fromRegionId,
      payload: [],
    });

    await refreshCatInSyncQueue(catId, tx);
  });
}
```

Import `gsheetSyncQueue` from `@/lib/db/schema` and `and`, `eq` from `drizzle-orm`.
Confirm the `DELETE` payload shape against `cats.service.ts:126-130` — match whatever it
passes rather than assuming `[]`.

- [ ] **Step 5: Verify**

```bash
pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint
```

- [ ] **Step 6: Commit**

```bash
git add lib/repo/cats.repo.ts lib/repo/sync-queue.repo.ts lib/services/reconcile.service.ts __tests__/services/reconcile.test.ts
git commit -m "feat(sync): reconciliation planning

Presence is evaluated globally, not per region: a per-region check would append
a cat already sitting on a stale tab. That also makes reconciliation disjoint
from reverse sync, which only processes rows that exist, so a repair task can
never be superseded."
```

---

## Task 6: Wire Phase 0.5 into the cron

**Files:**
- Modify: `lib/services/sync-cron.service.ts`
- Test: `__tests__/services/reconcile-cron.test.ts` (create)

**Interfaces:**
- Consumes: `reconcileSheetRepresentation(allRegions, states, failed)` (Task 5); `{ states, failed }` (Task 1).

**Background.** Reconciliation must run **after** the shared read and **before** the pending-task query, so a repair makes the tick non-idle and is pushed the same cycle. It must also run before the idle early-exit — that exit is precisely why drift persisted, since a drifted cat generates neither a pending task nor a sheet edit.

- [ ] **Step 1: Write the failing test**

```ts
const mockReconcile = jest.fn();
jest.mock("@/lib/services/reconcile.service", () => ({
  reconcileSheetRepresentation: (...a: unknown[]) => mockReconcile(...a),
}));
// plus the db / helper / reverse-sync / photo-import mocks used by the repo's
// existing cron tests — copy the shape from __tests__/services/ sync tests.

describe("Phase 0.5 wiring", () => {
  it("runs reconciliation even on an otherwise idle tick", async () => {
    // no pending tasks, no sheet edits
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it("queries pending tasks AFTER reconciliation, so a repair is pushed this tick", async () => {
    // reconcile enqueues one task; assert forward sync runs for that region
  });

  it("a reconciliation failure does not fail the tick", async () => {
    mockReconcile.mockRejectedValue(new Error("boom"));
    await expect(syncAllPendingRegions()).resolves.not.toThrow();
  });
});
```

**These are skeletons, not the deliverable.** Copy the mock shape from the existing
sync tests in `__tests__/services/`, and make each case actually drive
`syncAllPendingRegions`:

- *idle tick*: `readAllRegionSheetStates` resolves to empty states with an empty `failed`
  set, the pending-task query returns `[]`, and no snapshot row carries `lastEditedAt`.
  Assert `mockReconcile` was still called — this is the case the old code skipped.
- *repair is pushed this tick*: have `mockReconcile` resolve
  `{ restored: 1, moved: 0, skippedRegions: [], skippedTick: false }` and the pending-task
  query return one region; assert `syncAndCompactRegion` ran for it.
- *failure is non-fatal*: `mockReconcile` rejects; assert `syncAllPendingRegions` resolves
  and that reverse sync / forward sync still ran.

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm jest __tests__/services/reconcile-cron.test.ts
```

- [ ] **Step 3: Implement**

In `syncAllPendingRegions`, insert Phase 0.5 and move the pending-task query below it:

```ts
  // Phase 0: One paced read pass shared by photo-import, reverse-sync, and
  // reconciliation.
  const { states: sheetStates, failed: failedRegions } =
    await readAllRegionSheetStates(allRegions);

  // Phase 0.5: Reconcile representation. Runs BEFORE the pending-task query so a
  // repair makes this tick non-idle and is pushed the same cycle, and before the
  // idle early-exit — a drifted cat generates neither a pending task nor a sheet
  // edit, which is exactly why the drift persisted. Costs no extra Sheets calls:
  // Phase 0 already read every region, idle tick or not.
  //
  // Its own try/catch: a reconciliation failure must not fail the tick, which
  // would auto-freeze sync over the wrong subsystem.
  try {
    const outcome = await reconcileSheetRepresentation(
      allRegions,
      sheetStates,
      failedRegions,
    );
    if (outcome.restored || outcome.moved || outcome.skippedRegions.length) {
      console.log(
        `[Reconcile] restored=${outcome.restored} moved=${outcome.moved} skipped=[${outcome.skippedRegions.join(", ")}]`,
      );
    }
  } catch (error) {
    console.error("[Reconcile] Failed (non-fatal):", errMsg(error));
  }

  // Pending forward-sync tasks — queried AFTER reconciliation so repairs count.
  const pendingTasks = await db
    .selectDistinct({ regionId: gsheetSyncQueue.regionId })
    .from(gsheetSyncQueue)
    .where(eq(gsheetSyncQueue.status, "PENDING"));
```

Everything below is unchanged.

- [ ] **Step 4: Verify**

```bash
pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add lib/services/sync-cron.service.ts __tests__/services/reconcile-cron.test.ts
git commit -m "feat(sync): reconcile representation as Phase 0.5

Runs before the pending-task query so a repair is pushed the same tick, and
before the idle early-exit, which is why drift was previously invisible. No
extra Sheets calls — Phase 0 already reads every region on every tick."
```

---

## Task 7: Read-only verification script

**Files:**
- Create: `scripts/reconcile-sheet.ts`

**Interfaces:**
- Consumes: `connectToSheets` from `lib/services/helper.service`; `findOriginalCatIdsByEffectiveRegion` (Task 5).

**This script writes nothing.** It is how the cron fix is verified and what the handoff guide points at.

- [ ] **Step 1: Write the script**

Follow the shape of `scripts/find-skipped-rows.ts`. It must report:

1. `Original` cats present on **no** tab, with their effective region.
2. Cats present on a tab that is not their effective region.
3. Sheet UUIDs with no matching `Original` cat.
4. **Rows whose col K holds `???` while the database records a concrete `is_adoptable`** — this is how the one known mis-recorded cat is found.
5. A total: sheet UUID count vs `Original` cat count.

```ts
import "dotenv/config";
import { db } from "@/lib/db";
import { regions, cats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { connectToSheets } from "@/lib/services/helper.service";
import { findOriginalCatIdsByEffectiveRegion } from "@/lib/repo/cats.repo";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;
  const allRegions = await db.select().from(regions);
  const nameOf = new Map(allRegions.map((r) => [r.id, r.name]));

  // uuid -> { regionId, colK }
  const onSheet = new Map<string, { regionId: string; colK: string }>();
  for (const region of allRegions) {
    const res = await glSheets.spreadsheets.values.get({
      auth: glAuth,
      spreadsheetId,
      range: `'${region.name}'!A3:Y`,
    });
    for (const row of res.data.values ?? []) {
      const uuid = String(row[24] ?? "").trim().toLowerCase();
      if (!UUID_RE.test(uuid)) continue;
      onSheet.set(uuid, {
        regionId: region.id,
        colK: String(row[10] ?? "").trim(),
      });
    }
  }

  const expected = await findOriginalCatIdsByEffectiveRegion();
  const dbIds = new Set(expected.map((r) => r.cat_id.toLowerCase()));

  const absent: object[] = [];
  const wrongTab: object[] = [];
  for (const { cat_id, region_id } of expected) {
    const found = onSheet.get(cat_id.toLowerCase());
    if (!found) {
      absent.push({
        cat: cat_id.slice(0, 8),
        effectiveRegion: region_id ? nameOf.get(region_id) : "(none)",
      });
    } else if (region_id && found.regionId !== region_id) {
      wrongTab.push({
        cat: cat_id.slice(0, 8),
        onTab: nameOf.get(found.regionId),
        shouldBeOn: nameOf.get(region_id),
      });
    }
  }

  const orphans = [...onSheet.keys()]
    .filter((u) => !dbIds.has(u))
    .map((u) => ({ uuid: u.slice(0, 8), tab: nameOf.get(onSheet.get(u)!.regionId) }));

  // Col K holds the dropdown's "???" while the DB recorded a concrete value.
  // This is how the known mis-recorded cat is found.
  const unknownK: object[] = [];
  for (const [uuid, { regionId, colK }] of onSheet) {
    if (colK !== "???") continue;
    const [row] = await db
      .select({ is_adoptable: cats.is_adoptable })
      .from(cats)
      .where(eq(cats.id, uuid));
    if (row && row.is_adoptable !== null) {
      unknownK.push({
        cat: uuid.slice(0, 8),
        tab: nameOf.get(regionId),
        colK,
        db_is_adoptable: row.is_adoptable,
      });
    }
  }

  console.log(`\nSheet UUIDs: ${onSheet.size}   Original cats: ${expected.length}\n`);
  console.log("=== Original cats on NO tab ==="); console.table(absent);
  console.log("=== Cats on the WRONG tab ==="); console.table(wrongTab);
  console.log("=== Sheet rows with no Original cat ==="); console.table(orphans);
  console.log("=== col K '???' but DB has a concrete value ==="); console.table(unknownK);

  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
```

- [ ] **Step 2: Run it**

```bash
pnpm tsx scripts/reconcile-sheet.ts
```

Expected before the cron fix is deployed: 6 cats absent from every tab; 1 row with `???` in col K.

- [ ] **Step 3: Verify it wrote nothing**

```bash
grep -n "values.update\|batchUpdate\|values.append\|values.clear\|\.insert(\|\.update(\|\.delete(" scripts/reconcile-sheet.ts
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add scripts/reconcile-sheet.ts
git commit -m "feat(scripts): read-only sheet/DB reconciliation report"
```

---

## Task 8: Health display module

**Files:**
- Create: `lib/health-display.ts`
- Modify: `components/app-pages/database/database-medical-screen.tsx` (~lines 31-38)
- Modify: `components/app-pages/shared/cat-entry-form.tsx` (~lines 50-58)
- Modify: `components/app-pages/sessions/sessions-approval-validation-screen.tsx` (~line 49)
- Test: `__tests__/lib/health-display.test.ts` (create)

**Interfaces:**
- Produces:
  - `type TriState = "yes" | "no" | "unknown"`
  - `neuteredState(value: boolean | null | undefined): TriState`
  - `conditionFlags(condition: string | null | undefined): { sick: TriState; injured: TriState }`
  - `triStateLabel(state: TriState): string` — `"Yes" | "No" | "Unknown"`
  - `triStateToValue(label: string): boolean | null`
  - `triStateTone(state: TriState): BadgeTone`

**Background.** `neuteredToLabel` / `neuteredToValue` exist as **three separate copies**. The catalog would have been a fourth. Same consolidation `formatDate` and `monthsSince` already received.

- [ ] **Step 1: Write the failing tests**

```ts
import {
  neuteredState, conditionFlags, triStateLabel, triStateToValue, triStateTone,
} from "@/lib/health-display";

describe("neuteredState", () => {
  it.each([[true, "yes"], [false, "no"], [null, "unknown"], [undefined, "unknown"]])(
    "%s -> %s", (input, expected) => {
      expect(neuteredState(input as boolean | null | undefined)).toBe(expected);
    });
});

describe("conditionFlags", () => {
  it("Healthy sets neither", () => {
    expect(conditionFlags("Healthy")).toEqual({ sick: "no", injured: "no" });
  });
  it("Sick sets sick only", () => {
    expect(conditionFlags("Sick")).toEqual({ sick: "yes", injured: "no" });
  });
  it("Injured sets injured only", () => {
    expect(conditionFlags("Injured")).toEqual({ sick: "no", injured: "yes" });
  });
  it("Sick and Injured sets both", () => {
    expect(conditionFlags("Sick and Injured")).toEqual({ sick: "yes", injured: "yes" });
  });
  it("null is unknown for both — absence is not a clean bill of health", () => {
    expect(conditionFlags(null)).toEqual({ sick: "unknown", injured: "unknown" });
  });
  it("matches enum values exactly, not by substring", () => {
    // "Not Sick" contains "Sick"; substring matching would wrongly set the flag.
    expect(conditionFlags("Not Sick")).toEqual({ sick: "unknown", injured: "unknown" });
  });
});

describe("triStateLabel / triStateToValue round-trip", () => {
  it.each(["yes", "no", "unknown"] as const)("%s round-trips", (state) => {
    expect(neuteredState(triStateToValue(triStateLabel(state)))).toBe(state);
  });
});

describe("triStateTone", () => {
  it("yes is affirmative, no is muted, unknown is unknown", () => {
    expect(triStateTone("yes")).toBe("affirmative");
    expect(triStateTone("no")).toBe("muted");
    expect(triStateTone("unknown")).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm jest __tests__/lib/health-display.test.ts
```

- [ ] **Step 3: Implement**

```ts
import { CATHEALTHRECORD_CONDITION_VALUES } from "@/lib/db/enums";

export type TriState = "yes" | "no" | "unknown";

/**
 * Declared here, not in the badge component, so both this module and
 * lib/vaccination.ts can map their own states to a tone without importing a
 * component — and so the badge imports from lib/, never the reverse.
 */
export type BadgeTone = "affirmative" | "muted" | "unknown";

export function triStateLabel(state: TriState): string {
  return state === "yes" ? "Yes" : state === "no" ? "No" : "Unknown";
}

export function triStateToValue(label: string): boolean | null {
  return label === "Yes" ? true : label === "No" ? false : null;
}

export function triStateTone(state: TriState): BadgeTone {
  return state === "yes" ? "affirmative" : state === "no" ? "muted" : "unknown";
}

export function neuteredState(value: boolean | null | undefined): TriState {
  return value === true ? "yes" : value === false ? "no" : "unknown";
}

/**
 * `condition` is a single enum whose four values exhaustively cover both
 * booleans, so "Healthy" is a positively recorded "not sick, not injured" —
 * not an inference from absence. Only null is genuinely unknown.
 *
 * Compared exactly rather than by substring: the previous `.includes("Sick")`
 * coupled display logic to enum spelling, so a renamed value or anything
 * containing the word would break it with no type error.
 */
export function conditionFlags(
  condition: string | null | undefined,
): { sick: TriState; injured: TriState } {
  const known = (CATHEALTHRECORD_CONDITION_VALUES as readonly string[]).includes(
    condition ?? "",
  );
  if (!known) return { sick: "unknown", injured: "unknown" };
  return {
    sick: condition === "Sick" || condition === "Sick and Injured" ? "yes" : "no",
    injured: condition === "Injured" || condition === "Sick and Injured" ? "yes" : "no",
  };
}
```

`BadgeTone` is declared here rather than in the badge component so the import
direction is one-way: components import from `lib/`, never the reverse. `lib/vaccination.ts`
imports it from here too.

- [ ] **Step 4: Migrate the three duplicates**

In each of `database-medical-screen.tsx`, `cat-entry-form.tsx`, and `sessions-approval-validation-screen.tsx`, delete the local `neuteredToLabel` / `neuteredToValue` and import from `@/lib/health-display`:

```ts
import { neuteredState, triStateLabel, triStateToValue } from "@/lib/health-display";
```

Replace `neuteredToLabel(x)` with `triStateLabel(neuteredState(x))` and `neuteredToValue(s)` with `triStateToValue(s)`. Verify each local copy produced the same three strings before swapping — if any used different wording, that is a behaviour change to report, not to silently adopt.

- [ ] **Step 5: Verify**

```bash
pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint
```

- [ ] **Step 6: Commit**

```bash
git add lib/health-display.ts components/ __tests__/lib/health-display.test.ts
git commit -m "feat(health): one tri-state display module

neuteredToLabel/Value existed in three copies; the catalog would have been a
fourth. conditionFlags compares enum values exactly instead of substring-matching
'Sick', which coupled display logic to spelling."
```

---

## Task 9: The tri-state badge and the vaccination label

**Files:**
- Create: `components/app-pages/shared/health-badge.tsx`
- Modify: `lib/vaccination.ts` (`VACCINATION_LABELS`, add `vaccinationTone`)
- Test: `__tests__/lib/vaccination.test.ts` (extend)

**Interfaces:**
- Consumes: `BadgeTone` from `lib/health-display.ts` (Task 8).
- Produces: `HealthBadge({ label, tone }: { label: string; tone: BadgeTone })`; `vaccinationTone(state: VaccinationState): BadgeTone`

**Background.** The badge takes a **label and a tone**, not a state type, because the rows do not share one vocabulary: Neutered/Sick/Injured are `TriState`, Vaccinated is `VaccinationState`. Forcing one enum would mean inventing a union fitting neither.

`Expired` shares the muted tone with `No` deliberately — never red. The data cannot support a clinical alarm.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/lib/vaccination.test.ts`:

```ts
import { VACCINATION_LABELS, VACCINATION_FILTER_OPTIONS, vaccinationTone } from "@/lib/vaccination";

describe("vaccination labels read as answers to the row", () => {
  it("vaccinated reads Yes, matching Neutered's Yes", () => {
    expect(VACCINATION_LABELS).toEqual({
      unknown: "Unknown", vaccinated: "Yes", expired: "Expired",
    });
  });

  it("filter options follow the labels", () => {
    expect([...VACCINATION_FILTER_OPTIONS]).toEqual(["Yes", "Expired", "Unknown"]);
  });
});

describe("vaccinationTone", () => {
  it("expired is muted, never an alarm — the data cannot support a clinical claim", () => {
    expect(vaccinationTone("expired")).toBe("muted");
  });
  it("vaccinated is affirmative and unknown is unknown", () => {
    expect(vaccinationTone("vaccinated")).toBe("affirmative");
    expect(vaccinationTone("unknown")).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm jest __tests__/lib/vaccination.test.ts
```

- [ ] **Step 3: Implement**

In `lib/vaccination.ts`:

```ts
export const VACCINATION_LABELS: Record<VaccinationState, string> = {
  unknown: "Unknown",
  vaccinated: "Yes",
  expired: "Expired",
};

import type { BadgeTone } from "@/lib/health-display";

/** `expired` is muted, not alarmed — see the spec's neutrality constraint. */
export function vaccinationTone(state: VaccinationState): BadgeTone {
  return state === "vaccinated"
    ? "affirmative"
    : state === "expired"
      ? "muted"
      : "unknown";
}
```

Create `components/app-pages/shared/health-badge.tsx`:

```tsx
import type { BadgeTone } from "@/lib/health-display";

const TONE_CLASSES: Record<BadgeTone, string> = {
  affirmative: "bg-brand-green/12 text-brand-green",
  muted: "bg-brand-dark/8 text-brand-dark/50",
  unknown: "bg-brand-dark/5 text-brand-dark/40",
};

/**
 * Takes a label and a tone rather than a state, because the health rows do not
 * share one vocabulary — Neutered/Sick/Injured are yes/no/unknown while
 * Vaccinated is unknown/vaccinated/expired. Each domain module maps its own
 * states to a tone.
 */
export function HealthBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-bold tracking-wide ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Verify**

```bash
pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint
```

The database-list filter option changes from `Vaccinated` to `Yes` automatically, since `VACCINATION_FILTER_OPTIONS` derives from the labels. Filters do not persist (no localStorage, no URL state), so no stale saved value can break.

- [ ] **Step 5: Commit**

```bash
git add components/app-pages/shared/health-badge.tsx lib/vaccination.ts __tests__/lib/vaccination.test.ts
git commit -m "feat(health): tri-state badge; vaccination reads Yes

Expired shares the muted tone with No — never red. The badge takes a label and
a tone because the four rows do not share one state vocabulary."
```

---

## Task 10: Correct the catalog's four health rows

**Files:**
- Modify: `components/app-pages/catalog/catalog-detail-screen.tsx` (lines ~33 `YesNoBadge`, ~65 derivations, ~83-100 `healthFields`)

**Interfaces:**
- Consumes: `neuteredState`, `conditionFlags`, `triStateLabel`, `triStateTone` (Task 8); `HealthBadge` (Task 9); `getVaccinationState`, `VACCINATION_LABELS`, `vaccinationTone` (Task 9).

**Background.** This is the outward-facing half. `catalog-detail-screen.tsx:65` is the **only** place in the codebase deriving neutering from `neuter_date`; everything else uses `is_neutered`. **29 of 63 adoptable cats (46%) currently display "No" while genuinely being neutered.**

- [ ] **Step 1: Replace the derivations**

```tsx
  const neutered = neuteredState(healthRecord?.is_neutered);
  const { sick, injured } = conditionFlags(healthRecord?.condition);
  const vaccinationState = getVaccinationState(healthRecord?.vaccination_date ?? null);
```

Delete `isNeutered`, `isSick`, and `isInjured`.

- [ ] **Step 2: Replace the rows**

```tsx
  const healthFields: { label: string; value: React.ReactNode }[] = [
    {
      label: "Neutered",
      value: <HealthBadge label={triStateLabel(neutered)} tone={triStateTone(neutered)} />,
    },
    {
      label: "Vaccinated",
      value: (
        <HealthBadge
          label={VACCINATION_LABELS[vaccinationState]}
          tone={vaccinationTone(vaccinationState)}
        />
      ),
    },
    {
      label: "Sick",
      value: <HealthBadge label={triStateLabel(sick)} tone={triStateTone(sick)} />,
    },
    {
      label: "Injured",
      value: <HealthBadge label={triStateLabel(injured)} tone={triStateTone(injured)} />,
    },
  ];
```

- [ ] **Step 3: Delete the local `YesNoBadge`**

Remove the function at ~line 33. Confirm nothing else in the file uses it:

```bash
grep -n "YesNoBadge" components/app-pages/catalog/catalog-detail-screen.tsx
```

- [ ] **Step 4: Verify**

```bash
pnpm tsc --noEmit && pnpm jest __tests__ && pnpm lint && pnpm build
```

`pnpm build` matters — this is a server component, so an accidental client-only usage surfaces as a build error rather than a type error. The build has a known intermittent 60-second timeout on `/dashboard/admin` from connection-pool exhaustion; if you hit that specific failure it is pre-existing, so re-run once and report.

- [ ] **Step 5: Commit**

```bash
git add components/app-pages/catalog/catalog-detail-screen.tsx
git commit -m "fix(catalog): health rows read the authoritative fields

Neutering was derived from neuter_date — the only place in the codebase that
did — so 29 of 63 adoptable cats displayed No while genuinely neutered. Sick and
Injured now distinguish an unrecorded condition from a recorded negative, and
every row keeps its badge in all states."
```

---

## Final Verification

- [ ] **Full gate**

```bash
pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint && pnpm build
```

- [ ] **Manual checks** (from the spec's Testing section)

1. Run `scripts/reconcile-sheet.ts` — confirm it reports the six known cats.
2. Run one cron tick; re-run the script — confirm zero drift and that the six rows now exist on their region tabs with fresh catalog numbers.
3. Compare the sheet's `HOME` total against the app's Overview — confirm they agree.
4. Delete a row by hand; run a tick — confirm it is restored and an alert names it.
5. Set a cat's column L status instead — confirm it leaves the active census with no restoration and no alert.
6. Freeze sync, delete a row, run a tick — confirm nothing is restored.
7. Open a cat that is neutered without a `neuter_date` in the public catalog — confirm it reads `Yes`.
8. Open the one cat with a null `condition` — confirm Sick and Injured both read `Unknown`, not `No`.
9. Confirm every health row keeps its badge in all states, including `Expired`.
10. Clear col I for one cat, run a tick — confirm its condition becomes unknown rather than `Healthy`, then restore the value.
11. Confirm the five fostered cats no longer appear on For RI and no longer read `Healthy & Adoptable` in col V.
12. Select `???` in col K for a test cat, then run **two** ticks — confirm col K still reads `???` and the database holds `null`, rather than collapsing to `NO`/`false`. One tick is not enough; the corruption this guards against appears on the second.
13. **One-time correction:** find the single existing row with `???` in col K (Task 7's script reports it) and set that cat's `is_adoptable` to `null`. Fixing the parser does not retroactively repair it — reverse sync only re-imports rows carrying a col-W edit timestamp.
