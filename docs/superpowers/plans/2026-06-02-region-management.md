# In-App Region Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give non-technical stewards full self-serve control over regions (add, rename, archive, delete-if-empty, and guarded delete-of-populated-region) from a settings-style Admin tab, with the DB as the single source of truth and the Google Sheet tab managed automatically.

**Architecture:** Migrate `regions.name` from a Postgres enum to a plain `text NOT NULL UNIQUE` column and add an `archived_at` timestamp, making the `regions` table fully data-driven (the `REGION_NAME_VALUES` constant becomes seed/UI data only). Region writes go through `lib/repo/regions.repo.ts` (DB) and `lib/services/regions.service.ts` (orchestration), which also drive Google Sheet tab create/rename/delete via the Sheets API. The Admin tab is restyled as a settings page (title → section headings → white rounded cards) and gains an "Edit Regions" section. Deleting a *populated* region uses transactional app logic to remove the region's sessions and any cats left fully orphaned by that removal — FK cascade is deliberately NOT used for cat deletion (cats associate to regions via sessions, and can span regions).

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind v4, Drizzle ORM, Postgres (Supabase), `next-safe-action`, googleapis (Sheets API), Jest. Package manager: **pnpm**. Schema changes via `pnpm drizzle-kit push`. Verify with `pnpm tsc --noEmit` / `pnpm build`; do **not** run `pnpm dev`.

**Conventions (from CLAUDE.md + memory):**
- Services must go through `lib/repo/` for DB access — never call `db.*` directly in a service.
- Admin tab = settings style: main title, clear section heading, white rounded box per section.
- This is handoff-critical: every operation must be doable from the Admin tab, no code/deploy.
- Commit after every task. Branch: `dev`.

---

## File Structure

**Modify:**
- `lib/db/enums.ts` — drop `regionNameEnum` (pgEnum); keep `REGION_NAME_VALUES` as a plain const; `RegionName` becomes `string`.
- `lib/db/schema.ts` — `regions.name` → `text().notNull().unique()`; add `archived_at` timestamp.
- `lib/repo/regions.repo.ts` — CRUD + usage/orphan queries.
- `lib/services/helper.service.ts` — Sheets API tab create/rename/delete helpers.
- `app/actions/system.ts` — remove obsolete `syncRegions` (superseded by CRUD).
- `components/app-pages/users/users-screen.tsx` (AdminScreen) — settings-style restyle + mount Regions section.
- `components/app-pages/users/sheet-setup-controls.tsx` — drop the now-obsolete "Sync regions from enum" button.
- `lib/services/regions.service.ts` — full region CRUD orchestration (currently only `syncRegionsFromEnum`).

**Create:**
- `lib/validation/regions.ts` — Zod schemas for region CRUD inputs.
- `app/actions/regions.ts` — `next-safe-action` admin actions for region CRUD.
- `components/app-pages/users/region-controls.tsx` — the "Edit Regions" settings section (list + add + rename + archive + delete with impact confirm).
- `__tests__/services/regions-delete.test.ts` — unit tests for the orphan-deletion logic.

**Delete:**
- Nothing immediately. `syncRegionsFromEnum` (service) is removed/repurposed in Task 11.

---

## Phase A — Schema migration (text + archived)

### Task 1: Migrate `regions.name` enum → text and add `archived_at`

**Files:**
- Modify: `lib/db/enums.ts`
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Demote the region-name enum to a plain constant**

In `lib/db/enums.ts`, find:

```ts
export const regionNameEnum = pgEnum("region_name", REGION_NAME_VALUES);
export const RegionNameEnum = z.enum(REGION_NAME_VALUES);
export type RegionName = z.infer<typeof RegionNameEnum>;
```

Replace with (keep `REGION_NAME_VALUES` above it untouched — it stays as seed/UI data):

```ts
// Region names are now stored as free text in the regions table (the table is
// the source of truth). REGION_NAME_VALUES is retained only as seed/initial data.
export type RegionName = string;
```

- [ ] **Step 2: Remove the enum import in schema and switch the column to text + add archived_at**

In `lib/db/schema.ts`, remove `regionNameEnum` from the `./enums` import list. Change the `regions` table:

```ts
export const regions = pgTable(
  "regions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    color: regionColorEnum("color"),
    archived_at: timestamp("archived_at"),
  },
  (t) => [unique().on(t.name)],
);
```

(`text` and `timestamp` are already imported in `schema.ts`.)

- [ ] **Step 3: Push the schema**

Run: `pnpm drizzle-kit push`
Expected: the `regions.name` column converts to text (existing 37 values preserved), `archived_at` added, and the `region_name` pg enum type is dropped (no longer referenced). If prompted about the enum→text conversion, accept it.

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`
Expected: errors only where `RegionName`/`regionNameEnum` were used as enums. The only real `RegionName` usage is `lib/repo/regions.repo.ts` (`insertMissingRegions`) — it still compiles because `RegionName` is now `string`. Fix any remaining references (e.g. remove `RegionNameEnum` imports if any surface).

- [ ] **Step 5: Commit**

```bash
git add lib/db/enums.ts lib/db/schema.ts
git commit -m "refactor(regions): name enum -> text + add archived_at (data-driven regions)"
```

---

## Phase B — Repo layer (DB queries)

### Task 2: Region CRUD + usage queries in the repo

**Files:**
- Modify: `lib/repo/regions.repo.ts`

- [ ] **Step 1: Replace the repo with CRUD + usage helpers**

Replace the entire contents of `lib/repo/regions.repo.ts` with:

```ts
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, type Transaction } from "@/lib/db";
import { regions, sessions, sessionCats } from "@/lib/db/schema";
import type { RegionColor } from "@/lib/db/enums";

type DB = typeof db | Transaction;

/** All regions (id, name, color, archived_at). */
export const findRegions = () =>
  db
    .select({
      id: regions.id,
      name: regions.name,
      color: regions.color,
      archived_at: regions.archived_at,
    })
    .from(regions);

/** Active (non-archived) regions only. */
export const findActiveRegions = () =>
  db
    .select({ id: regions.id, name: regions.name, color: regions.color })
    .from(regions)
    .where(isNull(regions.archived_at));

export const findRegionById = (id: string, client: DB = db) =>
  client.query.regions.findFirst({ where: (r, { eq }) => eq(r.id, id) });

export const findRegionByName = (name: string, client: DB = db) =>
  client.query.regions.findFirst({ where: (r, { eq }) => eq(r.name, name) });

export const insertRegion = (
  data: { name: string; color: RegionColor | null },
  client: DB = db,
) => client.insert(regions).values(data).returning();

export const updateRegionName = (id: string, name: string, client: DB = db) =>
  client.update(regions).set({ name }).where(eq(regions.id, id)).returning();

export const setRegionArchived = (
  id: string,
  archived: boolean,
  client: DB = db,
) =>
  client
    .update(regions)
    .set({ archived_at: archived ? new Date() : null })
    .where(eq(regions.id, id))
    .returning();

export const deleteRegion = (id: string, client: DB = db) =>
  client.delete(regions).where(eq(regions.id, id)).returning();

/**
 * Usage of a region: number of sessions in it, and number of cats that have
 * sessions in it. Used to decide empty vs populated and to show delete impact.
 */
export const getRegionUsage = async (
  id: string,
  client: DB = db,
): Promise<{ sessionCount: number; catCount: number }> => {
  const [sessionRow] = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(sessions)
    .where(eq(sessions.region_id, id));

  const [catRow] = await client
    .select({ count: sql<number>`count(distinct ${sessionCats.cat_id})::int` })
    .from(sessionCats)
    .innerJoin(sessions, eq(sessionCats.session_id, sessions.id))
    .where(eq(sessions.region_id, id));

  return {
    sessionCount: sessionRow?.count ?? 0,
    catCount: catRow?.count ?? 0,
  };
};

/**
 * Cat IDs that would be fully orphaned by deleting this region: they have at
 * least one session in this region, NO sessions in any other region, and no
 * manual region_id override pointing elsewhere. These are deleted alongside a
 * forced delete of a populated region.
 */
export const findCatsOnlyInRegion = async (
  id: string,
  client: DB = db,
): Promise<string[]> => {
  const rows = await client.execute(sql`
    SELECT sc.cat_id AS id
    FROM ${sessionCats} sc
    JOIN ${sessions} s ON s.id = sc.session_id
    WHERE s.region_id = ${id}
    GROUP BY sc.cat_id
    HAVING COUNT(*) FILTER (WHERE s.region_id <> ${id}) = 0
  `);
  // drizzle execute returns { rows } for node-postgres
  return (rows as unknown as { rows: { id: string }[] }).rows.map((r) => r.id);
};
```

> Note: `client.execute(sql\`...\`)` return shape depends on the driver. If the
> project's `db` is `drizzle-orm/postgres-js`, `execute` returns the rows array
> directly — change the last line to `return (rows as { id: string }[]).map(...)`.
> Verify against an existing raw query in the repo layer (e.g. the region
> resolution subquery in `cats.repo.ts`) and match its driver's shape.

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors. (`insertMissingRegions` was removed; it's re-added or dropped in Task 11 — confirm nothing imports it yet besides `regions.service.ts`, which Task 11 updates. If `tsc` complains about `regions.service.ts`, leave it for Task 11 or temporarily comment the import.)

- [ ] **Step 3: Commit**

```bash
git add lib/repo/regions.repo.ts
git commit -m "feat(regions): repo CRUD + usage/orphan queries"
```

---

## Phase C — Sheets API tab management

### Task 3: Tab create / rename / delete helpers

**Files:**
- Modify: `lib/services/helper.service.ts`

- [ ] **Step 1: Add the tab helpers**

Add these exports near the other sheet helpers (after `provisionRegionSheets`). They reuse `connectToSheets`, `CONFIG_SPREADSHEET_ID`, and `getSpreadsheetSheets` (already in this file). A new region tab is created by **duplicating an existing standard region tab** (preserves headers, data validations, the `=IMAGE` column, formatting) then clearing data rows.

```ts
const NON_TEMPLATE_TABS = new Set(["_config", "For RI", "For FA", "UNKNOWN"]);

/** Picks a standard region tab to use as the structural template. */
async function findTemplateSheetId(
  glSheets: WrappedSheetsClient,
  glAuth: InstanceType<typeof google.auth.GoogleAuth>,
): Promise<number> {
  const sheets = await getSpreadsheetSheets(glSheets, glAuth, CONFIG_SPREADSHEET_ID);
  const template = sheets.find(
    (s) =>
      s.properties?.title &&
      !NON_TEMPLATE_TABS.has(s.properties.title) &&
      s.properties.sheetId != null,
  );
  if (!template?.properties?.sheetId == null) {
    throw new Error("No existing region tab to use as a template.");
  }
  return template!.properties!.sheetId!;
}

/** Creates a region tab by duplicating a template tab, renaming it, clearing data rows (3+). */
export async function createRegionSheetTab(name: string): Promise<void> {
  const { glAuth, glSheets } = await connectToSheets();

  // Refuse if a tab with this name already exists.
  const existing = await getSpreadsheetSheets(glSheets, glAuth, CONFIG_SPREADSHEET_ID);
  if (existing.some((s) => s.properties?.title === name)) return;

  const templateId = await findTemplateSheetId(glSheets, glAuth);

  const dup = await glSheets.spreadsheets.batchUpdate({
    auth: glAuth,
    spreadsheetId: CONFIG_SPREADSHEET_ID,
    requestBody: {
      requests: [{ duplicateSheet: { sourceSheetId: templateId, newSheetName: name } }],
    },
  });

  const newSheetId =
    dup.data.replies?.[0]?.duplicateSheet?.properties?.sheetId ?? null;
  if (newSheetId == null) throw new Error("Failed to create region tab.");

  // Clear data rows (row 3 down) on the new tab; keep header rows 1–2.
  await glSheets.spreadsheets.values.clear({
    auth: glAuth,
    spreadsheetId: CONFIG_SPREADSHEET_ID,
    range: `'${name}'!A3:Z`,
  });
}

/** Renames a region tab (used when a region is renamed in the DB). No-op if missing. */
export async function renameRegionSheetTab(
  oldName: string,
  newName: string,
): Promise<void> {
  const { glAuth, glSheets } = await connectToSheets();
  const sheets = await getSpreadsheetSheets(glSheets, glAuth, CONFIG_SPREADSHEET_ID);
  const target = sheets.find((s) => s.properties?.title === oldName);
  const sheetId = target?.properties?.sheetId;
  if (sheetId == null) return;

  await glSheets.spreadsheets.batchUpdate({
    auth: glAuth,
    spreadsheetId: CONFIG_SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, title: newName },
            fields: "title",
          },
        },
      ],
    },
  });
}

/** Deletes a region tab. No-op if missing. */
export async function deleteRegionSheetTab(name: string): Promise<void> {
  const { glAuth, glSheets } = await connectToSheets();
  const sheets = await getSpreadsheetSheets(glSheets, glAuth, CONFIG_SPREADSHEET_ID);
  const target = sheets.find((s) => s.properties?.title === name);
  const sheetId = target?.properties?.sheetId;
  if (sheetId == null) return;

  await glSheets.spreadsheets.batchUpdate({
    auth: glAuth,
    spreadsheetId: CONFIG_SPREADSHEET_ID,
    requestBody: { requests: [{ deleteSheet: { sheetId } }] },
  });
}
```

> `getSpreadsheetSheets` is currently a private function in this file — confirm
> it is in scope (it is, same module). If its `fields` mask omits `sheetId`,
> ensure it requests `sheets.properties` (it does: `fields: "sheets.properties"`).

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors. Fix the `findTemplateSheetId` guard if `tsc` flags the `!= null` expression (use an explicit `if (template?.properties?.sheetId == null) throw ...; return template.properties.sheetId;`).

- [ ] **Step 3: Commit**

```bash
git add lib/services/helper.service.ts
git commit -m "feat(sheets): region tab create/rename/delete helpers"
```

---

## Phase D — Region service (orchestration + tested delete logic)

### Task 4: Validation schemas

**Files:**
- Create: `lib/validation/regions.ts`

- [ ] **Step 1: Create the schemas**

```ts
import { z } from "zod";
import { RegionColorEnum } from "@/lib/db/enums";

const regionName = z
  .string()
  .trim()
  .min(1, "Region name is required")
  .max(60, "Region name too long");

export const createRegionSchema = z.object({
  name: regionName,
  color: RegionColorEnum.nullable().optional(),
});

export const renameRegionSchema = z.object({
  id: z.string().uuid(),
  name: regionName,
});

export const regionIdSchema = z.object({ id: z.string().uuid() });

export const deleteRegionSchema = z.object({
  id: z.string().uuid(),
  /** Required to delete a populated region; ignored for empty ones. */
  force: z.boolean().optional(),
});

export type CreateRegionInput = z.infer<typeof createRegionSchema>;
export type RenameRegionInput = z.infer<typeof renameRegionSchema>;
export type DeleteRegionInput = z.infer<typeof deleteRegionSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add lib/validation/regions.ts
git commit -m "feat(regions): CRUD validation schemas"
```

---

### Task 5: Region service — create / rename / archive

**Files:**
- Modify: `lib/services/regions.service.ts`

- [ ] **Step 1: Replace the service create/rename/archive logic**

Replace the contents of `lib/services/regions.service.ts` with (delete logic added in Task 7):

```ts
import * as regionsRepo from "../repo/regions.repo";
import {
  createRegionSheetTab,
  renameRegionSheetTab,
  provisionRegionSheets,
} from "./helper.service";
import { AppError } from "../error/app-error";
import type { RegionColor } from "../db/enums";

export const createRegion = async (data: {
  name: string;
  color: RegionColor | null;
}) => {
  const existing = await regionsRepo.findRegionByName(data.name);
  if (existing) throw new AppError(`Region "${data.name}" already exists.`);

  const [region] = await regionsRepo.insertRegion({
    name: data.name,
    color: data.color ?? null,
  });

  // Create + provision the sheet tab (headers, protections, _config!B2).
  await createRegionSheetTab(data.name);
  await provisionRegionSheets();

  return region;
};

export const renameRegion = async (data: { id: string; name: string }) => {
  const region = await regionsRepo.findRegionById(data.id);
  if (!region) throw new AppError("Region not found.");
  if (region.name === data.name) return region;

  const clash = await regionsRepo.findRegionByName(data.name);
  if (clash) throw new AppError(`Region "${data.name}" already exists.`);

  const oldName = region.name;
  const [updated] = await regionsRepo.updateRegionName(data.id, data.name);

  // Rename the sheet tab to keep sync (which matches tabs by name) working,
  // then refresh _config!B2.
  await renameRegionSheetTab(oldName, data.name);
  await provisionRegionSheets();

  return updated;
};

export const setRegionArchived = async (id: string, archived: boolean) => {
  const region = await regionsRepo.findRegionById(id);
  if (!region) throw new AppError("Region not found.");
  const [updated] = await regionsRepo.setRegionArchived(id, archived);
  // Archiving leaves the sheet tab in place (history preserved); refresh B2 so
  // the list reflects active regions if downstream consumers care.
  return updated;
};
```

> `AppError` import path: confirm against `cats.service.ts` (`../error/app-error`).

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: errors only from the removed `syncRegionsFromEnum` (its callers are cleaned in Task 11). If `app/actions/system.ts` still imports it, temporarily leave that import — Task 11 removes it. To keep the tree compiling between tasks, you may keep a thin `syncRegionsFromEnum` export until Task 11; if so, retain the old function body for now.

- [ ] **Step 3: Commit**

```bash
git add lib/services/regions.service.ts
git commit -m "feat(regions): service create/rename/archive with sheet tab sync"
```

---

### Task 6: Failing test for populated-region delete (orphan logic)

**Files:**
- Create: `__tests__/services/regions-delete.test.ts`

This tests the pure decision logic: given region usage and orphan cat IDs, the
service deletes the region, deletes only fully-orphaned cats, and removes the tab.
Follow the existing DB+Sheets mocking pattern (see other `__tests__/services/*`).

- [ ] **Step 1: Write the failing test**

```ts
import { jest } from "@jest/globals";

const mockRepo = {
  findRegionById: jest.fn(),
  getRegionUsage: jest.fn(),
  findCatsOnlyInRegion: jest.fn(),
  deleteRegion: jest.fn(),
};
const mockCatsRepo = { deleteCatsByIds: jest.fn() };
const mockSheets = { deleteRegionSheetTab: jest.fn(), provisionRegionSheets: jest.fn() };

jest.unstable_mockModule("@/lib/repo/regions.repo", () => mockRepo);
jest.unstable_mockModule("@/lib/repo/cats.repo", () => mockCatsRepo);
jest.unstable_mockModule("@/lib/services/helper.service", () => mockSheets);

const { deleteRegion } = await import("@/lib/services/regions.service");

beforeEach(() => jest.clearAllMocks());

it("empty region: deletes region + tab, no cat deletion", async () => {
  mockRepo.findRegionById.mockResolvedValue({ id: "r1", name: "TEST" });
  mockRepo.getRegionUsage.mockResolvedValue({ sessionCount: 0, catCount: 0 });
  mockRepo.findCatsOnlyInRegion.mockResolvedValue([]);

  await deleteRegion({ id: "r1" });

  expect(mockRepo.deleteRegion).toHaveBeenCalledWith("r1");
  expect(mockCatsRepo.deleteCatsByIds).not.toHaveBeenCalled();
  expect(mockSheets.deleteRegionSheetTab).toHaveBeenCalledWith("TEST");
});

it("populated region without force: throws with impact, deletes nothing", async () => {
  mockRepo.findRegionById.mockResolvedValue({ id: "r1", name: "TEST" });
  mockRepo.getRegionUsage.mockResolvedValue({ sessionCount: 3, catCount: 5 });

  await expect(deleteRegion({ id: "r1" })).rejects.toThrow(/3 session/);
  expect(mockRepo.deleteRegion).not.toHaveBeenCalled();
});

it("populated region with force: deletes region + only orphaned cats + tab", async () => {
  mockRepo.findRegionById.mockResolvedValue({ id: "r1", name: "TEST" });
  mockRepo.getRegionUsage.mockResolvedValue({ sessionCount: 3, catCount: 5 });
  mockRepo.findCatsOnlyInRegion.mockResolvedValue(["c1", "c2"]);

  await deleteRegion({ id: "r1", force: true });

  expect(mockRepo.deleteRegion).toHaveBeenCalledWith("r1");
  expect(mockCatsRepo.deleteCatsByIds).toHaveBeenCalledWith(["c1", "c2"]);
  expect(mockSheets.deleteRegionSheetTab).toHaveBeenCalledWith("TEST");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm jest __tests__/services/regions-delete.test.ts`
Expected: FAIL — `deleteRegion` not exported / `deleteCatsByIds` missing.

> If the existing suites use `jest.mock` (CJS) rather than `unstable_mockModule`
> (ESM), match the existing files' style instead of the above.

---

### Task 7: Implement `deleteRegion` + `deleteCatsByIds`

**Files:**
- Modify: `lib/repo/cats.repo.ts` (add `deleteCatsByIds`)
- Modify: `lib/services/regions.service.ts`

- [ ] **Step 1: Add `deleteCatsByIds` to cats repo**

In `lib/repo/cats.repo.ts` (it already imports `inArray` or add it), add:

```ts
export const deleteCatsByIds = (ids: string[], client: DB = db) =>
  ids.length === 0
    ? Promise.resolve([])
    : client.delete(cats).where(inArray(cats.id, ids)).returning({ id: cats.id });
```

(Ensure `inArray` is imported from `drizzle-orm` and `cats` from the schema in that file.)

- [ ] **Step 2: Add `deleteRegion` to the region service**

Append to `lib/services/regions.service.ts`:

```ts
import * as catsRepo from "../repo/cats.repo";
import { db } from "../db";
import { deleteRegionSheetTab } from "./helper.service";

/**
 * Deletes a region. Empty regions delete freely. Populated regions require
 * `force: true`; without it, throws an impact summary for the UI to confirm.
 * With force: deletes the region (cascading its sessions + session_cats), then
 * deletes only cats that were fully orphaned by that (no sessions elsewhere),
 * then removes the sheet tab. FK cascade is NOT used for cats — see plan intro.
 */
export const deleteRegion = async (data: { id: string; force?: boolean }) => {
  const region = await regionsRepo.findRegionById(data.id);
  if (!region) throw new AppError("Region not found.");

  const usage = await regionsRepo.getRegionUsage(data.id);
  const populated = usage.sessionCount > 0 || usage.catCount > 0;

  if (populated && !data.force) {
    throw new AppError(
      `Region "${region.name}" has ${usage.sessionCount} session(s) and ${usage.catCount} cat(s). ` +
        `Confirm to delete it and the cats that exist only in this zone.`,
    );
  }

  const orphanIds = populated
    ? await regionsRepo.findCatsOnlyInRegion(data.id)
    : [];

  await db.transaction(async (tx) => {
    // Deleting the region cascades its sessions + session_cats (schema FKs).
    await regionsRepo.deleteRegion(data.id, tx);
    if (orphanIds.length > 0) await catsRepo.deleteCatsByIds(orphanIds, tx);
  });

  await deleteRegionSheetTab(region.name);

  return { deletedRegion: region.name, deletedCats: orphanIds.length };
};
```

> This service touches `db.transaction` directly for atomicity across two repos —
> consistent with `cats.service.ts`, which also wraps repo calls in
> `db.transaction`. The repo functions accept the `tx` client.

- [ ] **Step 3: Run the test**

Run: `pnpm jest __tests__/services/regions-delete.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/repo/cats.repo.ts lib/services/regions.service.ts __tests__/services/regions-delete.test.ts
git commit -m "feat(regions): guarded delete of populated region + orphaned cats (tested)"
```

---

## Phase E — Server actions

### Task 8: Region CRUD admin actions

**Files:**
- Create: `app/actions/regions.ts`

- [ ] **Step 1: Create the actions**

```ts
"use server";
import { actionClient } from "@/lib/error/actions-handler";
import * as service from "@/lib/services/regions.service";
import * as regionsRepo from "@/lib/repo/regions.repo";
import { requireRole, requireAuth, ADMIN_ONLY } from "@/lib/auth/rbac";
import {
  createRegionSchema,
  renameRegionSchema,
  regionIdSchema,
  deleteRegionSchema,
} from "@/lib/validation/regions";
import { z } from "zod";

export const listRegions = actionClient.action(async () => {
  await requireAuth();
  return await regionsRepo.findRegions();
});

export const createRegion = actionClient
  .schema(createRegionSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await service.createRegion({
      name: parsedInput.name,
      color: parsedInput.color ?? null,
    });
  });

export const renameRegion = actionClient
  .schema(renameRegionSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await service.renameRegion(parsedInput);
  });

export const setRegionArchived = actionClient
  .schema(regionIdSchema.extend({ archived: z.boolean() }))
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await service.setRegionArchived(parsedInput.id, parsedInput.archived);
  });

export const getRegionUsage = actionClient
  .schema(regionIdSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await regionsRepo.getRegionUsage(parsedInput.id);
  });

export const deleteRegion = actionClient
  .schema(deleteRegionSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await service.deleteRegion(parsedInput);
  });
```

> Confirm `actionClient` import path against `app/actions/cats.ts`
> (`@/lib/error/actions-handler`) and that `.action()` with no `.schema()` is
> allowed for `listRegions` (if not, give it `.schema(z.object({}))`).

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/actions/regions.ts
git commit -m "feat(regions): admin CRUD server actions"
```

---

## Phase F — Admin UI (settings style + Edit Regions)

### Task 9: Region management section component

**Files:**
- Create: `components/app-pages/users/region-controls.tsx`

- [ ] **Step 1: Build the component**

Settings-style card: heading + white box. Lists regions with rename/archive/delete; an add-region form; delete shows impact + typed confirm for populated regions. Uses brand tokens.

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listRegions,
  createRegion,
  renameRegion,
  setRegionArchived,
  getRegionUsage,
  deleteRegion,
} from "@/app/actions/regions";
import { REGION_COLOR_VALUES } from "@/lib/db/enums";
import { CustomSelect } from "@/components/ui/custom-select";

type Region = {
  id: string;
  name: string;
  color: string | null;
  archived_at: Date | string | null;
};

export function RegionControls() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    name: string;
    impact: string | null;
  } | null>(null);

  async function refresh() {
    const res = await listRegions();
    if (res?.data) setRegions(res.data as Region[]);
  }
  useEffect(() => {
    refresh();
  }, []);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      }
    });
  }

  const visible = regions
    .filter((r) => (showArchived ? true : !r.archived_at))
    .sort((a, b) => a.name.localeCompare(b.name));

  async function handleDeleteClick(r: Region) {
    setError(null);
    // Probe usage to show impact; empty → null impact (delete freely).
    const res = await getRegionUsage({ id: r.id });
    const u = res?.data;
    const impact =
      u && (u.sessionCount > 0 || u.catCount > 0)
        ? `${u.sessionCount} session(s), ${u.catCount} cat(s) in this zone`
        : null;
    setConfirmDelete({ id: r.id, name: r.name, impact });
  }

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-border">
      <h2 className="mb-1 text-sm font-bold text-brand-dark">Edit Regions</h2>
      <p className="mb-4 text-xs text-brand-dark/55">
        Add, rename, archive, or delete regions. Sheet tabs are created and renamed
        automatically.
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      {/* Add region */}
      <div className="mb-4 flex flex-col gap-2 rounded-xl bg-brand-cream/60 p-3 ring-1 ring-border sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-brand-orange">
            New region
          </label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. NEW ZONE"
            className="mt-1 h-10 w-full rounded-xl border border-brand-orange/30 bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-brand-orange/40"
          />
        </div>
        <div className="w-full sm:w-36">
          <label className="text-[11px] font-bold uppercase tracking-wider text-brand-orange">
            Color
          </label>
          <div className="mt-1">
            <CustomSelect
              options={["—", ...REGION_COLOR_VALUES]}
              value={newColor || "—"}
              onChange={(v) => setNewColor(v === "—" ? "" : v)}
              variant="white"
              size="sm"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={isPending || !newName.trim()}
          onClick={() =>
            run(async () => {
              await createRegion({
                name: newName.trim(),
                color: (newColor || null) as never,
              });
              setNewName("");
              setNewColor("");
            })
          }
          className="h-10 shrink-0 rounded-full bg-brand-dark px-4 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Add region
        </button>
      </div>

      <label className="mb-2 flex items-center gap-2 text-xs text-brand-dark/60">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Show archived
      </label>

      {/* Region list */}
      <div className="divide-y divide-border">
        {visible.map((r) => (
          <div key={r.id} className="flex items-center gap-2 py-2">
            {renamingId === r.id ? (
              <>
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="h-8 flex-1 rounded-lg border border-brand-orange/30 bg-white px-2 text-sm outline-none"
                />
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    run(async () => {
                      await renameRegion({ id: r.id, name: renameValue.trim() });
                      setRenamingId(null);
                    })
                  }
                  className="rounded-full bg-brand-green px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingId(null)}
                  className="px-2 text-xs font-bold text-brand-dark/50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-semibold text-brand-dark">
                  {r.name}
                  {r.archived_at && (
                    <span className="ml-2 rounded-full bg-brand-dark/10 px-2 py-0.5 text-[10px] font-bold text-brand-dark/50">
                      archived
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingId(r.id);
                    setRenameValue(r.name);
                  }}
                  className="rounded-full px-2 py-1 text-xs font-bold text-brand-dark/60 hover:text-brand-dark"
                >
                  Rename
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    run(() => setRegionArchived({ id: r.id, archived: !r.archived_at }))
                  }
                  className="rounded-full px-2 py-1 text-xs font-bold text-brand-dark/60 hover:text-brand-dark disabled:opacity-40"
                >
                  {r.archived_at ? "Unarchive" : "Archive"}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDeleteClick(r)}
                  className="rounded-full px-2 py-1 text-xs font-bold text-red-600/80 hover:text-red-600 disabled:opacity-40"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <DeleteRegionConfirm
          name={confirmDelete.name}
          impact={confirmDelete.impact}
          pending={isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() =>
            run(async () => {
              await deleteRegion({
                id: confirmDelete.id,
                force: confirmDelete.impact != null,
              });
              setConfirmDelete(null);
            })
          }
        />
      )}
    </div>
  );
}

function DeleteRegionConfirm({
  name,
  impact,
  pending,
  onCancel,
  onConfirm,
}: {
  name: string;
  impact: string | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const needsType = impact != null;
  const canConfirm = !needsType || typed === name;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-brand-cream p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-heading text-lg font-bold text-brand-dark">
          Delete “{name}”?
        </h3>
        {impact ? (
          <>
            <p className="mt-2 text-sm text-red-600">
              This deletes {impact}, including cats that exist only in this zone.
              This cannot be undone.
            </p>
            <p className="mt-3 text-xs text-brand-dark/60">
              Type the region name to confirm:
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-red-300 bg-white px-2 text-sm outline-none"
            />
          </>
        ) : (
          <p className="mt-2 text-sm text-brand-dark/70">
            This region is empty. It and its (empty) sheet tab will be removed.
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-bold text-brand-dark/60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm || pending}
            onClick={onConfirm}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

> Confirm `CustomSelect` supports `size="sm"` and `variant="white"` (used in
> `cat-entry-form.tsx` / `database-medical-screen.tsx` — it does).

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/app-pages/users/region-controls.tsx
git commit -m "feat(admin): Edit Regions section (add/rename/archive/delete with impact confirm)"
```

---

### Task 10: Restyle Admin tab as a settings page + mount Regions

**Files:**
- Modify: `components/app-pages/users/users-screen.tsx` (AdminScreen)

- [ ] **Step 1: Wrap each section in a settings-style card and add Regions**

Per `feedback_admin_tab_settings_style`: main title → clear section headings → white rounded box per section. In both the mobile (`tablet:hidden`) and desktop (`tablet:block`) blocks:

1. Keep the page title ("Admin").
2. Import the new section: `import { RegionControls } from "./region-controls";`
3. Render sections as cards in this order, each a white rounded box with a heading:
   - **Users & Access** (wrap the existing search + user list in a `rounded-2xl bg-white p-4 ring-1 ring-border` card with an `<h2>Users & Access</h2>` heading).
   - **Edit Regions** → `<RegionControls />` (already a white card).
   - **Sheet Setup & Maintenance** → `<SheetSetupControls />` (already a card).
   - **GSheet Sync** → `<SyncControls />` (already a card).

Concretely, replace the desktop controls grid:

```tsx
<div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
  <SheetSetupControls />
  <SyncControls initialStatus={initialSyncStatus} />
</div>
```

with a single settings column:

```tsx
<div className="mt-5 space-y-4">
  <RegionControls />
  <SheetSetupControls />
  <SyncControls initialStatus={initialSyncStatus} />
</div>
```

and do the equivalent on mobile (the `mb-4 space-y-3` block): add `<RegionControls />` first.

> Keep this task light — the user list section already renders inside a white
> card on desktop; on mobile, optionally wrap the list in a matching card. Do not
> restructure the user-management logic, only the visual grouping.

- [ ] **Step 2: Type-check + build**

Run: `pnpm tsc --noEmit`
Run: `pnpm build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add components/app-pages/users/users-screen.tsx
git commit -m "feat(admin): settings-style sections; mount Edit Regions"
```

---

## Phase G — Cleanup

### Task 11: Remove the obsolete enum-seed path

**Files:**
- Modify: `app/actions/system.ts`
- Modify: `components/app-pages/users/sheet-setup-controls.tsx`
- Modify: `lib/services/regions.service.ts` (remove `syncRegionsFromEnum` if still present)
- Modify: `lib/repo/regions.repo.ts` (remove `insertMissingRegions` if still present)

The regions table is now the source of truth and is managed via the Edit Regions
UI, so the enum→table seed (`syncRegions`) is obsolete.

- [ ] **Step 1: Remove the `syncRegions` action**

In `app/actions/system.ts`, delete the `syncRegions` export and its
`syncRegionsFromEnum` import.

- [ ] **Step 2: Remove the "Sync regions from enum" button**

In `components/app-pages/users/sheet-setup-controls.tsx`, delete the first
`ActionRow` ("Sync regions from enum") and the `syncRegions` import. Leave
"Provision region sheets" and "Seed missing UUIDs".

- [ ] **Step 3: Remove dead seed helpers**

Delete `syncRegionsFromEnum` from `lib/services/regions.service.ts` and
`insertMissingRegions` from `lib/repo/regions.repo.ts` if they remain.

- [ ] **Step 4: Type-check + tests + build**

Run: `pnpm tsc --noEmit`
Run: `pnpm jest`
Run: `pnpm build`
Expected: all green. (`REGION_NAME_VALUES` stays in `enums.ts` as seed data + the Region filter options — do NOT delete it.)

- [ ] **Step 5: Commit**

```bash
git add app/actions/system.ts components/app-pages/users/sheet-setup-controls.tsx lib/services/regions.service.ts lib/repo/regions.repo.ts
git commit -m "chore(regions): remove obsolete enum-seed path (table is source of truth)"
```

---

## Phase H — Docs

### Task 12: Update the GSheets setup guide

**Files:**
- Modify: `docs/gsheets-sync-setup-guide.md`

- [ ] **Step 1: Replace the add-region runbook with the in-app flow**

In §5 "Adding a new region", replace the dev+deploy runbook with:

> Adding a region is now fully in-app (Admin → Edit Regions): type the name +
> pick a color → **Add region**. This inserts the DB row, creates the Google
> Sheet tab (duplicated from a template tab), applies protections, and refreshes
> `_config!B2`. Rename/Archive/Delete are in the same section. No code or deploy.

Update §7 "Design decisions" to note regions are now data-driven (text column),
and §8 to remove `syncRegions` from any live-action list.

- [ ] **Step 2: Commit**

```bash
git add docs/gsheets-sync-setup-guide.md
git commit -m "docs(regions): in-app region management replaces dev add-region runbook"
```

---

## Final verification

### Task 13: Full sweep

- [ ] **Step 1:** `pnpm tsc --noEmit` → no errors.
- [ ] **Step 2:** `pnpm jest` → all suites pass (incl. `regions-delete`).
- [ ] **Step 3:** `pnpm build` → succeeds.
- [ ] **Step 4:** Manual smoke (not via `pnpm dev` — reason through it / optional staging): create a test region → confirm tab created + protected; rename it → tab renamed; archive → drops from active lists; delete empty test region → row + tab gone.

---

## Notes / coupling

- **Migration ordering:** Task 1 (schema) must land before everything else.
- **Sheet ↔ DB name coupling:** rename must update both (Task 5). This is the only place region *name* couples outside the DB (everything else is by `region_id`).
- **Delete semantics:** empty → free; populated → `force` + typed-name confirm; cats deleted only if fully orphaned (Task 7). Cascade FKs untouched.
- **`REGION_NAME_VALUES` stays** as seed/initial data and the Region filter dropdown source — only its role as a DB constraint is removed.
- **Driver shape** for raw SQL in `findCatsOnlyInRegion` (Task 2) — verify against the existing `db` driver before relying on `.rows`.
