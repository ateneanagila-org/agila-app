# GSheets Sync Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the GSheets sync system to use catalog IDs in col A and UUIDs in col Y, support initial bulk import of existing sheet data, add UNKNOWN region mapping, enable reverse sync creates, and auto-generate summary sheets (For RI, For FA).

**Architecture:** DB schema gains `catalog_id`, `paws_id` on cats and `is_system` on sessions. Pure catalog helpers live in `lib/services/catalog.service.ts`. System session management lives in `lib/services/system-session.service.ts`. Forward and reverse sync in `lib/services/helper.service.ts` and `lib/services/reverse-sync.service.ts` branch on `region.name === "UNKNOWN"`. A one-time import script (`scripts/import-sheets.ts`) seeds the DB and writes UUIDs to col Y.

**Tech Stack:** Drizzle ORM, googleapis v4, Zod, Next.js Server Actions, tsx (for the import script), Jest

**Spec:** `docs/superpowers/specs/2026-04-22-gsheets-sync-overhaul-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `lib/db/schema.ts` | Modify | Add `catalog_id`, `paws_id` to cats; `is_system` to sessions |
| `lib/validation/cats.ts` | Modify | Omit `catalog_id`, `paws_id` from create schema (system-managed) |
| `lib/validation/sessions.ts` | Modify | Add `is_system` to insert/select schemas |
| `lib/services/catalog.service.ts` | Create | Pure helpers: `statusSuffix`, `parseCatalogId`, `nextCatalogId` |
| `lib/services/system-session.service.ts` | Create | `upsertSystemSession(regionId)` |
| `lib/services/helper.service.ts` | Modify | Forward sync: col A→catalog_id, col Y→UUID, UNKNOWN mapping, summary sheets |
| `lib/services/reverse-sync.service.ts` | Modify | Reverse sync: A3:Y range, entityId from col Y, CREATE support |
| `lib/validation/reverse-sync.ts` | Modify | Add `parseUnknownSheetRow`; update `parseSheetRow` col indices |
| `lib/services/cats.service.ts` | Modify | `createCat` uses `region_id` to upsert system session |
| `app/actions/google-sheets.ts` | Modify | Add step 3: regenerate For RI + For FA sheets |
| `scripts/import-sheets.ts` | Create | One-time bulk import script |
| `jest.config.ts` | Modify | Uncomment and enable Jest |
| `__tests__/services/catalog.test.ts` | Create | Unit tests for pure helpers |

---

## Task 1: Enable Jest

**Files:**
- Modify: `jest.config.ts`

- [ ] **Step 1: Replace the commented-out jest.config.ts with a working config**

```typescript
// jest.config.ts
import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  clearMocks: true,
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};

export default createJestConfig(config);
```

- [ ] **Step 2: Verify Jest runs (no tests yet)**

```bash
pnpm test
```

Expected: "No tests found" or empty pass — not an error exit.

- [ ] **Step 3: Commit**

```bash
git add jest.config.ts
git commit -m "chore: enable Jest config"
```

---

## Task 2: DB Schema Migration

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/validation/cats.ts`
- Modify: `lib/validation/sessions.ts` (check this file exists first)

- [ ] **Step 1: Add new columns to schema**

In `lib/db/schema.ts`, add to the `cats` table (after `is_adoptable`):

```typescript
catalog_id: text("catalog_id"),
paws_id: text("paws_id"),
```

Add to the `sessions` table (after `is_finished`):

```typescript
is_system: boolean("is_system").default(false).notNull(),
```

- [ ] **Step 2: Update cats validation — omit system-managed fields from create schema**

In `lib/validation/cats.ts`, update `createCatSchema` to omit the new fields:

```typescript
export const createCatSchema = createInsertSchema(cats)
  .omit({
    last_updated_at: true,
    merged_into_id: true,
    entry_status: true,
    catalog_id: true,
    paws_id: true,
  })
  .extend({ region_id: z.string(), condition: CatHealthRecordConditionEnum });
```

Also update `editCatSchema` to allow editing `paws_id` but not `catalog_id`:

```typescript
export const editCatSchema = createInsertSchema(cats)
  .extend({ region_id: z.string() })
  .merge(editCatHealthRecordSchema.omit({ cat_id: true }))
  .omit({ catalog_id: true })
  .partial()
  .required({ id: true });
```

- [ ] **Step 3: Check if `lib/validation/sessions.ts` exists**

```bash
ls lib/validation/sessions.ts
```

If it exists, the `is_system` field will be auto-included by drizzle-zod on next regeneration — no manual change needed. If it doesn't exist, nothing to do (sessions validation isn't used in the affected flows).

- [ ] **Step 4: Generate migration**

```bash
npx drizzle-kit generate
```

Expected: creates a new file in `drizzle/` (or wherever migrations live) with the ALTER TABLE statements.

- [ ] **Step 5: Apply migration**

```bash
npx drizzle-kit migrate
```

Expected: migration applied successfully.

- [ ] **Step 6: Type check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/db/schema.ts lib/validation/cats.ts
git add drizzle/ # migration files
git commit -m "feat: add catalog_id, paws_id to cats and is_system to sessions"
```

---

## Task 3: Catalog ID Helpers

**Files:**
- Create: `lib/services/catalog.service.ts`
- Create: `__tests__/services/catalog.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/services/catalog.test.ts
import {
  statusSuffix,
  parseCatalogId,
  nextCatalogId,
} from "@/lib/services/catalog.service";

describe("statusSuffix", () => {
  it("returns m for MIA", () => expect(statusSuffix("MIA")).toBe("m"));
  it("returns d for Deceased", () => expect(statusSuffix("Deceased")).toBe("d"));
  it("returns a for Adopted", () => expect(statusSuffix("Adopted")).toBe("a"));
  it("returns f for Fostered", () => expect(statusSuffix("Fostered")).toBe("f"));
  it("returns empty string for active status", () => expect(statusSuffix("None of the above")).toBe(""));
  it("returns empty string for null", () => expect(statusSuffix(null)).toBe(""));
});

describe("parseCatalogId", () => {
  it("parses plain number", () => expect(parseCatalogId("14")).toBe(14));
  it("strips MIA suffix", () => expect(parseCatalogId("5m")).toBe(5));
  it("strips Deceased suffix", () => expect(parseCatalogId("7d")).toBe(7));
  it("strips Adopted suffix", () => expect(parseCatalogId("4a")).toBe(4));
  it("strips Fostered suffix", () => expect(parseCatalogId("11f")).toBe(11));
  it("returns null for unparseable value", () => expect(parseCatalogId("abc")).toBeNull());
  it("returns null for empty string", () => expect(parseCatalogId("")).toBeNull());
});

describe("nextCatalogId", () => {
  it("returns 1 for empty list", () => expect(nextCatalogId([])).toBe(1));
  it("returns max + 1", () => expect(nextCatalogId(["1", "5", "3"])).toBe(6));
  it("skips gaps — uses max not count", () => expect(nextCatalogId(["1", "10", "2"])).toBe(11));
  it("handles suffixed values", () => expect(nextCatalogId(["1", "5m", "3d"])).toBe(6));
  it("ignores unparseable entries", () => expect(nextCatalogId(["1", "abc", "3"])).toBe(4));
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test __tests__/services/catalog.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers**

```typescript
// lib/services/catalog.service.ts
export function statusSuffix(catStatus: string | null | undefined): string {
  switch (catStatus) {
    case "MIA":      return "m";
    case "Deceased": return "d";
    case "Adopted":  return "a";
    case "Fostered": return "f";
    default:         return "";
  }
}

export function parseCatalogId(colA: string): number | null {
  const stripped = colA.replace(/[a-zA-Z]+$/, "").trim();
  const n = parseInt(stripped, 10);
  return isNaN(n) ? null : n;
}

export function nextCatalogId(existingColAValues: string[]): number {
  const nums = existingColAValues
    .map(parseCatalogId)
    .filter((n): n is number => n !== null);
  return nums.length === 0 ? 1 : Math.max(...nums) + 1;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test __tests__/services/catalog.test.ts
```

Expected: PASS — all 15 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/services/catalog.service.ts __tests__/services/catalog.test.ts
git commit -m "feat: add catalog ID helpers (statusSuffix, parseCatalogId, nextCatalogId)"
```

---

## Task 4: System Session Service

**Files:**
- Create: `lib/services/system-session.service.ts`

- [ ] **Step 1: Create the service**

```typescript
// lib/services/system-session.service.ts
import { eq, and } from "drizzle-orm";
import { db, Transaction } from "@/lib/db";
import { sessions, sessionCats } from "@/lib/db/schema";

/**
 * Returns the ID of the permanent system session for a region.
 * Creates it if it doesn't exist. System sessions are never closed
 * and have no sessionUsers — they exist solely to anchor the cat→region link.
 */
export async function upsertSystemSession(
  regionId: string,
  client: typeof db | Transaction = db,
): Promise<string> {
  const existing = await client.query.sessions.findFirst({
    where: (s, { eq, and }) =>
      and(eq(s.region_id, regionId), eq(s.is_system, true)),
  });

  if (existing) return existing.id;

  const [created] = await client
    .insert(sessions)
    .values({ region_id: regionId, is_system: true, is_finished: false })
    .returning();

  return created.id;
}

/**
 * Links a cat to the system session for its region.
 * Safe to call multiple times — silently skips if already linked.
 */
export async function linkCatToSystemSession(
  catId: string,
  regionId: string,
  client: typeof db | Transaction = db,
): Promise<void> {
  const sessionId = await upsertSystemSession(regionId, client);

  const existing = await client.query.sessionCats.findFirst({
    where: (sc, { eq, and }) =>
      and(eq(sc.cat_id, catId), eq(sc.session_id, sessionId)),
  });

  if (!existing) {
    await client.insert(sessionCats).values({ cat_id: catId, session_id: sessionId });
  }
}
```

- [ ] **Step 2: Type check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/services/system-session.service.ts
git commit -m "feat: add system session service (upsertSystemSession, linkCatToSystemSession)"
```

---

## Task 5: Update createCat to Use region_id

The `createCatSchema` already accepts `region_id`. Wire it up to link the cat to a system session.

**Files:**
- Modify: `lib/services/cats.service.ts`

- [ ] **Step 1: Update createCat**

```typescript
// lib/services/cats.service.ts
import { db } from "../db";
import * as catsRepo from "../repo/cats.repo";
import * as sessionsRepo from "../repo/sessions.repo";
import { gsheetSyncQueue } from "../db/schema";
import {
  CreateCatSchema,
  EditCatSchema,
  RemoveCatSchema,
} from "../validation/cats";
import { refreshCatInSyncQueue } from "./helper.service";
import { linkCatToSystemSession } from "./system-session.service";
import { AppError } from "../error/app-error";

export const createCat = async (data: CreateCatSchema) => {
  return await db.transaction(async (tx) => {
    const { condition, region_id, ...catTableData } = data;

    const [newCat] = await catsRepo.insertCat(catTableData, tx);
    await catsRepo.insertCatHealthRecord({ cat_id: newCat.id, condition }, tx);

    // Link cat to system session for the selected region so forward sync
    // knows which sheet to write to.
    await linkCatToSystemSession(newCat.id, region_id, tx);

    await refreshCatInSyncQueue(newCat.id, tx);

    return newCat;
  });
};

export const editCat = async (data: EditCatSchema) => {
  return await db.transaction(async (tx) => {
    const { id, condition, neuter_date, vaccination_date, ...catFields } = data;

    const [updatedCat] = await catsRepo.updateCat(id, catFields, tx);
    await catsRepo.updateCatHealthRecord(id, { condition, neuter_date, vaccination_date }, tx);

    if (!updatedCat) throw new AppError("Cat not found");

    await refreshCatInSyncQueue(id, tx);

    return updatedCat;
  });
};

export const removeCat = async (data: RemoveCatSchema) => {
  return await db.transaction(async (tx) => {
    const region = await sessionsRepo.findCatRegionByLatestSession(data.id, tx);

    await catsRepo.deleteCat(data.id, tx);

    if (region) {
      await tx.insert(gsheetSyncQueue).values({
        action: "DELETE",
        entityId: data.id,
        regionId: region.id,
        payload: [],
      });
    }

    return { success: true };
  });
};
```

- [ ] **Step 2: Type check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/services/cats.service.ts
git commit -m "feat: wire region_id in createCat to link system session"
```

---

## Task 6: Forward Sync — Column Mapping

**Files:**
- Modify: `lib/services/helper.service.ts`

The key changes:
- `mapCatToSheetRow` → col A becomes `catalog_id + statusSuffix`, UUID moved to col Y (written separately)
- New `mapUnknownCatToSheetRow` for UNKNOWN region
- `syncAndCompactRegion` matches rows by `r[24]` (col Y UUID) instead of `r[0]`
- New cats get `catalog_id` assigned at sync time

- [ ] **Step 1: Add imports at top of `lib/services/helper.service.ts`**

Add to the import block:

```typescript
import { statusSuffix, parseCatalogId, nextCatalogId } from "./catalog.service";
```

- [ ] **Step 2: Replace `mapCatToSheetRow`**

Find and replace the entire `mapCatToSheetRow` function:

```typescript
/**
 * Maps DB records to a 22-element array (cols A–V, indices 0–21).
 * Col A = catalog_id + status suffix. UUID is written to col Y separately.
 */
export function mapCatToSheetRow(
  cat: SelectCat,
  health: SelectCatHealthRecord | null,
  interventions: SelectIntervention[] = [],
): string[] {
  const condition = (health?.condition ?? "") as string;
  const catStatus = (cat.cat_status ?? "") as string;

  let forFaStatus = "Not Ready for FA";
  if (["Adopted", "Deceased", "MIA"].includes(catStatus)) {
    forFaStatus = "Not Applicable";
  } else if (cat.is_adoptable) {
    if (condition.includes("Sick")) forFaStatus = "Sick & Adoptable";
    else if (condition.includes("Injured")) forFaStatus = "Injured & Adoptable";
    else forFaStatus = "Healthy & Adoptable";
  }

  const catalogDisplay = cat.catalog_id
    ? `${cat.catalog_id}${statusSuffix(cat.cat_status)}`
    : "";

  return [
    catalogDisplay,                                                    // 0  (A) Catalog ID
    cat.photo_url ? `=IMAGE("${cat.photo_url}")` : "",                 // 1  (B)
    cat.name ?? "N/A",                                                 // 2  (C)
    cat.color ?? "N/A",                                                // 3  (D)
    cat.age ?? "N/A",                                                  // 4  (E)
    cat.sex ?? "Unknown",                                              // 5  (F)
    health?.neuter_date ? "YES" : "NO",                                // 6  (G)
    cat.sociability ?? "Unknown",                                      // 7  (H)
    condition.includes("Sick") ? "YES" : "NO",                        // 8  (I)
    condition.includes("Injured") ? "YES" : "NO",                     // 9  (J)
    cat.is_adoptable ? "YES" : "NO",                                   // 10 (K)
    catStatus || "Unknown",                                            // 11 (L)
    cat.caretaker ?? "N/A",                                            // 12 (M)
    new Date().toLocaleDateString(),                                   // 13 (N)
    cat.spot_last_seen ?? "N/A",                                       // 14 (O)
    health?.neuter_date?.toLocaleDateString() ?? "N/A",               // 15 (P)
    health?.vaccination_date?.toLocaleDateString() ?? "N/A",          // 16 (Q)
    cat.notes ?? "N/A",                                                // 17 (R)
    "",                                                                // 18 (S) separator
    getInterventionDisplayStatus(cat, interventions, "TNVR"),          // 19 (T)
    getInterventionDisplayStatus(cat, interventions, "Veterinarian"),  // 20 (U)
    forFaStatus,                                                       // 21 (V)
  ];
}
```

- [ ] **Step 3: Add `mapUnknownCatToSheetRow` after `mapCatToSheetRow`**

```typescript
/**
 * Maps DB records to a 22-element array for the UNKNOWN region sheet.
 * Col layout: A=CatalogID, B=PossibleLoc, C=PawsId, D=Color, E=Age,
 * F=Sex, G=Neutered, H=Tame, I=Sick, J=Injured, K=Adoptable,
 * L=DateOfKapon, M=DateOfVaccination, N–V=empty.
 * UUID is written to col Y separately.
 */
export function mapUnknownCatToSheetRow(
  cat: SelectCat,
  health: SelectCatHealthRecord | null,
): string[] {
  const condition = (health?.condition ?? "") as string;
  const catalogDisplay = cat.catalog_id
    ? `${cat.catalog_id}${statusSuffix(cat.cat_status)}`
    : "";

  return [
    catalogDisplay,                                           // 0  (A)
    cat.spot_last_seen ?? "N/A",                              // 1  (B) Possible Loc
    cat.paws_id ?? "",                                        // 2  (C) PAWS ID#
    cat.color ?? "N/A",                                       // 3  (D)
    cat.age ?? "N/A",                                         // 4  (E)
    cat.sex ?? "Unknown",                                     // 5  (F)
    health?.neuter_date ? "YES" : "NO",                       // 6  (G)
    cat.sociability ?? "Unknown",                             // 7  (H)
    condition.includes("Sick") ? "YES" : "NO",               // 8  (I)
    condition.includes("Injured") ? "YES" : "NO",            // 9  (J)
    cat.is_adoptable ? "YES" : "NO",                          // 10 (K)
    health?.neuter_date?.toLocaleDateString() ?? "N/A",      // 11 (L)
    health?.vaccination_date?.toLocaleDateString() ?? "N/A", // 12 (M)
    "", "", "", "", "", "", "", "", "",                        // 13–21 (N–V) empty
  ];
}
```

- [ ] **Step 4: Type check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/services/helper.service.ts lib/services/catalog.service.ts
git commit -m "feat: forward sync col mapping — catalog_id in col A, UNKNOWN variant"
```

---

## Task 7: Forward Sync — syncAndCompactRegion

Update row matching and UUID write logic in `syncAndCompactRegion`.

**Files:**
- Modify: `lib/services/helper.service.ts`

- [ ] **Step 1: Update `syncAndCompactRegion` — row matching and col Y write**

Replace the entire `syncAndCompactRegion` function body. Key changes:
1. Read range expands to `A3:Y` (include col Y for UUID matching)
2. Row matching uses `r[24]` (col Y UUID) instead of `r[0]`
3. After writing `A3:V`, write UUIDs to `Y3:Y` in a second call
4. Before writing a new row, assign `catalog_id` if null

```typescript
export async function syncAndCompactRegion(regionId: string) {
  const frozen = await isSyncFrozen();
  if (frozen) {
    console.log(`[Sync] Frozen — skipping region ${regionId}`);
    return;
  }

  const startedAt = new Date();
  let tasksProcessed = 0;
  let tasksFailed = 0;
  let errorMessage: string | null = null;

  const region = await db.query.regions.findFirst({
    where: eq(regions.id, regionId),
  });
  if (!region) return;

  const tasks = await db.query.gsheetSyncQueue.findMany({
    where: (q, { and, eq, lt }) =>
      and(
        eq(q.regionId, regionId),
        eq(q.status, "PENDING"),
        lt(q.retryCount, MAX_RETRIES),
      ),
    orderBy: (q, { asc }) => [asc(q.createdAt)],
  });

  if (tasks.length === 0) return;

  try {
    const { glAuth, glSheets } = await connectToSheets();
    const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;

    // 1. READ current sheet state A3:Y (col Y = UUID at index 24)
    const response = await glSheets.spreadsheets.values.get({
      auth: glAuth,
      spreadsheetId,
      range: `'${region.name}'!A3:Y`,
    });
    const currentRows: string[][] = (response.data.values || []).map(
      (r) => r as string[],
    );

    // 2. MODIFY: process tasks, matching rows by col Y (UUID)
    for (const task of tasks) {
      const idx = currentRows.findIndex((r) => r[24] === task.entityId);
      const taskPayload = (task.payload ?? []) as string[];

      if (task.action === "DELETE") {
        if (idx !== -1) currentRows.splice(idx, 1);
      } else {
        // Assign catalog_id if new cat doesn't have one yet
        if (idx === -1) {
          const cat = await db.query.cats.findFirst({
            where: (c, { eq }) => eq(c.id, task.entityId),
          });
          if (cat && !cat.catalog_id) {
            const colAValues = currentRows.map((r) => r[0] ?? "");
            const newId = String(nextCatalogId(colAValues));
            await db.update(cats).set({ catalog_id: newId }).where(eq(cats.id, cat.id));
            // Rebuild payload with the assigned catalog_id
            const health = await db.query.catHealthRecords.findFirst({
              where: (h, { eq }) => eq(h.cat_id, cat.id),
            });
            const interventions = await db.query.interventions.findMany({
              where: (i, { eq }) => eq(i.cat_id, cat.id),
              orderBy: (i, { desc }) => [desc(i.requested_at)],
            });
            const updatedCat = { ...cat, catalog_id: newId };
            const newPayload = region.name === "UNKNOWN"
              ? mapUnknownCatToSheetRow(updatedCat, health ?? null)
              : mapCatToSheetRow(updatedCat, health ?? null, interventions);
            currentRows.push([...newPayload, "", "", task.entityId]); // pad to col Y
          } else {
            const row = [...taskPayload, "", "", task.entityId];
            currentRows.push(row);
          }
        } else {
          // Update existing row, preserve col Y UUID
          const updatedRow = [...taskPayload];
          updatedRow[24] = task.entityId;
          currentRows[idx] = updatedRow;
        }
      }
    }

    // 3. COMPACT & SORT by Nickname (col C, index 2)
    const finalData = currentRows
      .filter((row) => row[24] && String(row[24]).trim() !== "")
      .sort((a, b) => String(a[2] ?? "").localeCompare(String(b[2] ?? "")));

    // 4. WRITE data cols A3:V (never touch W, X — Apps Script owns those)
    const dataOnly = finalData.map((r) => r.slice(0, 22)); // indices 0–21
    await glSheets.spreadsheets.values.clear({
      auth: glAuth,
      spreadsheetId,
      range: `'${region.name}'!A3:V`,
    });
    if (dataOnly.length > 0) {
      await glSheets.spreadsheets.values.update({
        auth: glAuth,
        spreadsheetId,
        range: `'${region.name}'!A3`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: dataOnly },
      });
    }

    // 5. WRITE UUIDs to col Y (index 24) — separate call, never clears W/X
    const uuidColumn = finalData.map((r) => [r[24] ?? ""]);
    if (uuidColumn.length > 0) {
      await glSheets.spreadsheets.values.update({
        auth: glAuth,
        spreadsheetId,
        range: `'${region.name}'!Y3`,
        valueInputOption: "RAW",
        requestBody: { values: uuidColumn },
      });
    }

    // 6. FINISH
    tasksProcessed = tasks.length;
    await db
      .update(gsheetSyncQueue)
      .set({ status: "COMPLETED" })
      .where(inArray(gsheetSyncQueue.id, tasks.map((t) => t.id)));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown sync error";
    errorMessage = errMsg;
    tasksFailed = tasks.length;

    for (const task of tasks) {
      const newRetryCount = task.retryCount + 1;
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
  } finally {
    await db.insert(syncAuditLog).values({
      regionId,
      direction: "FORWARD",
      tasksProcessed,
      tasksFailed,
      errorMessage,
      startedAt,
      completedAt: new Date(),
    });
  }
}
```

- [ ] **Step 2: Add missing imports to `helper.service.ts`**

Ensure these are imported at the top:

```typescript
import { cats } from "@/lib/db/schema"; // needed for catalog_id update
import { nextCatalogId, statusSuffix, parseCatalogId } from "./catalog.service";
```

- [ ] **Step 3: Type check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/services/helper.service.ts
git commit -m "feat: forward sync — row matching by col Y UUID, catalog_id assignment, UNKNOWN mapping"
```

---

## Task 8: Reverse Sync Changes

**Files:**
- Modify: `lib/services/helper.service.ts` (`readSheetState`, `clearSheetEditTimestamps`)
- Modify: `lib/validation/reverse-sync.ts` (add `parseUnknownSheetRow`)
- Modify: `lib/services/reverse-sync.service.ts` (CREATE support)

- [ ] **Step 1: Update `readSheetState` in `helper.service.ts`**

Replace the existing `readSheetState` function:

```typescript
export async function readSheetState(regionId: string): Promise<SheetRow[]> {
  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;

  const region = await db.query.regions.findFirst({
    where: eq(regions.id, regionId),
  });
  if (!region) return [];

  // Read A3:Y — col Y (index 24) is UUID, col W (22) is last_edited_at, col X (23) is edited_by
  const response = await glSheets.spreadsheets.values.get({
    auth: glAuth,
    spreadsheetId,
    range: `'${region.name}'!A3:Y`,
  });

  const rows = response.data.values || [];

  return rows
    .filter((row) => row[24] && String(row[24]).trim() !== "") // require UUID in col Y
    .map((row) => ({
      raw: row as string[],
      entityId: String(row[24]).trim(),        // col Y UUID
      lastEditedAt: row[22] ? String(row[22]).trim() : null, // col W
      editedBy: row[23] ? String(row[23]).trim() : null,     // col X
    }));
}
```

- [ ] **Step 2: Update `clearSheetEditTimestamps` in `helper.service.ts`**

Update the range to look for UUID in col Y when finding row positions. Replace the function:

```typescript
export async function clearSheetEditTimestamps(
  regionId: string,
  entityIds: string[],
): Promise<void> {
  if (entityIds.length === 0) return;

  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;

  const region = await db.query.regions.findFirst({
    where: eq(regions.id, regionId),
  });
  if (!region) return;

  // Read col Y to find row positions of imported entities
  const response = await glSheets.spreadsheets.values.get({
    auth: glAuth,
    spreadsheetId,
    range: `'${region.name}'!Y3:Y`,
  });
  const uuidColumn = response.data.values || [];

  const requests: Array<{ range: string; values: string[][] }> = [];

  for (const entityId of entityIds) {
    const rowIdx = uuidColumn.findIndex(
      (row) => String(row[0] ?? "").trim() === entityId,
    );
    if (rowIdx === -1) continue;
    const sheetRow = rowIdx + 3; // data starts at row 3
    requests.push({
      range: `'${region.name}'!W${sheetRow}:X${sheetRow}`,
      values: [["", ""]],
    });
  }

  if (requests.length > 0) {
    await glSheets.spreadsheets.values.batchUpdate({
      auth: glAuth,
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: requests },
    });
  }
}
```

- [ ] **Step 3: Add `parseUnknownSheetRow` to `lib/validation/reverse-sync.ts`**

Add after the existing `parseSheetRow` function:

```typescript
/**
 * Converts a raw UNKNOWN sheet row to structured data.
 * UNKNOWN layout: A(0)=CatalogID, B(1)=PossibleLoc, C(2)=PawsId,
 * D(3)=Color, E(4)=Age, F(5)=Sex, G(6)=Neutered, H(7)=Tame,
 * I(8)=Sick, J(9)=Injured, K(10)=Adoptable, L(11)=DateOfKapon,
 * M(12)=DateOfVaccination, Y(24)=UUID.
 */
export function parseUnknownSheetRow(row: string[]): Record<string, unknown> | null {
  const id = row[24]?.trim(); // UUID from col Y
  if (!id) return null;

  const isSick = String(row[8] ?? "").toUpperCase() === "YES";
  const isInjured = String(row[9] ?? "").toUpperCase() === "YES";
  let condition: string | null = null;
  if (isSick && isInjured) condition = "Sick and Injured";
  else if (isSick) condition = "Sick";
  else if (isInjured) condition = "Injured";
  else condition = "Healthy";

  const rawSex = String(row[5] ?? "").trim();
  const sex = ["Male", "Female"].includes(rawSex) ? rawSex : "Unknown";

  const rawSociability = String(row[7] ?? "").trim();
  const sociability = ["Domesticated", "Tame", "Feral"].includes(rawSociability)
    ? rawSociability
    : "Unknown";

  const is_adoptable = String(row[10] ?? "").toUpperCase() === "YES";

  const rawColor = String(row[3] ?? "").trim();
  const validColors = [
    "Black", "White", "Black and White", "Calico", "Tortie", "Torbie",
    "Orange Tabby", "Orange and White Tabby", "Gray Tabby",
    "Gray and White Tabby", "Brown Tabby", "Brown and White Tabby",
  ];
  const color = validColors.includes(rawColor) ? rawColor : null;

  const rawAge = String(row[4] ?? "").trim();
  const validAges = ["Neonatal", "Kitten", "Juvenile", "Adult"];
  const age = validAges.includes(rawAge) ? rawAge : null;

  const spot_last_seen = row[1] && row[1] !== "N/A" ? row[1] : null;
  const paws_id = row[2] && row[2] !== "" ? row[2] : null;
  const neuter_date = row[11] && row[11] !== "N/A" ? row[11] : null;
  const vaccination_date = row[12] && row[12] !== "N/A" ? row[12] : null;

  return {
    id,
    name: null,
    color,
    age,
    sex,
    sociability,
    cat_status: null,
    spot_last_seen,
    paws_id,
    caretaker: null,
    notes: null,
    is_adoptable,
    photo_url: null,
    condition,
    neuter_date,
    vaccination_date,
  };
}
```

Also update the `sheetRowSchema` to add the optional `paws_id` field (used by UNKNOWN rows):

```typescript
export const sheetRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  color: CatColorEnum.nullable(),
  age: CatAgeEnum.nullable(),
  sex: CatSexEnum.nullable(),
  sociability: CatSociabilityEnum.nullable(),
  cat_status: CatStatusEnum.nullable(),
  spot_last_seen: z.string().nullable(),
  caretaker: z.string().nullable(),
  notes: z.string().nullable(),
  is_adoptable: z.boolean(),
  photo_url: z.string().nullable(),
  condition: CatHealthRecordConditionEnum.nullable(),
  neuter_date: z.string().nullable(),
  vaccination_date: z.string().nullable(),
  paws_id: z.string().nullable().optional(),
});
```

- [ ] **Step 4: Add CREATE support to `reverse-sync.service.ts`**

Import what's needed at the top:

```typescript
import { parseCatalogId } from "@/lib/services/catalog.service";
import { linkCatToSystemSession } from "@/lib/services/system-session.service";
import { parseUnknownSheetRow } from "@/lib/validation/reverse-sync";
```

In `reverseSyncRegionInternal`, after the `if (!dbCat)` block, add CREATE logic. Replace:

```typescript
    if (!dbCat) {
      result.skipped++;
      continue;
    }
```

With:

```typescript
    if (!dbCat) {
      // CREATE: new cat added manually via sheet (Apps Script generated UUID in col Y)
      try {
        const isUnknown = region?.name === "UNKNOWN";
        const rawParsed = isUnknown
          ? parseUnknownSheetRow(sheetRow.raw)
          : parseSheetRow(sheetRow.raw);

        if (!rawParsed) {
          result.skipped++;
          continue;
        }

        const validation = sheetRowSchema.safeParse(rawParsed);
        if (!validation.success) {
          result.errors.push({
            entityId: sheetRow.entityId,
            error: `Create validation failed: ${validation.error.issues.map((i) => i.message).join(", ")}`,
          });
          continue;
        }

        const catalogIdRaw = String(sheetRow.raw[0] ?? "").trim();
        const catalog_id = parseCatalogId(catalogIdRaw)
          ? String(parseCatalogId(catalogIdRaw))
          : null;

        await db.transaction(async (tx) => {
          const { condition, neuter_date, vaccination_date, paws_id, ...catFields } = validation.data;
          const [newCat] = await tx
            .insert(cats)
            .values({
              id: sheetRow.entityId,
              catalog_id,
              paws_id: paws_id ?? null,
              ...catFields,
            })
            .returning();

          await tx.insert(catHealthRecords).values({
            cat_id: newCat.id,
            condition,
            neuter_date: neuter_date ? new Date(neuter_date) : null,
            vaccination_date: vaccination_date ? new Date(vaccination_date) : null,
          });

          await linkCatToSystemSession(newCat.id, regionId, tx);
        });

        result.imported++;
        importedIds.push(sheetRow.entityId);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Create failed";
        result.errors.push({ entityId: sheetRow.entityId, error: msg });
      }
      continue;
    }
```

Also fetch the region at the start of `reverseSyncRegionInternal` for the UNKNOWN branch check:

```typescript
  // Fetch region for UNKNOWN branching
  const region = await db.query.regions.findFirst({
    where: (r, { eq }) => eq(r.id, regionId),
  });
```

And update the existing UPDATE path to also use the UNKNOWN parser:

```typescript
    const isUnknown = region?.name === "UNKNOWN";
    const rawParsed = isUnknown
      ? parseUnknownSheetRow(sheetRow.raw)
      : parseSheetRow(sheetRow.raw);
```

Replace the existing `const rawParsed = parseSheetRow(sheetRow.raw);` line with the above.

- [ ] **Step 5: Update `importSheetRowToDB` to handle `paws_id`**

In `reverse-sync.service.ts`, update the `importSheetRowToDB` function's cat update to include `paws_id`:

```typescript
    await tx
      .update(cats)
      .set({
        name: data.name,
        color: data.color,
        age: data.age,
        sex: data.sex,
        sociability: data.sociability,
        cat_status: data.cat_status,
        spot_last_seen: data.spot_last_seen,
        caretaker: data.caretaker,
        notes: data.notes,
        is_adoptable: data.is_adoptable,
        photo_url: data.photo_url,
        ...(data.paws_id !== undefined ? { paws_id: data.paws_id } : {}),
        last_updated_at: new Date(),
      })
      .where(eq(cats.id, data.id));
```

- [ ] **Step 6: Type check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/services/helper.service.ts lib/validation/reverse-sync.ts lib/services/reverse-sync.service.ts
git commit -m "feat: reverse sync — entityId from col Y, UNKNOWN parser, CREATE support"
```

---

## Task 9: Summary Sheets (For RI + For FA)

**Files:**
- Modify: `lib/services/helper.service.ts` (add generator functions)
- Modify: `app/actions/google-sheets.ts` (add step 3 to `syncAllPendingRegions`)

- [ ] **Step 1: Add `generateForRiSheet` to `helper.service.ts`**

Add after `syncAndCompactRegion`:

```typescript
/**
 * Regenerates the "For RI" summary sheet from DB.
 * 4 columns: TNVR catalog_id, TNVR status, Vet catalog_id, Vet status.
 * Grouped by region, 20 blank rows per section.
 */
export async function generateForRiSheet(): Promise<void> {
  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;

  const allRegions = await db.query.regions.findMany();

  const sheetData: string[][] = [];

  for (const region of allRegions) {
    const catsInRegion = await db.query.cats.findMany({
      with: {
        interventions: {
          orderBy: (i, { desc }) => [desc(i.requested_at)],
        },
      },
      where: (c, { exists, eq }) =>
        exists(
          db
            .select()
            .from(sessionCats)
            .innerJoin(sessions, eq(sessions.id, sessionCats.session_id))
            .where(eq(sessions.region_id, region.id))
            .where(eq(sessionCats.cat_id, c.id))
        ),
    });

    const tnvrCats = catsInRegion
      .filter((cat) =>
        cat.interventions.some(
          (i) => i.type === "TNVR" && i.status === "Pending",
        ),
      )
      .map((cat) => `${cat.catalog_id ?? ""}${statusSuffix(cat.cat_status)}`);

    const vetCats = catsInRegion
      .filter((cat) =>
        cat.interventions.some(
          (i) => i.type === "Veterinarian" && i.status === "Pending",
        ),
      )
      .map((cat) => `${cat.catalog_id ?? ""}${statusSuffix(cat.cat_status)}`);

    const maxRows = Math.max(tnvrCats.length, vetCats.length);

    sheetData.push([region.name, "", region.name, ""]); // header row
    for (let i = 0; i < Math.max(maxRows, 1); i++) {
      sheetData.push([
        tnvrCats[i] ?? "",
        tnvrCats[i] ? "Will have TNVR intervention" : "",
        vetCats[i] ?? "",
        vetCats[i] ? "Will have Vet intervention" : "",
      ]);
    }
    // 20 blank rows after each region
    for (let i = 0; i < 20 - Math.max(maxRows, 1); i++) {
      sheetData.push(["", "", "", ""]);
    }
  }

  await glSheets.spreadsheets.values.clear({
    auth: glAuth,
    spreadsheetId,
    range: "For RI!A1:D",
  });

  if (sheetData.length > 0) {
    await glSheets.spreadsheets.values.update({
      auth: glAuth,
      spreadsheetId,
      range: "For RI!A1",
      valueInputOption: "RAW",
      requestBody: { values: sheetData },
    });
  }
}
```

- [ ] **Step 2: Add `generateForFaSheet` to `helper.service.ts`**

Add after `generateForRiSheet`:

```typescript
/**
 * Regenerates the "For FA" summary sheet from DB.
 * 6 columns: Healthy catalog_id, status, Sick catalog_id, status, Injured catalog_id, status.
 * Grouped by region, 20 blank rows per section.
 */
export async function generateForFaSheet(): Promise<void> {
  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;

  const allRegions = await db.query.regions.findMany();
  const sheetData: string[][] = [];

  for (const region of allRegions) {
    const adoptableCats = await db.query.cats.findMany({
      with: { catHealthRecords: true },
      where: (c, { eq, and, exists }) =>
        and(
          eq(c.is_adoptable, true),
          exists(
            db
              .select()
              .from(sessionCats)
              .innerJoin(sessions, eq(sessions.id, sessionCats.session_id))
              .where(eq(sessions.region_id, region.id))
              .where(eq(sessionCats.cat_id, c.id))
          ),
        ),
    });

    const healthy = adoptableCats
      .filter((c) => {
        const cond = c.catHealthRecords?.condition ?? "";
        return !cond.includes("Sick") && !cond.includes("Injured");
      })
      .map((c) => `${c.catalog_id ?? ""}${statusSuffix(c.cat_status)}`);

    const sick = adoptableCats
      .filter((c) => c.catHealthRecords?.condition?.includes("Sick"))
      .map((c) => `${c.catalog_id ?? ""}${statusSuffix(c.cat_status)}`);

    const injured = adoptableCats
      .filter((c) => c.catHealthRecords?.condition?.includes("Injured"))
      .map((c) => `${c.catalog_id ?? ""}${statusSuffix(c.cat_status)}`);

    const maxRows = Math.max(healthy.length, sick.length, injured.length);

    sheetData.push([region.name, "", region.name, "", region.name, ""]); // header
    for (let i = 0; i < Math.max(maxRows, 1); i++) {
      sheetData.push([
        healthy[i] ?? "",
        healthy[i] ? "Healthy & Adoptable" : "",
        sick[i] ?? "",
        sick[i] ? "Sick & Adoptable" : "",
        injured[i] ?? "",
        injured[i] ? "Injured & Adoptable" : "",
      ]);
    }
    for (let i = 0; i < 20 - Math.max(maxRows, 1); i++) {
      sheetData.push(["", "", "", "", "", ""]);
    }
  }

  await glSheets.spreadsheets.values.clear({
    auth: glAuth,
    spreadsheetId,
    range: "For FA!A1:F",
  });

  if (sheetData.length > 0) {
    await glSheets.spreadsheets.values.update({
      auth: glAuth,
      spreadsheetId,
      range: "For FA!A1",
      valueInputOption: "RAW",
      requestBody: { values: sheetData },
    });
  }
}
```

- [ ] **Step 3: Add imports needed by the new functions to `helper.service.ts`**

Ensure these are imported:

```typescript
import { sessions, sessionCats } from "@/lib/db/schema";
```

- [ ] **Step 4: Wire up step 3 in `syncAllPendingRegions` in `app/actions/google-sheets.ts`**

```typescript
import { syncAndCompactRegion, generateForRiSheet, generateForFaSheet } from "@/lib/services/helper.service";

export async function syncAllPendingRegions() {
  const pendingTasks = await db
    .selectDistinct({ regionId: gsheetSyncQueue.regionId })
    .from(gsheetSyncQueue)
    .where(eq(gsheetSyncQueue.status, "PENDING"));

  const allRegions = await db.query.regions.findMany();

  // Phase 1: Reverse sync ALL regions
  for (const region of allRegions) {
    try {
      await reverseSyncRegion(region.id);
    } catch (error) {
      console.error(
        `[ReverseSync] Region ${region.id} failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Phase 2: Forward sync only regions with pending tasks
  await Promise.all(
    pendingTasks.map((task) => syncAndCompactRegion(task.regionId)),
  );

  // Phase 3: Regenerate summary sheets
  try {
    await generateForRiSheet();
    await generateForFaSheet();
    console.log("[SummarySheets] For RI + For FA regenerated");
  } catch (error) {
    console.error(
      "[SummarySheets] Failed:",
      error instanceof Error ? error.message : error,
    );
  }
}
```

- [ ] **Step 5: Type check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/services/helper.service.ts app/actions/google-sheets.ts
git commit -m "feat: summary sheet generation for For RI and For FA"
```

---

## Task 10: Import Script

**Files:**
- Create: `scripts/import-sheets.ts`

- [ ] **Step 1: Create the import script**

```typescript
// scripts/import-sheets.ts
// One-time bulk import. Run with: pnpm tsx scripts/import-sheets.ts
// Requires .env.local with all required env vars.
// DELETE THIS FILE after successful import.

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cats,
  catHealthRecords,
  regions,
  sessions,
  sessionCats,
} from "@/lib/db/schema";
import { parseCatalogId, nextCatalogId } from "@/lib/services/catalog.service";
import { linkCatToSystemSession, upsertSystemSession } from "@/lib/services/system-session.service";
import { randomUUID } from "crypto";

async function connectToSheets() {
  const creds = JSON.parse(process.env.SERVICE_ACCOUNT_CREDENTIALS!);
  const auth = new google.auth.GoogleAuth({
    credentials: { ...creds, private_key: creds.private_key.replace(/\\n/g, "\n") },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return { auth, sheets: google.sheets({ version: "v4", auth }) };
}

const VALID_COLORS = [
  "Black", "White", "Black and White", "Calico", "Tortie", "Torbie",
  "Orange Tabby", "Orange and White Tabby", "Gray Tabby",
  "Gray and White Tabby", "Brown Tabby", "Brown and White Tabby",
];
const VALID_AGES = ["Neonatal", "Kitten", "Juvenile", "Adult"];
const VALID_SEXES = ["Male", "Female"];
const VALID_SOCIABILITIES = ["Domesticated", "Tame", "Feral"];
const VALID_STATUSES = ["Deceased", "Fostered", "Adopted", "MIA"];

function parseStandardRow(row: string[], uuid: string) {
  const isSick = String(row[8] ?? "").toUpperCase() === "YES";
  const isInjured = String(row[9] ?? "").toUpperCase() === "YES";
  const condition = isSick && isInjured
    ? "Sick and Injured"
    : isSick ? "Sick" : isInjured ? "Injured" : "Healthy";

  const rawSex = String(row[5] ?? "").trim();
  const rawColor = String(row[3] ?? "").trim();
  const rawAge = String(row[4] ?? "").trim();
  const rawSociability = String(row[7] ?? "").trim();
  const rawStatus = String(row[11] ?? "").trim();

  const photoRaw = String(row[1] ?? "").trim();
  const photoMatch = photoRaw.match(/=IMAGE\("(.+?)"\)/i);

  return {
    id: uuid,
    color: VALID_COLORS.includes(rawColor) ? rawColor : null,
    age: VALID_AGES.includes(rawAge) ? rawAge : null,
    sex: VALID_SEXES.includes(rawSex) ? rawSex : "Unknown",
    sociability: VALID_SOCIABILITIES.includes(rawSociability) ? rawSociability : "Unknown",
    cat_status: VALID_STATUSES.includes(rawStatus) ? rawStatus : null,
    name: row[2] && row[2] !== "N/A" ? row[2] : null,
    spot_last_seen: row[14] && row[14] !== "N/A" ? row[14] : null,
    caretaker: row[12] && row[12] !== "N/A" ? row[12] : null,
    notes: row[17] && row[17] !== "N/A" ? row[17] : null,
    is_adoptable: String(row[10] ?? "").toUpperCase() === "YES",
    photo_url: null as null, // photo migration deferred
    paws_id: null as null,
    condition,
    neuter_date: row[15] && row[15] !== "N/A" ? new Date(row[15]) : null,
    vaccination_date: row[16] && row[16] !== "N/A" ? new Date(row[16]) : null,
  };
}

function parseUnknownRow(row: string[], uuid: string) {
  const isSick = String(row[8] ?? "").toUpperCase() === "YES";
  const isInjured = String(row[9] ?? "").toUpperCase() === "YES";
  const condition = isSick && isInjured
    ? "Sick and Injured"
    : isSick ? "Sick" : isInjured ? "Injured" : "Healthy";

  const rawSex = String(row[5] ?? "").trim();
  const rawColor = String(row[3] ?? "").trim();
  const rawAge = String(row[4] ?? "").trim();
  const rawSociability = String(row[7] ?? "").trim();

  return {
    id: uuid,
    color: VALID_COLORS.includes(rawColor) ? rawColor : null,
    age: VALID_AGES.includes(rawAge) ? rawAge : null,
    sex: VALID_SEXES.includes(rawSex) ? rawSex : "Unknown",
    sociability: VALID_SOCIABILITIES.includes(rawSociability) ? rawSociability : "Unknown",
    cat_status: null,
    name: null,
    spot_last_seen: row[1] && row[1] !== "N/A" ? row[1] : null,
    caretaker: null,
    notes: null,
    is_adoptable: String(row[10] ?? "").toUpperCase() === "YES",
    photo_url: null as null,
    paws_id: row[2] && row[2] !== "" ? row[2] : null,
    condition,
    neuter_date: row[11] && row[11] !== "N/A" ? new Date(row[11]) : null,
    vaccination_date: row[12] && row[12] !== "N/A" ? new Date(row[12]) : null,
  };
}

async function importRegion(
  regionRecord: { id: string; name: string },
  auth: ReturnType<typeof google.auth.GoogleAuth.prototype.getClient> extends Promise<infer T> ? T : never,
  sheets: ReturnType<typeof google.sheets>,
) {
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;
  const isUnknown = regionRecord.name === "UNKNOWN";

  const response = await sheets.spreadsheets.values.get({
    auth: auth as never,
    spreadsheetId,
    range: `'${regionRecord.name}'!A3:X`,
  });

  const rows = (response.data.values || []) as string[][];
  const dataRows = rows.filter((r) => r[0] && String(r[0]).trim() !== "");

  const existingColA = dataRows.map((r) => String(r[0]).trim());
  let maxId = Math.max(
    0,
    ...existingColA.map(parseCatalogId).filter((n): n is number => n !== null),
  );

  const uuidWrites: Array<{ row: number; uuid: string }> = [];
  let created = 0, skipped = 0, errors = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const colA = String(row[0]).trim();
    const catalogBase = parseCatalogId(colA);
    const catalog_id = catalogBase !== null ? String(catalogBase) : String(++maxId);

    const uuid = randomUUID();
    const sheetRowNumber = i + 3; // data starts at row 3

    try {
      const parsed = isUnknown
        ? parseUnknownRow(row, uuid)
        : parseStandardRow(row, uuid);

      const { condition, neuter_date, vaccination_date, paws_id, ...catFields } = parsed;

      await db.transaction(async (tx) => {
        await tx.insert(cats).values({ ...catFields, catalog_id }).onConflictDoNothing();
        await tx.insert(catHealthRecords).values({
          cat_id: uuid,
          condition: condition as never,
          neuter_date,
          vaccination_date,
        }).onConflictDoNothing();
        await linkCatToSystemSession(uuid, regionRecord.id, tx);
      });

      uuidWrites.push({ row: sheetRowNumber, uuid });
      created++;
    } catch (error) {
      console.error(`  Row ${sheetRowNumber} error:`, error instanceof Error ? error.message : error);
      errors++;
    }
  }

  // Batch write UUIDs to col Y
  if (uuidWrites.length > 0) {
    const batchData = uuidWrites.map(({ row, uuid }) => ({
      range: `'${regionRecord.name}'!Y${row}`,
      values: [[uuid]],
    }));

    await sheets.spreadsheets.values.batchUpdate({
      auth: auth as never,
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: batchData },
    });
  }

  return { created, skipped, errors };
}

async function main() {
  console.log("Starting GSheets → DB import...\n");

  const { auth, sheets } = await connectToSheets();
  const allRegions = await db.query.regions.findMany();

  let totalCreated = 0;
  let totalErrors = 0;

  for (const region of allRegions) {
    console.log(`[${region.name}] Importing...`);
    try {
      const result = await importRegion(region, await auth.getClient() as never, sheets);
      console.log(`  ✓ created: ${result.created}, errors: ${result.errors}`);
      totalCreated += result.created;
      totalErrors += result.errors;
    } catch (error) {
      console.error(`  ✗ Region failed:`, error instanceof Error ? error.message : error);
      totalErrors++;
    }
  }

  console.log(`\nDone. Total created: ${totalCreated}, errors: ${totalErrors}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
```

- [ ] **Step 2: Type check the script**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run dry-run (read-only check — comment out the write calls first)**

Before running for real, temporarily comment out the `tx.insert`, `uuidWrites.push`, and `batchUpdate` calls and run:

```bash
pnpm tsx scripts/import-sheets.ts
```

Expected: connects to sheets, logs region names and row counts, exits cleanly.

- [ ] **Step 4: Run the real import**

Uncomment the write calls, then:

```bash
pnpm tsx scripts/import-sheets.ts
```

Expected output per region: `✓ created: N, errors: 0`

- [ ] **Step 5: Verify in Supabase (Drizzle Studio)**

```bash
npx drizzle-kit studio
```

Check that cats, catHealthRecords, sessions, and sessionCats rows were created. Spot-check col Y in the sheet matches cat IDs in the DB.

- [ ] **Step 6: Commit**

```bash
git add scripts/import-sheets.ts
git commit -m "feat: one-time GSheets bulk import script"
```

---

## Task 11: Apps Script — onEdit UUID Generation

This is an external change to the Google Apps Script bound to the spreadsheet. No code file in this repo.

- [ ] **Step 1: Open Apps Script editor**

In the spreadsheet: Extensions → Apps Script

- [ ] **Step 2: Add UUID generation to the onEdit trigger**

Find the existing `onEdit` function and add the UUID write block. If the function doesn't exist, create it:

```javascript
function onEdit(e) {
  const sheet = e.range.getSheet();
  const row = e.range.getRow();
  const col = e.range.getColumn();

  // Skip header rows (rows 1 and 2)
  if (row <= 2) return;

  // Auto-generate UUID in col Y (index 25, 1-based) when a new row is added
  // Trigger: col A (index 1) gets a value AND col Y is still empty
  const colA = sheet.getRange(row, 1).getValue();
  const colY = sheet.getRange(row, 25).getValue();

  if (colA && !colY) {
    sheet.getRange(row, 25).setValue(Utilities.getUuid());
  }

  // --- existing last_edited_at / edited_by logic below (col W=23, col X=24) ---
  // (keep whatever is already here for the timestamp columns)
}
```

- [ ] **Step 3: Save and test**

Add a new row to any region sheet with a value in col A. Verify col Y auto-populates with a UUID.

- [ ] **Step 4: Commit a note in the repo**

```bash
git commit --allow-empty -m "docs: Apps Script onEdit updated — auto-generates UUID in col Y for new rows"
```

---

## Task 12: Final Type Check + Build

- [ ] **Step 1: Run full type check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Run build**

```bash
pnpm build
```

Expected: build succeeds with no type errors.

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: all tests pass (catalog helpers: 15 tests).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final type check pass — GSheets sync overhaul complete"
```
