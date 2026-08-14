# P3 — Sync Killswitch & Storage Gauge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app a permanent, deliberate way to retire its Google Sheets sync, and give non-technical stewards self-serve visibility into photo storage with automated orphan cleanup.

**Architecture:** Retirement is a `sync_retired` key in the existing `system_config` table, honoured by the same two gates that honour `sync_frozen` but never cleared by Unfreeze. `/api/cron/sync` short-circuits at the route entry when retired. Retiring writes the flag *first*, then releases the service-account-owned column protections best-effort, so the switch fires even when Sheets access is already broken. Separately, a Photo Storage card reads `storage.objects` through a declared foreign schema, and the existing reference-aware orphan GC runs weekly from the cron tick behind a timestamp guard.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Drizzle ORM, Zod 4, next-safe-action 8, Tailwind 4, Jest (node env), Google Sheets API.

**Spec:** [`docs/specs/2026-08-14-sync-killswitch-storage-gauge-design.md`](../specs/2026-08-14-sync-killswitch-storage-gauge-design.md)

## Global Constraints

- **pnpm only.** Never `npm`. Type-check with `pnpm tsc --noEmit`; test with `pnpm jest __tests__`; lint with `pnpm lint <paths>`.
- **Never run `pnpm dev` to verify.** Trust the code plus the type-checker and tests.
- **Schema changes use `pnpm drizzle-kit push`** — never generate/migrate. **This project introduces no table of its own**: `storage.objects` is a Supabase-managed table that is only *declared* so Drizzle can read it. **Do not run `drizzle-kit push` in this project** — pushing a declaration of a platform-owned table risks Drizzle trying to alter it.
- **New code must never call `db.*` from a service.** All new DB access goes through `lib/repo/`. `system.service.ts`, `helper.service.ts`, `reverse-sync.service.ts`, `sync-cron.service.ts` and `photo-import.service.ts` already violate this for pre-existing reasons — **leave those calls alone**; only new code follows the rule.
- **All Google Sheets calls go through the paced/retried wrapper** (`connectToSheets()` → `glSheets`). Never call `google.sheets()` directly — API quota is the binding constraint.
- **Never hardcode hex brand values in components** — use brand tokens (`bg-brand-dark`, `text-brand-dark`, `bg-brand-orange`, `text-brand-green`, …). Tailwind's `red-*` / `amber-*` scales for warning and error states are the established convention and are fine.
- **Do not write setState patterns that cascade renders.**
- **UI is not unit-tested in this codebase** (`testEnvironment: "node"`, no component tests). For UI tasks verification is `pnpm tsc --noEmit` + `pnpm lint` + the suite staying green. **Never add React Testing Library.**
- **Any error raised while a modal is open must render inside that modal**, never behind its scrim.
- Mobile/desktop are sibling JSX branches (`tablet:hidden` / `hidden tablet:block`); mobile must never use `min-h-screen`.
- Pre-existing whole-repo lint noise (2 errors, 3 warnings in `reverse-sync.service.ts`, `scripts/find-suffix-drift.ts`, `workers/sync-cron/src/index.ts`) is out of scope. Do not fix it; do not let it confuse verification.

## The import cycle — read before writing any service code

`lib/services/helper.service.ts:19` and `lib/services/reverse-sync.service.ts:18` **both import from `./system.service`**. Therefore:

- `isSyncRetired` and `getSyncHalt` **must live in `system.service.ts`** — the file those two already import from. No cycle.
- `releaseSystemColProtections` **must live in `helper.service.ts`** — it needs `connectToSheets`, `CONFIG_SPREADSHEET_ID` and the `SYS_COL_*` constants that are private to that file.
- `retireSync` needs *both*, so it **must live in a new `lib/services/retirement.service.ts`**. Putting it in `system.service.ts` would make `system.service → helper.service → system.service` — a cycle that fails at import time, not at type-check.

## Task Order & Dependencies

```
Task 1  sync_retired flag + both sync gates       (repo, system.service, 2 gates)  independent
Task 2  cron route short-circuit                  (api route)                      needs 1
Task 3  releaseSystemColProtections + retireSync   (helper.service, retirement.service) needs 1
Task 4  Retire action + admin UI                   (actions, gsheet-config, page)   needs 3
Task 5  storage schema + repo + service            (schema, repo, service, constants) independent
Task 6  Photo Storage card                         (component, admin-screen, page)   needs 5
Task 7  weekly GC in the cron route                (system.service, api route)       needs 5
Task 8  decommission runbook                       (docs)                            independent
```

Tasks 4 and 6 both touch `app/(protected)/dashboard/admin/page.tsx`, and Tasks 2 and 7 both touch `app/api/cron/sync/route.ts` — neither pair may run concurrently. Task 7 writes `last_photo_gc_at`, which Task 6 renders, so run 6 before 7.

---

### Task 1: `sync_retired` flag and the sync gates

**Files:**
- Modify: `lib/repo/system.repo.ts`
- Modify: `lib/services/system.service.ts`
- Modify: `lib/services/helper.service.ts` (the gate in `syncAndCompactRegion`, around line 289)
- Modify: `lib/services/reverse-sync.service.ts` (the gate in the reverse-sync entry, around line 296)
- Create: `__tests__/services/sync-retirement.test.ts`

**Interfaces:**
- Produces, consumed by Tasks 2, 3, 7:
  - `findSystemConfigByKey(key: string, client?)` from `@/lib/repo/system.repo`, returning the row or `undefined`
  - `isSyncRetired(): Promise<boolean>` from `@/lib/services/system.service`
  - `setSyncRetired(): Promise<void>` from `@/lib/services/system.service`
  - `getSyncHalt(): Promise<"frozen" | "retired" | null>` from `@/lib/services/system.service`

**Background:** `isSyncFrozen()` is consulted in exactly two places — `helper.service.ts` (forward sync) and `reverse-sync.service.ts` (reverse import). Retirement reuses those checkpoints but not the flag: `unfreezeSync()` clears `sync_frozen`, and if retirement shared that key one click on a button built for the routine "a tick failed, resume it" case would resurrect sync onto sheets the org may have hand-edited for months.

`getSyncHalt` checks retired **first** because retirement is terminal — if both are somehow set, the honest answer is "retired".

**On the key string.** `"sync_retired"` is written as a literal in `system.service.ts` and **nowhere else** — exactly as `"sync_frozen"` already is across `isSyncFrozen` / `setSyncFrozen` / `getSyncFreezeReason`. That is why this task ships `setSyncRetired()` alongside the reader even though nothing calls it until Task 3: the alternative was for `retirement.service.ts` to spell the key itself, and a typo there would fail **silently** — the write lands under a misspelled key, the read finds nothing, and the killswitch quietly does nothing. Keeping one file as the key's sole owner removes that failure mode without introducing a constant.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/sync-retirement.test.ts`:

```ts
jest.mock("@/lib/repo/system.repo", () => ({
  findSystemConfig: jest.fn(),
  findSystemConfigByKey: jest.fn(),
  upsertSystemConfig: jest.fn(),
  deleteSystemConfigKey: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  db: {
    query: { systemConfig: { findFirst: jest.fn() } },
    transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb({})),
  },
  Transaction: class {},
}));

import {
  isSyncRetired,
  setSyncRetired,
  getSyncHalt,
} from "@/lib/services/system.service";
import * as systemRepo from "@/lib/repo/system.repo";
import { db } from "@/lib/db";

const mockRepo = systemRepo as jest.Mocked<typeof systemRepo>;
const mockDb = db as unknown as {
  query: { systemConfig: { findFirst: jest.Mock } };
};

/** The legacy sync_frozen read still goes through db.query directly. */
function setFrozen(frozen: boolean) {
  mockDb.query.systemConfig.findFirst.mockResolvedValue(
    frozen ? { key: "sync_frozen", value: "true" } : undefined,
  );
}

function setRetired(retired: boolean) {
  mockRepo.findSystemConfigByKey.mockResolvedValue(
    (retired
      ? { key: "sync_retired", value: "true" }
      : undefined) as never,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  setFrozen(false);
  setRetired(false);
});

describe("isSyncRetired", () => {
  it("is false when the row is absent", async () => {
    await expect(isSyncRetired()).resolves.toBe(false);
  });

  it("is true when the row is set", async () => {
    setRetired(true);
    await expect(isSyncRetired()).resolves.toBe(true);
  });

  it("is false when the row holds anything other than \"true\"", async () => {
    mockRepo.findSystemConfigByKey.mockResolvedValue({
      key: "sync_retired",
      value: "false",
    } as never);
    await expect(isSyncRetired()).resolves.toBe(false);
  });
});

describe("setSyncRetired", () => {
  it("writes the flag under the same key isSyncRetired reads", async () => {
    await setSyncRetired();

    expect(mockRepo.upsertSystemConfig).toHaveBeenCalledWith(
      "sync_retired",
      "true",
    );
  });
});

describe("getSyncHalt", () => {
  it("returns null when neither flag is set", async () => {
    await expect(getSyncHalt()).resolves.toBeNull();
  });

  it("returns 'frozen' when only frozen", async () => {
    setFrozen(true);
    await expect(getSyncHalt()).resolves.toBe("frozen");
  });

  it("returns 'retired' when only retired", async () => {
    setRetired(true);
    await expect(getSyncHalt()).resolves.toBe("retired");
  });

  it("prefers 'retired' when both are set — retirement is terminal", async () => {
    setFrozen(true);
    setRetired(true);
    await expect(getSyncHalt()).resolves.toBe("retired");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest __tests__/services/sync-retirement.test.ts`
Expected: FAIL — `isSyncRetired is not a function`.

- [ ] **Step 3: Add the single-key repo read**

In `lib/repo/system.repo.ts`, below `findSystemConfig`:

```ts
/** One system_config row by key, or undefined. */
export const findSystemConfigByKey = (key: string, client: DB = db) =>
  client.query.systemConfig.findFirst({
    where: (cols, { eq }) => eq(cols.key, key),
  });
```

- [ ] **Step 4: Add `isSyncRetired`, `setSyncRetired` and `getSyncHalt` to the service**

`systemRepo` is already imported here by the P2 link functions, so no new import is needed. Append:

```ts
/**
 * system_config key marking sync permanently retired.
 *
 * Written as a literal here and NOWHERE else, exactly as "sync_frozen" is —
 * this file is the key's sole owner. If another module spelled it too, a typo
 * would fail silently: the write lands under a misspelled key, the read finds
 * nothing, and the killswitch quietly does nothing.
 *
 * Deliberately NOT the same key as sync_frozen: that one is a temporary,
 * error-triggered pause with an "Unfreeze" button built to undo it.
 * Retirement must survive that button.
 */
const SYNC_RETIRED_KEY = "sync_retired";

/** True when sync has been permanently retired. */
export async function isSyncRetired(): Promise<boolean> {
  const row = await systemRepo.findSystemConfigByKey(SYNC_RETIRED_KEY);
  return row?.value === "true";
}

/**
 * Marks sync permanently retired.
 *
 * One-way by design — there is deliberately no `clearSyncRetired()`. Recovery
 * means a developer deleting the row by hand, which is the intended friction.
 * Note `unfreezeSync()` must never touch this key.
 */
export async function setSyncRetired(): Promise<void> {
  await systemRepo.upsertSystemConfig(SYNC_RETIRED_KEY, "true");
}

export type SyncHalt = "frozen" | "retired" | null;

/**
 * Why sync must not run, or null if it may. Retirement is checked first
 * because it is terminal — if both flags are somehow set, "retired" is the
 * honest answer.
 */
export async function getSyncHalt(): Promise<SyncHalt> {
  if (await isSyncRetired()) return "retired";
  if (await isSyncFrozen()) return "frozen";
  return null;
}
```

- [ ] **Step 5: Update the forward-sync gate**

In `lib/services/helper.service.ts`, change the import on line 19 from `import { isSyncFrozen } from "./system.service";` to:

```ts
import { getSyncHalt } from "./system.service";
```

and replace the gate at the top of `syncAndCompactRegion`:

```ts
  const halt = await getSyncHalt();
  if (halt) {
    console.log(
      `[Sync] ${halt === "retired" ? "Retired" : "Frozen"} — skipping region ${regionId}`,
    );
    return null;
  }
```

- [ ] **Step 6: Update the reverse-sync gate**

In `lib/services/reverse-sync.service.ts`, change the import on line 18 to:

```ts
import { getSyncHalt } from "./system.service";
```

and replace the gate:

```ts
  const halt = await getSyncHalt();
  if (halt) {
    console.log(
      `[ReverseSync] ${halt === "retired" ? "Retired" : "Frozen"} — skipping all regions`,
    );
    return { regionsProcessed: 0, totalImported: 0, totalErrors: 0 };
  }
```

- [ ] **Step 7: Confirm no `isSyncFrozen` import remains in the two gate files**

Run: `grep -n "isSyncFrozen" lib/services/helper.service.ts lib/services/reverse-sync.service.ts`
Expected: no output. `isSyncFrozen` itself stays exported from `system.service.ts` — `app/actions/system.ts` still uses it for the status display. Leaving a stale import would not fail `tsc` (`noUnusedLocals` is off) but eslint would flag it.

- [ ] **Step 8: Run the test, the full suite, type-check and lint**

Run: `pnpm jest __tests__/services/sync-retirement.test.ts && pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint lib/repo/system.repo.ts lib/services/system.service.ts lib/services/helper.service.ts __tests__/services/sync-retirement.test.ts`
Expected: 8 new tests PASS; all suites PASS (21 suites / 191 tests before this task, so 22 / 199 after); tsc exit 0; zero lint warnings on those paths. **Do not** lint `reverse-sync.service.ts` — it carries a pre-existing warning.

- [ ] **Step 9: Commit**

```bash
git add lib/repo/system.repo.ts lib/services/system.service.ts lib/services/helper.service.ts lib/services/reverse-sync.service.ts __tests__/services/sync-retirement.test.ts
git commit -m "feat(sync): add sync_retired flag honoured by both sync gates

Retirement reuses the freeze checkpoints but not the freeze key: unfreezeSync
clears sync_frozen, so sharing it would let the Unfreeze button — built for a
transient failed tick — resurrect sync onto hand-edited sheets. getSyncHalt
reports retired first because retirement is terminal."
```

---

### Task 2: The cron route short-circuits when retired

**Files:**
- Modify: `app/api/cron/sync/route.ts`
- Modify: `__tests__/services/sync-retirement.test.ts`

**Interfaces:**
- Consumes from Task 1: `isSyncRetired()` from `@/lib/services/system.service`
- Produces: nothing consumed by later tasks

**Background:** `/api/cron/sync` never checks the freeze flag — it authenticates, opens an `after()` block, and calls `syncAllPendingRegions()`, which loads every region from the database before the deeper gates stop anything. So a halted system still costs one Cloudflare invocation, two Vercel invocations and several queries every 20 minutes.

This early return is the only compute saving available *inside* the app. It matters for the window between throwing the switch and someone disabling the Cloudflare trigger — a window that may never close, since that step is manual.

The check goes **after** the `CRON_SECRET` comparison, so an unauthenticated caller still receives 401 rather than learning the system's retirement state.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/services/sync-retirement.test.ts`. Add these mocks to the **top** of the file, beside the existing `jest.mock` calls:

```ts
jest.mock("@/lib/services/sync-cron.service", () => ({
  syncAllPendingRegions: jest.fn(),
}));
jest.mock("@/lib/services/discord.service", () => ({
  sendSyncAlert: jest.fn(),
}));
jest.mock("next/server", () => ({
  after: (fn: () => unknown) => fn(),
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    }),
  },
}));
```

and append this block at the end of the file:

```ts
import { POST } from "@/app/api/cron/sync/route";
import { syncAllPendingRegions } from "@/lib/services/sync-cron.service";

const mockSync = syncAllPendingRegions as jest.Mock;

/** Minimal stand-in for NextRequest — the route only reads one header. */
function req(token: string | null) {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "authorization" && token
          ? `Bearer ${token}`
          : null,
    },
  } as unknown as Parameters<typeof POST>[0];
}

describe("cron sync route", () => {
  const OLD_SECRET = process.env.CRON_SECRET;

  beforeAll(() => {
    process.env.CRON_SECRET = "test-secret";
  });
  afterAll(() => {
    process.env.CRON_SECRET = OLD_SECRET;
  });

  it("returns 401 for a bad secret EVEN WHEN retired", async () => {
    setRetired(true);

    const res = (await POST(req("wrong"))) as unknown as { status: number };

    expect(res.status).toBe(401);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("short-circuits without running sync when retired", async () => {
    setRetired(true);

    const res = (await POST(req("test-secret"))) as unknown as {
      body: { retired?: boolean };
    };

    expect(res.body.retired).toBe(true);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("runs sync when not retired", async () => {
    setRetired(false);

    await POST(req("test-secret"));

    expect(mockSync).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest __tests__/services/sync-retirement.test.ts`
Expected: FAIL — "short-circuits without running sync when retired" fails because `syncAllPendingRegions` is called anyway and `res.body.retired` is `undefined`.

- [ ] **Step 3: Add the early return**

In `app/api/cron/sync/route.ts`, extend the service import to include `isSyncRetired`:

```ts
import { setSyncFrozen, isSyncRetired } from "@/lib/services/system.service";
```

and insert this immediately **after** the existing 401 block and **before** `after(async () => {`:

```ts
  // Retired systems do no work at all. This sits after the auth check so an
  // unauthenticated caller still gets 401 rather than learning our state, and
  // before after() so a retired tick costs no queries — it may keep firing for
  // years if nobody disables the Cloudflare trigger.
  if (await isSyncRetired()) {
    return NextResponse.json({ ok: true, retired: true });
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm jest __tests__/services/sync-retirement.test.ts`
Expected: PASS, 10 tests (7 from Task 1 + 3 new).

- [ ] **Step 5: Full suite, type-check, lint**

Run: `pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint "app/api/cron/sync/route.ts" __tests__/services/sync-retirement.test.ts`
Expected: all suites PASS, tsc exit 0, zero lint warnings.

- [ ] **Step 6: Commit**

```bash
git add "app/api/cron/sync/route.ts" __tests__/services/sync-retirement.test.ts
git commit -m "feat(sync): short-circuit the cron tick when retired

The route previously authenticated, opened after() and loaded every region
before the deeper gates stopped anything, so a halted system still burned an
invocation and several queries every 20 minutes. The check sits after the
CRON_SECRET comparison so an unauthenticated caller still gets 401."
```

---

### Task 3: `releaseSystemColProtections` and `retireSync`

**Files:**
- Modify: `lib/services/helper.service.ts`
- Create: `lib/services/retirement.service.ts`
- Create: `__tests__/services/retire-sync.test.ts`

**Interfaces:**
- Consumes from Task 1: `setSyncRetired()` from `@/lib/services/system.service`
- Produces, consumed by Task 4:
  - `releaseSystemColProtections(): Promise<{ released: number }>` from `@/lib/services/helper.service`
  - `retireSync(): Promise<{ protectionsReleased: boolean; released: number; error: string | null }>` from `@/lib/services/retirement.service`

**Background — read the cycle note in Global Constraints first.** `helper.service.ts` imports from `system.service.ts`. `retireSync` needs `upsertSystemConfig` *and* `releaseSystemColProtections`, so it goes in a **new** `retirement.service.ts`. Putting it in `system.service.ts` creates `system.service → helper.service → system.service`, which fails at import time rather than at type-check.

`setupSystemColProtections` (around line 938) already clears A and W–Y protections before re-applying, to avoid stacking. `releaseSystemColProtections` is that same delete loop **without** the re-apply.

**Ordering is load-bearing.** The flag is written first, then protections are released best-effort. A decade from now the likeliest reason someone reaches for this button is that Google access has *already* broken — expired credentials, revoked service account, deleted spreadsheet. A killswitch that cannot fire when the thing it kills is already broken is useless.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/retire-sync.test.ts`:

```ts
jest.mock("@/lib/services/system.service", () => ({
  setSyncRetired: jest.fn(),
}));
jest.mock("@/lib/services/helper.service", () => ({
  releaseSystemColProtections: jest.fn(),
}));
jest.mock("@/lib/db", () => ({ db: {}, Transaction: class {} }));

import { retireSync } from "@/lib/services/retirement.service";
import * as systemService from "@/lib/services/system.service";
import * as helper from "@/lib/services/helper.service";

const mockSystem = systemService as jest.Mocked<typeof systemService>;
const mockHelper = helper as jest.Mocked<typeof helper>;

beforeEach(() => {
  jest.clearAllMocks();
  mockSystem.setSyncRetired.mockResolvedValue(undefined as never);
  mockHelper.releaseSystemColProtections.mockResolvedValue({
    released: 4,
  } as never);
});

describe("retireSync", () => {
  it("sets the retirement flag", async () => {
    await retireSync();

    expect(mockSystem.setSyncRetired).toHaveBeenCalled();
  });

  it("sets the flag BEFORE attempting any Sheets call", async () => {
    const order: string[] = [];
    mockSystem.setSyncRetired.mockImplementation((() => {
      order.push("flag");
      return Promise.resolve(undefined);
    }) as never);
    mockHelper.releaseSystemColProtections.mockImplementation((() => {
      order.push("sheets");
      return Promise.resolve({ released: 4 });
    }) as never);

    await retireSync();

    expect(order).toEqual(["flag", "sheets"]);
  });

  it("reports how many protections it released", async () => {
    await expect(retireSync()).resolves.toEqual({
      protectionsReleased: true,
      released: 4,
      error: null,
    });
  });

  it("still succeeds when the protection release throws", async () => {
    mockHelper.releaseSystemColProtections.mockRejectedValue(
      new Error("credentials revoked") as never,
    );

    const result = await retireSync();

    expect(result.protectionsReleased).toBe(false);
    expect(result.error).toMatch(/credentials revoked/);
  });

  it("keeps the flag set even when the Sheets call throws", async () => {
    mockHelper.releaseSystemColProtections.mockRejectedValue(
      new Error("spreadsheet deleted") as never,
    );

    await retireSync();

    // The whole point: retirement must survive already-broken Sheets access.
    expect(mockSystem.setSyncRetired).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest __tests__/services/retire-sync.test.ts`
Expected: FAIL — cannot find module `@/lib/services/retirement.service`.

- [ ] **Step 3: Add `releaseSystemColProtections` to `helper.service.ts`**

Directly **below** `setupSystemColProtections` (which ends around line 1018 with its `batchUpdate` block), append:

```ts
/**
 * Removes the A and W–Y protections from every region sheet, leaving no
 * replacements.
 *
 * Used by retirement. Those protections are owned by the service account and
 * exist to stop humans editing system-managed columns — after retirement
 * nothing manages them, so leaving them in place would hand stewards a
 * spreadsheet with four locked columns and no app to unlock them.
 *
 * This is setupSystemColProtections' delete loop without the re-apply.
 */
export async function releaseSystemColProtections(): Promise<{
  released: number;
}> {
  const regions = await db.query.regions.findMany();
  const regionNames = new Set<string>(regions.map((r) => r.name));

  const { glAuth, glSheets } = await connectToSheets();

  const spreadsheet = await glSheets.spreadsheets.get({
    auth: glAuth,
    spreadsheetId: CONFIG_SPREADSHEET_ID,
    fields: "sheets(properties(sheetId,title),protectedRanges)",
  });

  const requests: object[] = [];

  for (const sheet of spreadsheet.data.sheets ?? []) {
    const title = sheet.properties?.title ?? "";
    if (!regionNames.has(title)) continue;

    for (const pr of sheet.protectedRanges ?? []) {
      const range = pr.range;
      const isColA =
        range?.startColumnIndex === SYS_COL_A_START &&
        range?.endColumnIndex === SYS_COL_A_END;
      const isColWY =
        range?.startColumnIndex === SYS_COL_WY_START &&
        range?.endColumnIndex === SYS_COL_WY_END;
      if (isColA || isColWY) {
        requests.push({
          deleteProtectedRange: { protectedRangeId: pr.protectedRangeId },
        });
      }
    }
  }

  if (requests.length > 0) {
    await glSheets.spreadsheets.batchUpdate({
      auth: glAuth,
      spreadsheetId: CONFIG_SPREADSHEET_ID,
      requestBody: { requests },
    });
  }

  return { released: requests.length };
}
```

This uses `db.query.regions` directly, matching the surrounding function. That is a pre-existing layering violation in this file which the project explicitly leaves alone — do **not** "fix" it here, and do not introduce it anywhere new.

- [ ] **Step 4: Create `lib/services/retirement.service.ts`**

```ts
import { setSyncRetired } from "@/lib/services/system.service";
import { releaseSystemColProtections } from "@/lib/services/helper.service";

/**
 * Permanently retires the Google Sheets sync.
 *
 * Lives in its own module rather than system.service.ts on purpose:
 * helper.service.ts imports from system.service.ts, so importing
 * releaseSystemColProtections there would create a runtime import cycle.
 *
 * Note this module never names the system_config key — setSyncRetired owns it.
 * Spelling it here too would risk a silent typo: the write would land under a
 * misspelled key and isSyncRetired would keep returning false.
 *
 * The flag is written FIRST and the Sheets call is best-effort. A decade from
 * now the likeliest reason to reach for this button is that Google access has
 * already broken — a killswitch that cannot fire when the thing it kills is
 * already broken would be useless.
 */
export async function retireSync(): Promise<{
  protectionsReleased: boolean;
  released: number;
  error: string | null;
}> {
  await setSyncRetired();

  try {
    const { released } = await releaseSystemColProtections();
    return { protectionsReleased: true, released, error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Sheets error";
    console.error("[RetireSync] Protection release failed:", message);
    return { protectionsReleased: false, released: 0, error: message };
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm jest __tests__/services/retire-sync.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Full suite, type-check, lint**

Run: `pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint lib/services/retirement.service.ts lib/services/helper.service.ts __tests__/services/retire-sync.test.ts`
Expected: all suites PASS, tsc exit 0, zero lint warnings.

- [ ] **Step 7: Commit**

```bash
git add lib/services/retirement.service.ts lib/services/helper.service.ts __tests__/services/retire-sync.test.ts
git commit -m "feat(sync): retireSync writes the flag then releases sheet protections

releaseSystemColProtections is setupSystemColProtections' delete loop without
the re-apply — after retirement nothing manages cols A and W-Y, so leaving them
protected would strand stewards with locked columns and no app to unlock them.

retireSync lives in its own module because helper.service imports from
system.service; putting it there would create a runtime import cycle. The flag
is written before the Sheets call so retirement survives already-broken access."
```

---

### Task 4: Retire action and admin UI

**Files:**
- Modify: `app/actions/system.ts`
- Modify: `components/app-pages/admin/gsheet-config-controls.tsx`
- Modify: `app/(protected)/dashboard/admin/page.tsx`

**Interfaces:**
- Consumes from Task 3: `retireSync()` from `@/lib/services/retirement.service`
- Consumes from Task 1: `isSyncRetired()` from `@/lib/services/system.service`
- Produces: `getSyncStatus()` return type gains `retired: boolean`; `GSheetConfigControls`' `initialStatus` prop gains `retired: boolean`

**Background:** `app/actions/system.ts` mixes two styles — plain exported `async function`s calling `requireRole` directly (`provisionSheets`, `seedSheetUuids`, `unfreezeSync`, `reclaimOrphanedPhotos`, `getSyncStatus`) and next-safe-action `actionClient` actions added by P2. `retireSyncAction` takes **no input**, so there is no schema to validate; follow the **plain-function** style of its siblings in the sync group it belongs to.

`GSheetConfigControls` receives `initialStatus` from `admin/page.tsx`, which builds it inside its `Promise.all`.

- [ ] **Step 1: Add the action and extend the status**

In `app/actions/system.ts`, add the import:

```ts
import { retireSync } from "@/lib/services/retirement.service";
```

extend the `system.service` import to include `isSyncRetired`, then append:

```ts
/**
 * Permanently retires the Sheets sync. There is no undo in the UI — a
 * developer can clear the system_config row, but no steward-facing control
 * does. Deliberate: this is expected to happen once, ever.
 */
export async function retireSyncAction() {
  await requireRole(...ADMIN_ONLY);
  return await retireSync();
}
```

and change `getSyncStatus` so it also reports retirement:

```ts
export async function getSyncStatus() {
  const frozen = await isSyncFrozen();
  const retired = await isSyncRetired();
  return {
    frozen,
    reason: frozen ? await getSyncFreezeReason() : null,
    retired,
  };
}
```

- [ ] **Step 2: Seed `retired` from the admin page**

In `app/(protected)/dashboard/admin/page.tsx`, the sync-status entry of the `Promise.all` currently builds `{ frozen, reason }` and its fallback is `{ frozen: null, reason: null }`. Add `retired` to both. Update the `InitialSyncStatus` type at the top of the file:

```tsx
type InitialSyncStatus = {
  frozen: boolean | null;
  reason: string | null;
  retired: boolean;
};
```

In the loader body add `import { isSyncRetired } from "@/lib/services/system.service";` to the existing service import, return `retired` alongside `frozen` and `reason`, and change the fallback to:

```tsx
      {
        frozen: null,
        reason: null,
        retired: false,
      },
```

The fallback is `false`, not `null`: if the status read fails we must not render a retirement banner the system may not actually be in.

- [ ] **Step 3: Accept and render retirement in `GSheetConfigControls`**

In `components/app-pages/admin/gsheet-config-controls.tsx`, extend the import to include `retireSyncAction`, extend the props type:

```tsx
type GSheetConfigControlsProps = {
  initialStatus: {
    frozen: boolean | null;
    reason: string | null;
    retired: boolean;
  };
};
```

add state beside the existing `frozen` / `reason`:

```tsx
  const [retired, setRetired] = useState(initialStatus.retired);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [typed, setTyped] = useState("");
```

Then in the "Sync status" block, replace the status chip expression so retirement wins:

```tsx
            {retired ? (
              <span className="rounded-full bg-brand-dark px-2 py-0.5 text-[11px] font-semibold text-white">
                Retired
              </span>
            ) : frozen !== null ? (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${frozen ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                {frozen ? "Frozen" : "Active"}
              </span>
            ) : null}
```

and wrap the existing explanatory paragraph plus the Unfreeze button so neither renders once retired:

```tsx
          {retired ? (
            <p className="text-xs text-brand-dark/55">
              Sync is permanently retired. The spreadsheet is no longer written
              to and its system columns have been unlocked for manual editing.
            </p>
          ) : (
            <>
              {/* the existing "Unfreezing runs a full reverse sync…" paragraph,
                  the Unfreeze button, and its results.unfreeze block, unchanged */}
            </>
          )}
```

Hiding Unfreeze is the point of the whole design: it is a control built to undo a *transient* failure, and one click on it must not be able to resurrect sync onto sheets the org has hand-edited for months.

- [ ] **Step 4: Add the Retire section**

At the **end** of the card, after the "Reclaim orphaned photos" block and its preceding `<div className="border-t border-border" />`, add:

```tsx
        {!retired && (
          <>
            <div className="border-t border-border" />
            <div className="px-4 py-3">
              <p className="mb-0.5 text-sm font-semibold text-red-600">
                Retire sync
              </p>
              <p className="mb-2 text-xs text-brand-dark/55">
                Permanently stops all writes to the spreadsheet and unlocks its
                system columns for manual editing. The app keeps working on its
                own database. <strong>This cannot be undone from here.</strong>
              </p>

              {confirmRetire ? (
                <div className="space-y-2">
                  <p className="text-xs text-brand-dark/60">
                    Type <strong>RETIRE</strong> to confirm.
                  </p>
                  <input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoFocus
                    className="h-9 w-full max-w-xs rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-brand-orange/40"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isPending || typed !== "RETIRE"}
                      onClick={() =>
                        run("retire", async () => {
                          const r = await retireSyncAction();
                          setRetired(true);
                          setConfirmRetire(false);
                          setTyped("");
                          return r.protectionsReleased
                            ? `Sync retired. Released ${r.released} column protection${r.released === 1 ? "" : "s"}.`
                            : `Sync retired, but the spreadsheet could not be updated: ${r.error}. Column protections may still need removing by hand.`;
                        })
                      }
                      className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {busy("retire") ? "Retiring…" : "Confirm — retire sync"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setConfirmRetire(false);
                        setTyped("");
                      }}
                      className="rounded-full px-4 py-1.5 text-xs font-bold text-brand-dark/60 disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setConfirmRetire(true)}
                  className="rounded-full border border-red-300 px-4 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                >
                  Retire sync…
                </button>
              )}

              {results.retire && (
                <p className={`mt-2 text-xs ${results.retire.ok ? "text-brand-green" : "text-red-600"}`}>
                  {results.retire.text}
                </p>
              )}
            </div>
          </>
        )}
```

Note the success message distinguishes the two outcomes: retirement always succeeds, but a failed protection release must be reported so someone knows to unlock the columns by hand. The existing `run()` helper already routes thrown errors into `results`.

- [ ] **Step 5: Type-check, lint, test**

Run: `pnpm tsc --noEmit && pnpm jest __tests__ && pnpm lint app/actions/system.ts components/app-pages/admin/gsheet-config-controls.tsx "app/(protected)/dashboard/admin/page.tsx"`
Expected: tsc exit 0, all suites PASS, zero lint warnings.

- [ ] **Step 6: Commit**

```bash
git add app/actions/system.ts components/app-pages/admin/gsheet-config-controls.tsx "app/(protected)/dashboard/admin/page.tsx"
git commit -m "feat(admin): retire sync from the Admin screen

Typed-confirm, Administrator-only, no undo in the UI. Once retired the
Unfreeze button is hidden entirely — it exists to undo a transient failed
tick, and must not be able to resurrect sync onto hand-edited sheets. A failed
protection release is reported rather than swallowed, since someone then has
to unlock those columns by hand."
```

---

### Task 5: Storage schema, repo and service

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/constants.ts`
- Create: `lib/repo/storage.repo.ts`
- Modify: `lib/services/system.service.ts`
- Create: `__tests__/services/storage-usage.test.ts`

**Interfaces:**
- Produces, consumed by Task 6:
  - `storageObjects` table from `@/lib/db/schema`
  - `sumPhotoStorageBytes(client?): Promise<number>` from `@/lib/repo/storage.repo`
  - `getPhotoStorageUsage(): Promise<{ bytes: number | null; capBytes: number }>` from `@/lib/services/system.service`
  - `getLastPhotoGcAt(): Promise<string | null>` from `@/lib/services/system.service`
  - `STORAGE_CAP_BYTES`, `STORAGE_WARN_RATIO`, `STORAGE_CRITICAL_RATIO` from `@/lib/constants`

**Background:** `storage.objects` is a real Postgres table in Supabase's `storage` schema, with byte size in `metadata->>'size'`. The codebase already declares a foreign schema this way — `pgSchema("auth")` at `lib/db/schema.ts:32` for `auth.users` — so this follows an established idiom.

**Do not run `drizzle-kit push` in this project.** `storage.objects` is platform-owned; declaring it lets Drizzle *read* it, and pushing a declaration of a table Supabase manages risks Drizzle attempting to alter it.

The bucket name already exists as `CAT_PHOTOS_BUCKET` in `lib/services/cat-photo-storage.ts` — import it rather than re-declaring the string.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/storage-usage.test.ts`:

```ts
jest.mock("@/lib/repo/storage.repo", () => ({
  sumPhotoStorageBytes: jest.fn(),
}));
jest.mock("@/lib/repo/system.repo", () => ({
  findSystemConfig: jest.fn(),
  findSystemConfigByKey: jest.fn(),
  upsertSystemConfig: jest.fn(),
  deleteSystemConfigKey: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  db: { query: { systemConfig: { findFirst: jest.fn() } } },
  Transaction: class {},
}));

import { getPhotoStorageUsage } from "@/lib/services/system.service";
import * as storageRepo from "@/lib/repo/storage.repo";
import { STORAGE_CAP_BYTES } from "@/lib/constants";

const mockRepo = storageRepo as jest.Mocked<typeof storageRepo>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getPhotoStorageUsage", () => {
  it("returns the summed bytes and the cap", async () => {
    mockRepo.sumPhotoStorageBytes.mockResolvedValue(121_634_816 as never);

    await expect(getPhotoStorageUsage()).resolves.toEqual({
      bytes: 121_634_816,
      capBytes: STORAGE_CAP_BYTES,
    });
  });

  it("reports zero usage as zero, not as unavailable", async () => {
    mockRepo.sumPhotoStorageBytes.mockResolvedValue(0 as never);

    const usage = await getPhotoStorageUsage();

    expect(usage.bytes).toBe(0);
  });

  it("reports null — not zero — when the read fails", async () => {
    mockRepo.sumPhotoStorageBytes.mockRejectedValue(
      new Error("relation does not exist") as never,
    );

    const usage = await getPhotoStorageUsage();

    // Zero would render as a reassuring "0 MB used"; null renders as
    // "Unavailable", which is the truth.
    expect(usage.bytes).toBeNull();
    expect(usage.capBytes).toBe(STORAGE_CAP_BYTES);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest __tests__/services/storage-usage.test.ts`
Expected: FAIL — `getPhotoStorageUsage is not a function`.

- [ ] **Step 3: Add the storage constants**

In `lib/constants.ts`, append:

```ts
/**
 * Supabase free-tier storage cap, in bytes (1 GB).
 *
 * A PLAN limit, not a physical one — if the project ever moves to a paid tier
 * this is wrong and the gauge under-reports headroom. Named and commented for
 * exactly that reason rather than inlined in a component.
 */
export const STORAGE_CAP_BYTES = 1024 * 1024 * 1024;

/** Amber above this share of the cap. From the storage analysis (§7). */
export const STORAGE_WARN_RATIO = 0.8;

/** Red above this share of the cap. From the storage analysis (§7). */
export const STORAGE_CRITICAL_RATIO = 0.92;
```

- [ ] **Step 4: Declare the foreign table**

In `lib/db/schema.ts`, below the existing `const authSchema = pgSchema("auth");` line (around line 32):

```ts
/**
 * Supabase-managed storage catalogue. DECLARED FOR READS ONLY — this table
 * belongs to the platform, not to us. Never include it in a drizzle-kit push;
 * only the columns the storage gauge needs are described here.
 */
const storageSchema = pgSchema("storage");

export const storageObjects = storageSchema.table("objects", {
  id: uuid("id").primaryKey(),
  bucket_id: text("bucket_id"),
  name: text("name"),
  metadata: jsonb("metadata"),
});
```

`jsonb` and `uuid` are already imported at the top of this file; `pgSchema` and `text` likewise.

- [ ] **Step 5: Create `lib/repo/storage.repo.ts`**

```ts
import { eq, sql } from "drizzle-orm";
import { db, type Transaction } from "@/lib/db";
import { storageObjects } from "@/lib/db/schema";
import { CAT_PHOTOS_BUCKET } from "@/lib/services/cat-photo-storage";

type DB = typeof db | Transaction;

/**
 * Total bytes stored in the cat-photos bucket.
 *
 * Supabase records object size in metadata->>'size'. coalesce covers an empty
 * bucket, where sum() returns NULL rather than 0.
 */
export const sumPhotoStorageBytes = async (client: DB = db): Promise<number> => {
  const [row] = await client
    .select({
      bytes: sql<string>`coalesce(sum((${storageObjects.metadata}->>'size')::bigint), 0)::text`,
    })
    .from(storageObjects)
    .where(eq(storageObjects.bucket_id, CAT_PHOTOS_BUCKET));

  return Number(row?.bytes ?? 0);
};
```

The sum is cast to `text` and parsed in JS because `bigint` arrives as a string through node-postgres; selecting it as a number type would silently produce a string at runtime while `tsc` believed otherwise.

- [ ] **Step 6: Add `getPhotoStorageUsage` to the service**

In `lib/services/system.service.ts`, add the imports:

```ts
import * as storageRepo from "@/lib/repo/storage.repo";
import { STORAGE_CAP_BYTES } from "@/lib/constants";
```

(extend the existing `@/lib/constants` import rather than adding a second) and append:

```ts
/**
 * Photo storage usage against the plan cap.
 *
 * A failed read yields null, NOT zero: "0 MB used" reads as reassuring when it
 * actually means we have no idea. The card renders null as "Unavailable".
 */
export async function getPhotoStorageUsage(): Promise<{
  bytes: number | null;
  capBytes: number;
}> {
  try {
    const bytes = await storageRepo.sumPhotoStorageBytes();
    return { bytes, capBytes: STORAGE_CAP_BYTES };
  } catch (error) {
    console.warn(
      `getPhotoStorageUsage: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return { bytes: null, capBytes: STORAGE_CAP_BYTES };
  }
}

/**
 * system_config key holding the last orphan-GC sweep time, ISO 8601.
 *
 * Owned by this file, like sync_frozen and sync_retired. Consumers ask
 * getLastPhotoGcAt() rather than spelling the key, so a typo cannot leave the
 * Admin card reading "never" forever while the sweep runs fine.
 */
const PHOTO_GC_KEY = "last_photo_gc_at";

/** When the automatic orphan sweep last ran, or null if it never has. */
export async function getLastPhotoGcAt(): Promise<string | null> {
  const row = await systemRepo.findSystemConfigByKey(PHOTO_GC_KEY);
  return row?.value ?? null;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm jest __tests__/services/storage-usage.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 8: Full suite, type-check, lint**

Run: `pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint lib/db/schema.ts lib/constants.ts lib/repo/storage.repo.ts lib/services/system.service.ts __tests__/services/storage-usage.test.ts`
Expected: all suites PASS, tsc exit 0, zero lint warnings.

- [ ] **Step 9: Commit**

```bash
git add lib/db/schema.ts lib/constants.ts lib/repo/storage.repo.ts lib/services/system.service.ts __tests__/services/storage-usage.test.ts
git commit -m "feat(storage): read photo storage usage from storage.objects

Declares Supabase's storage.objects for reads only, following the existing
pgSchema(\"auth\") idiom. A failed read reports null rather than zero — zero
would render as a reassuring '0 MB used' when it actually means we do not
know."
```

---

### Task 6: Photo Storage card

**Files:**
- Create: `components/app-pages/admin/storage-gauge.tsx`
- Modify: `components/app-pages/admin/admin-screen.tsx`
- Modify: `app/(protected)/dashboard/admin/page.tsx`

**Interfaces:**
- Consumes from Task 5: `getPhotoStorageUsage()`, `STORAGE_WARN_RATIO`, `STORAGE_CRITICAL_RATIO`
- Produces: `StorageGauge` requiring `usage: { bytes: number | null; capBytes: number }` and `lastCleanupAt: string | null`; `AdminScreen` gains both as props

**Background:** `admin-screen.tsx` renders its config cards in **both** a mobile branch and a desktop branch — `GSheetConfigControls`, `RegionControls`, `LinkControls` and `BugReportsCard` all appear in both. `StorageGauge` joins them in both, after `BugReportsCard`. A single render site still compiles, so Step 4 greps for it.

`lastCleanupAt` is wired now but stays `null` until Task 7 writes `last_photo_gc_at`. The card must render sensibly with `null` from the day it lands.

- [ ] **Step 1: Create `components/app-pages/admin/storage-gauge.tsx`**

```tsx
import {
  STORAGE_WARN_RATIO,
  STORAGE_CRITICAL_RATIO,
} from "@/lib/constants";

function formatMb(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function formatDate(iso: string | null) {
  if (!iso) return "never";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()}`;
}

export function StorageGauge({
  usage,
  lastCleanupAt,
}: {
  usage: { bytes: number | null; capBytes: number };
  lastCleanupAt: string | null;
}) {
  const { bytes, capBytes } = usage;
  const ratio = bytes === null ? 0 : Math.min(bytes / capBytes, 1);
  const critical = ratio >= STORAGE_CRITICAL_RATIO;
  const warning = !critical && ratio >= STORAGE_WARN_RATIO;

  const barColor = critical
    ? "bg-red-500"
    : warning
      ? "bg-amber-500"
      : "bg-brand-green";

  return (
    <div>
      <h2 className="mb-2 text-sm font-bold text-brand-dark">Photo Storage</h2>
      <div className="rounded-2xl bg-white ring-1 ring-border">
        <div className="px-4 py-4">
          {bytes === null ? (
            <p className="text-sm text-brand-dark/55">
              Usage unavailable — could not read storage.
            </p>
          ) : (
            <>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-brand-mint"
                role="progressbar"
                aria-valuenow={Math.round(ratio * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Photo storage used"
              >
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.max(ratio * 100, 1)}%` }}
                />
              </div>
              <p className="mt-2 text-sm font-semibold text-brand-dark">
                {formatMb(bytes)} / {formatMb(capBytes)}{" "}
                <span className="font-normal text-brand-dark/55">
                  ({Math.round(ratio * 100)}%)
                </span>
              </p>
              {critical && (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  Critical — storage is nearly full. Reclaim orphaned photos, or
                  the next photo upload may fail.
                </p>
              )}
              {warning && (
                <p className="mt-1 text-xs font-semibold text-amber-600">
                  Getting full. Consider reclaiming orphaned photos.
                </p>
              )}
            </>
          )}

          <p className="mt-2 text-[11px] text-brand-dark/45">
            Last cleanup: {formatDate(lastCleanupAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
```

There is no `"use client"` directive: this component holds no state and no handlers, so it stays a server component.

- [ ] **Step 2: Seed both values in `admin/page.tsx`**

Add the import:

```tsx
import {
  getPhotoStorageUsage,
  getLastPhotoGcAt,
} from "@/lib/services/system.service";
```

Extend the `Promise.all` with two more entries, destructuring them onto the end of the existing array:

```tsx
    loadData(
      "Photo storage usage",
      () => getPhotoStorageUsage(),
      { bytes: null, capBytes: STORAGE_CAP_BYTES },
    ),
    loadData("Last photo GC timestamp", () => getLastPhotoGcAt(), null),
```

The page asks a question rather than knowing a schema detail: `system.service.ts` owns the `last_photo_gc_at` key string, exactly as it owns `sync_frozen` and `sync_retired`. Spelling the key here as well would risk a silent typo — the card would read "never" forever while the sweep ran fine.

Import `STORAGE_CAP_BYTES` from `@/lib/constants` for that fallback, and pass both down:

```tsx
      storageUsage={storageUsage}
      lastCleanupAt={lastCleanupAt}
```

- [ ] **Step 3: Thread the props through `admin-screen.tsx`**

Add `import { StorageGauge } from "./storage-gauge";`, extend `AdminScreenProps`:

```tsx
  storageUsage: { bytes: number | null; capBytes: number };
  lastCleanupAt: string | null;
```

destructure both in the component signature, and render in **both** branches immediately after `<BugReportsCard openCount={openBugReports} />`:

```tsx
            <StorageGauge usage={storageUsage} lastCleanupAt={lastCleanupAt} />
```

- [ ] **Step 4: Confirm both branches render it**

Run: `grep -c "StorageGauge usage" components/app-pages/admin/admin-screen.tsx`
Expected: `2`.

- [ ] **Step 5: Confirm no `min-h-screen` crept in**

Run: `grep -rn "min-h-screen" --include="*.tsx" app components`
Expected: no output.

- [ ] **Step 6: Type-check, lint, test**

Run: `pnpm tsc --noEmit && pnpm jest __tests__ && pnpm lint components/app-pages/admin/storage-gauge.tsx components/app-pages/admin/admin-screen.tsx "app/(protected)/dashboard/admin/page.tsx"`
Expected: tsc exit 0, all suites PASS, zero lint warnings.

- [ ] **Step 7: Commit**

```bash
git add components/app-pages/admin/storage-gauge.tsx components/app-pages/admin/admin-screen.tsx "app/(protected)/dashboard/admin/page.tsx"
git commit -m "feat(admin): Photo Storage gauge

Stewards cannot run SQL, so usage has to be self-serve. Amber at 80%, red at
92% per the storage analysis. A failed read renders 'unavailable' rather than
'0 MB', which would read as reassuring while meaning the opposite."
```

---

### Task 7: Weekly orphan GC in the cron tick

**Files:**
- Modify: `lib/services/system.service.ts`
- Modify: `app/api/cron/sync/route.ts`
- Modify: `__tests__/services/storage-usage.test.ts`

**Interfaces:**
- Consumes from Task 5: the module-private `PHOTO_GC_KEY` const already declared in `system.service.ts`, plus `findSystemConfigByKey` / `upsertSystemConfig` from `@/lib/repo/system.repo`
- Produces: `shouldRunPhotoGc(now?): Promise<boolean>` and `markPhotoGcRun(now?): Promise<void>` from `@/lib/services/system.service`; `PHOTO_GC_INTERVAL_MS` from `@/lib/constants`

**Background:** `reconcileCatPhotos` (in `lib/services/photo-import.service.ts`, returning `{ scanned, referenced, removed }`) is already reference-aware — it derives paths from `photo_url` and reference-checks before deleting, the invariant that stops a merged duplicate's reassigned blob being reclaimed while the surviving cat still points at it. It is documented idempotent and safe to re-run, so it is safe unattended.

It is **best-effort about removals** — individual delete failures are logged, not thrown — but the steps before that (listing bucket paths, querying referenced URLs) can still throw. Hence the wrapper: a storage-cleanup failure must not auto-freeze sync, which would raise a false alarm on the wrong subsystem.

**The sweep goes in the cron route, NOT inside `syncAllPendingRegions`.** That function has **two early returns** — the idle exit when nothing is pending, and the "summaries need no regen" exit. Appending the sweep to the end of it would skip it on every idle tick, which is most ticks, so the GC would effectively never run. Calling it from the route, after `syncAllPendingRegions()` returns, makes it immune to that function's internal control flow.

It also needs its **own** `try`/`catch`, separate from the one already wrapping `syncAllPendingRegions` — that existing handler auto-freezes sync on error, which is exactly what a storage failure must not trigger.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/services/storage-usage.test.ts`. Extend the service import to `import { getPhotoStorageUsage, shouldRunPhotoGc, markPhotoGcRun } from "@/lib/services/system.service";`, add `import * as systemRepo from "@/lib/repo/system.repo";` and `const mockSystemRepo = systemRepo as jest.Mocked<typeof systemRepo>;`, then append:

```ts
describe("shouldRunPhotoGc", () => {
  const NOW = new Date("2026-08-14T12:00:00.000Z");

  it("runs when no timestamp has ever been recorded", async () => {
    mockSystemRepo.findSystemConfigByKey.mockResolvedValue(undefined as never);

    await expect(shouldRunPhotoGc(NOW)).resolves.toBe(true);
  });

  it("runs when the last sweep was over a week ago", async () => {
    mockSystemRepo.findSystemConfigByKey.mockResolvedValue({
      key: "last_photo_gc_at",
      value: "2026-08-06T12:00:00.000Z",
    } as never);

    await expect(shouldRunPhotoGc(NOW)).resolves.toBe(true);
  });

  it("skips when the last sweep was within the week", async () => {
    mockSystemRepo.findSystemConfigByKey.mockResolvedValue({
      key: "last_photo_gc_at",
      value: "2026-08-12T12:00:00.000Z",
    } as never);

    await expect(shouldRunPhotoGc(NOW)).resolves.toBe(false);
  });

  it("runs when the stored timestamp is unparseable", async () => {
    mockSystemRepo.findSystemConfigByKey.mockResolvedValue({
      key: "last_photo_gc_at",
      value: "not a date",
    } as never);

    // Better to sweep an extra time than to never sweep again because one
    // bad write poisoned the guard forever.
    await expect(shouldRunPhotoGc(NOW)).resolves.toBe(true);
  });
});

describe("markPhotoGcRun", () => {
  it("stores the timestamp as an ISO string", async () => {
    const now = new Date("2026-08-14T12:00:00.000Z");

    await markPhotoGcRun(now);

    expect(mockSystemRepo.upsertSystemConfig).toHaveBeenCalledWith(
      "last_photo_gc_at",
      "2026-08-14T12:00:00.000Z",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest __tests__/services/storage-usage.test.ts`
Expected: FAIL — `shouldRunPhotoGc is not a function`.

- [ ] **Step 3: Add the interval constant**

In `lib/constants.ts`, below the storage constants:

```ts
/** Minimum gap between automatic orphan sweeps (7 days). */
export const PHOTO_GC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
```

This is a tunable, so it belongs in `constants.ts`. The `PHOTO_GC_KEY` string is **not** — Task 5 already declared it as a module-private const in `system.service.ts`, which owns it. Do not re-declare or export it.

- [ ] **Step 4: Add the guard helpers**

In `lib/services/system.service.ts`, extend the `@/lib/constants` import with `PHOTO_GC_INTERVAL_MS`, then append (`PHOTO_GC_KEY` is already in scope from Task 5):

```ts
/**
 * True when the orphan-photo sweep is due.
 *
 * The cron fires every 20 minutes; this guard is what makes the sweep weekly.
 * An absent or unparseable timestamp returns true — better to sweep once extra
 * than to never sweep again because one bad write poisoned the guard.
 */
export async function shouldRunPhotoGc(now: Date = new Date()): Promise<boolean> {
  const row = await systemRepo.findSystemConfigByKey(PHOTO_GC_KEY);
  if (!row?.value) return true;

  const last = new Date(row.value).getTime();
  if (Number.isNaN(last)) return true;

  return now.getTime() - last >= PHOTO_GC_INTERVAL_MS;
}

export async function markPhotoGcRun(now: Date = new Date()): Promise<void> {
  await systemRepo.upsertSystemConfig(PHOTO_GC_KEY, now.toISOString());
}
```

- [ ] **Step 5: Call it from the cron route**

In `app/api/cron/sync/route.ts`, add the imports:

```ts
import { reconcileCatPhotos } from "@/lib/services/photo-import.service";
```

and extend the existing `@/lib/services/system.service` import (which already brings in `setSyncFrozen` and, from Task 2, `isSyncRetired`) to include `shouldRunPhotoGc` and `markPhotoGcRun`.

Inside the existing `after(async () => { … })` block, **after** the `try`/`catch` that wraps `syncAllPendingRegions()` and still inside `after`, append:

```ts
    // Weekly orphan sweep. Deliberately OUTSIDE syncAllPendingRegions: that
    // function has two early returns (idle tick, and no summary regen needed),
    // so a sweep appended to its end would be skipped on most ticks and would
    // effectively never run.
    //
    // Its own try/catch, separate from the sync one above: that handler
    // auto-freezes sync on error, and a storage-cleanup failure must not do
    // that — it would raise a false alarm on the wrong subsystem.
    try {
      if (await shouldRunPhotoGc()) {
        const result = await reconcileCatPhotos();
        await markPhotoGcRun();
        console.log(
          `[PhotoGC] Swept ${result.scanned} object(s), removed ${result.removed}.`,
        );
      }
    } catch (error) {
      console.error(
        "[PhotoGC] Sweep failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
```

`markPhotoGcRun()` is called **after** a successful sweep, not before — a sweep that throws should retry on the next tick rather than be suppressed for a week.

Note this sits after the sync `try`/`catch` rather than inside it, so the sweep still runs on a tick where sync failed. Storage cleanup is independent of sync health.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm jest __tests__/services/storage-usage.test.ts`
Expected: PASS, 8 tests (3 from Task 5 + 5 new).

- [ ] **Step 7: Full suite, type-check, lint**

Run: `pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint lib/constants.ts lib/services/system.service.ts "app/api/cron/sync/route.ts" __tests__/services/storage-usage.test.ts`
Expected: all suites PASS, tsc exit 0, zero lint warnings.

Also confirm the sweep did not land inside the sync function:
Run: `grep -c "shouldRunPhotoGc" lib/services/sync-cron.service.ts`
Expected: `0`.

- [ ] **Step 8: Commit**

```bash
git add lib/constants.ts lib/services/system.service.ts "app/api/cron/sync/route.ts" __tests__/services/storage-usage.test.ts
git commit -m "feat(storage): sweep orphaned photos weekly from the cron tick

The analysis calls orphan neglect the silent creeper, and a documented manual
habit will not survive a decade of handoff. reconcileCatPhotos is already
reference-aware and idempotent, so it is safe unattended. The sweep runs last,
its failures are swallowed rather than auto-freezing sync, and the timestamp is
written only after a successful sweep so a failure retries next tick."
```

---

### Task 8: Decommission runbook

**Files:**
- Create: `docs/operations/decommissioning.md`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes/produces: nothing. Documentation only.

**Background:** Two necessary steps live outside the application and cannot be automated. A Cloudflare `scheduled()` handler has no way to disarm its own trigger, and the Apps Script lives in the spreadsheet rather than the repo.

- [ ] **Step 1: Write the runbook**

Create `docs/operations/decommissioning.md`:

```markdown
# Retiring the Sheets sync

This is a one-way trip. Read it fully before starting.

Retiring stops the app writing to the CATalog spreadsheet, permanently. The app
keeps working on its own database; the spreadsheet becomes a hand-edited
document that nothing overwrites. The two stop being connected.

**There is no undo in the app.** A developer with database access can delete the
`sync_retired` row from `system_config`, but no steward-facing control does.

## Before you start

- Confirm the org actually intends to stop using the app as the source of truth.
  After retiring, edits made in the app never reach the spreadsheet and edits
  made in the spreadsheet never reach the app.
- Note that photos in the sheet are `=IMAGE()` formulas pointing at the app's
  storage. **They keep working only while the app lives.** If the app is later
  shut down entirely, every photo in every sheet breaks silently.

## 1. Retire the sync (in the app)

Admin → GSheet Config → **Retire sync…** → type `RETIRE` → confirm.

This writes the retirement flag and then removes the column protections on
A and W–Y of every region sheet, so stewards can edit those columns by hand.

The flag is written *first*, so retirement still succeeds if the spreadsheet is
already unreachable. If you see "Sync retired, but the spreadsheet could not be
updated", the retirement worked but the protections are still in place —
remove them by hand: open each region sheet → Data → Protected sheets and
ranges → delete the entries for column A and columns W–Y.

## 2. Stop the cron worker (Cloudflare)

The app cannot do this — a Cloudflare `scheduled()` handler has no way to
disable its own trigger.

Either edit `workers/sync-cron/wrangler.toml`, remove the `[triggers]` block,
and redeploy with `wrangler deploy`; or disable the trigger in the Cloudflare
dashboard under Workers → `agila-sync-cron` → Settings → Triggers.

**Do not skip this.** A retired app answers each tick immediately and does no
work, so the cost is small — but if the app is ever deleted while the worker
survives, the worker posts **"App unreachable" to Discord every 20 minutes,
forever**, at a webhook nobody owns any more.

## 3. Remove the Apps Script triggers (spreadsheet)

Open the CATalog spreadsheet → Extensions → Apps Script → Triggers (clock
icon) → delete the `onEdit` and `onSheetChange` triggers.

`onEdit` only stamps the edit-timestamp columns — harmless once nothing reads
them. `onSheetChange` is the reason this step matters: it banners hand-made tabs
with text reading *"To add a REGION, use the app (Admin > Edit Regions)"*. After
retirement that advice is wrong. Stewards may legitimately add tabs by hand, and
would get a red warning pointing them at an app that no longer syncs.

## 4. Confirm

- Edit a cell in a region sheet, wait 20 minutes, confirm nothing overwrites it.
- Confirm the Admin screen shows **Retired** and no longer offers Unfreeze.
- Confirm columns A and W–Y are editable by hand in a region sheet.

## What is NOT affected

- The app itself keeps running and stays fully editable.
- Photos, sessions, the public adoption catalog and sign-in all continue to work.
- The Photo Storage gauge keeps reporting. Automatic orphan cleanup stops with
  the cron, so use Admin → GSheet Config → **Reclaim orphaned photos** manually
  if the gauge climbs.
```

- [ ] **Step 2: Link it from the docs index**

In `docs/README.md`, add a row to the Map table directly below the `operations/gsheets-sync-setup.md` row:

```markdown
| [operations/decommissioning.md](operations/decommissioning.md) | operator | Retiring the sync: killswitch, cron teardown, Apps Script cleanup |
```

- [ ] **Step 3: Verify the links resolve**

Run: `test -f docs/operations/decommissioning.md && grep -c "decommissioning.md" docs/README.md`
Expected: the file exists and the grep prints `1`.

- [ ] **Step 4: Commit**

```bash
git add docs/operations/decommissioning.md docs/README.md
git commit -m "docs(ops): decommissioning runbook

Covers the two steps the app cannot perform — disabling the Cloudflare cron
trigger and deleting the Apps Script triggers — plus the consequence stewards
will not anticipate: column B is =IMAGE() against app storage, so sheet photos
break if the app is ever shut down."
```

---

## Final Verification

After all eight tasks:

- [ ] `pnpm jest __tests__` — all suites pass (24 expected: 21 existing + `sync-retirement` + `retire-sync` + `storage-usage`)
- [ ] `pnpm tsc --noEmit` — exit 0
- [ ] `pnpm build` — succeeds
- [ ] `grep -rn "min-h-screen" --include="*.tsx" app components` — no output
- [ ] `grep -n "isSyncFrozen" lib/services/helper.service.ts lib/services/reverse-sync.service.ts` — no output (both gates now use `getSyncHalt`)
- [ ] `grep -c "StorageGauge usage" components/app-pages/admin/admin-screen.tsx` — `2`
- [ ] `pnpm lint` — no NEW problems beyond the pre-existing 2 errors / 3 warnings in `reverse-sync.service.ts`, `find-suffix-drift.ts`, `workers/sync-cron/src/index.ts`

**Do not run `pnpm drizzle-kit push` in this project.** No table of ours changed; `storage.objects` is Supabase-managed and declared for reads only.

Manual:

- [ ] Admin shows a Photo Storage figure matching the Supabase dashboard
- [ ] Click Reclaim orphaned photos → the gauge's "Last cleanup" still reads `never` (the manual action does not write the timestamp; only the weekly sweep does — confirm this is acceptable or file it as a follow-up)
- [ ] **On a COPY of the spreadsheet**, retire sync → confirm the flag sets, protections on A and W–Y disappear, the Unfreeze button vanishes, and the status chip reads **Retired**
- [ ] After retiring, confirm a cron tick makes no further writes to the sheet
- [ ] Follow `docs/operations/decommissioning.md` end to end and confirm each step matches reality

## Out of Scope (recorded, not tasks)

- **The handoff/decoupling guide.** Split into its own project, written from a direct interview once the code is final.
- **The thumbnail tier.** Storage analysis §6 ranks it third and defers it until egress bites. Egress remains the likelier near-term ceiling.
- **Batch-recompressing existing photos** or changing upload quality.
- **Pruning photos of deceased/adopted cats** — a retention policy decision.
- **Fixing the pre-existing `db.*` layering violations** in `system.service.ts`, `helper.service.ts`, `reverse-sync.service.ts`, `sync-cron.service.ts` and `photo-import.service.ts`.
- **Making the manual Reclaim button write `last_photo_gc_at`.** Arguably it should, so the card reflects any sweep rather than only automatic ones. Left out deliberately to keep the guard's meaning unambiguous — it currently answers "when did the *automatic* sweep last run", which is the thing neglect makes invisible.
