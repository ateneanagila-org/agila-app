# P1 — Admin & Region Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair ten defects in the Admin screen and the region subsystem — two of which silently destroy data — so P2 and P3 can extend that surface safely.

**Architecture:** Region deletion stops using a mutation to ask a question: the confirm modal opens client-side with no server call, then deletes with `force: true`. Region tab creation sources the curated `TEMPLATE` tab by name and stamps the new tab's title row. The Apps Script orphan check becomes a structural test on the tab instead of a race against the app. The Admin screen gains server-seeded regions, a shared error surface, and the same mobile layout shape every other screen uses.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Drizzle ORM, Zod 4 + drizzle-zod, next-safe-action 8, Tailwind 4, Jest (node env), Google Apps Script.

**Spec:** [`docs/specs/2026-08-10-admin-region-repair-design.md`](../specs/2026-08-10-admin-region-repair-design.md)

## Global Constraints

- **pnpm only.** Never `npm`. Type-check with `pnpm tsc --noEmit`; test with `pnpm jest __tests__`.
- **Never run `pnpm dev` to verify.** Trust the code plus the type-checker and tests.
- **Services must never call `db.*` directly.** All DB access goes through `lib/repo/`.
- **Never hardcode hex brand values in components** — use brand tokens (`bg-brand-orange`, `text-brand-dark`, …). The one exception in this plan is the region colour swatch map in Task 5, which maps a DB enum to display colours and is explicitly not a brand token.
- **Do not write setState patterns that cascade renders** (synchronous setState chains in render or effects).
- **Server semantics of `deleteRegion` must not change.** `__tests__/services/regions-delete.test.ts` must stay green without edits.
- **UI is not unit-tested in this codebase** (`testEnvironment: "node"`, no component tests). For UI-only tasks the verification step is `pnpm tsc --noEmit` plus the listed manual checks. Do not add React Testing Library.
- **Apps Script is not deployed by the app.** `workers/apps-script/*.gs` must be pasted into the spreadsheet's script editor by hand.
- Mobile/desktop are sibling JSX branches in one file (`tablet:hidden` / `hidden tablet:block`). Keep both in sync.

## Task Order & Dependencies

```
Task 1  region delete confirm         (region-controls.tsx)          independent
Task 2  TEMPLATE source + A1 title    (constants, helper.service)    independent
Task 3  Apps Script orphan test       (Protection.gs)                independent
Task 4  updateRegion backend          (validation→repo→service→action) independent
Task 5  region colour UI              (region-controls.tsx)          needs Task 4
Task 6  server-seed regions           (page, admin-screen, hook)     needs Task 5
Task 7  admin mobile layout           (admin-screen, loading)        needs Task 6
Task 8  error banner + role rollback  (admin-screen)                 needs Task 7
```

Tasks 1–4 may run in any order. Tasks 5–8 touch overlapping files and must run in sequence.

---

### Task 1: Region delete confirms before touching the server

Closes **G1** (empty regions delete on one click) and **G2** (control flow via error-string matching).

**Files:**
- Modify: `components/app-pages/admin/region-controls.tsx`

**Interfaces:**
- Consumes: `deleteRegion` from `@/app/actions/regions` — signature unchanged: `deleteRegion({ id: string, force?: boolean })`
- Produces: nothing consumed by later tasks

**Background:** `handleDeleteClick` currently calls `deleteRegion({ id })` with no `force` as a *probe*, relying on the server throwing "not empty" to decide whether to show a confirm dialog. For an empty region the server does not throw — it deletes the row and the sheet tab immediately. The fix removes the probe entirely.

- [ ] **Step 1: Drop `warningText` from the confirm state**

In `region-controls.tsx`, change the state declaration (currently around line 38):

```tsx
  // Delete confirm modal
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
```

- [ ] **Step 2: Make `handleDeleteClick` synchronous and non-destructive**

Replace the whole `handleDeleteClick` function (currently around lines 75–91):

```tsx
  /**
   * Opens the confirm modal. Deliberately makes NO server call — the previous
   * implementation probed with an unforced deleteRegion, which the server
   * treats as a real delete for an empty region (row + sheet tab gone before
   * any dialog appeared).
   */
  function handleDeleteClick(r: Region) {
    setError(null);
    setConfirmDelete({ id: r.id, name: r.name });
  }
```

- [ ] **Step 3: Give the confirm modal static worst-case copy**

Replace the `DeleteRegionConfirm` component's props type and its warning paragraph. Change the signature:

```tsx
function DeleteRegionConfirm({
  name,
  pending,
  onCancel,
  onConfirm,
}: {
  name: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
```

and replace the warning paragraph (currently `{warningText ?? "This cannot be undone."}`):

```tsx
        <p className="mt-2 text-sm text-red-600">
          Deleting <strong>{name}</strong> permanently removes the region, all of
          its sessions, and any cats that exist only in this zone. This cannot be
          undone.
        </p>
```

- [ ] **Step 4: Update the call site to stop passing `warningText`**

In the `{confirmDelete && (...)}` block near the end of `RegionControls`:

```tsx
      {confirmDelete && (
        <DeleteRegionConfirm
          name={confirmDelete.name}
          pending={isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() =>
            run(async () => {
              const res = await deleteRegion({
                id: confirmDelete.id,
                force: true,
              });
              if (res?.serverError) throw new Error(res.serverError);
              setConfirmDelete(null);
            })
          }
        />
      )}
```

- [ ] **Step 5: Type-check**

Run: `pnpm tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 6: Confirm the server tests still pass untouched**

Run: `pnpm jest __tests__/services/regions-delete.test.ts`
Expected: PASS, 3 tests. This task changed no server code — if this fails, something was edited that should not have been.

- [ ] **Step 7: Commit**

```bash
git add components/app-pages/admin/region-controls.tsx
git commit -m "fix(admin): confirm region delete before calling the server

An unforced deleteRegion was used as a probe to detect an empty region, but
the server treats that as a real delete — empty regions were removed on the
first trash click with no confirmation. The confirm modal now opens with no
server call and deletes with force: true, which also removes the dependency
on matching the 'not empty' error string."
```

---

### Task 2: Source new region tabs from `TEMPLATE` and title them

Closes **G3** (clones a live region) and **G7** (new tab keeps the cloned region's title).

**Files:**
- Modify: `lib/constants.ts`
- Modify: `lib/services/helper.service.ts` (`findTemplateSheetId`, `createRegionSheetTab`)
- Create: `__tests__/services/region-sheet-tab.test.ts`

**Interfaces:**
- Produces: `TEMPLATE_TAB_NAME` exported from `@/lib/constants` (string literal `"TEMPLATE"`), used by `helper.service.ts` and by the test.

**Background:** `NON_REGION_TABS` contains `"TEMPLATE"`, and `findTemplateSheetId` picks the first tab *not* in that set — so it skips the curated template and duplicates a real region tab. Separately, `createRegionSheetTab` clears `A3:Z` but never writes row 1, which on a region sheet is the title.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/region-sheet-tab.test.ts`:

```ts
// Mock the seams BEFORE importing the module under test, mirroring
// __tests__/services/forward-sync.test.ts. googleapis hands back a per-test
// fake stored on globalThis; wrapSheetsClient becomes a pass-through so the
// 1.2s pacing never runs in tests.
jest.mock("googleapis", () => ({
  google: {
    auth: {
      GoogleAuth: class {
        async getAccessToken() {
          return "token";
        }
      },
    },
    sheets: () =>
      (globalThis as unknown as { __fakeSheets: unknown }).__fakeSheets,
  },
}));

jest.mock("@/lib/services/sheets-client.service", () => ({
  wrapSheetsClient: (raw: unknown) => raw,
  __resetPacingForTests: () => {},
}));

jest.mock("@/lib/db", () => ({ db: {}, Transaction: class {} }));
jest.mock("@/lib/services/system.service", () => ({ isSyncFrozen: jest.fn() }));
jest.mock("@/lib/repo/cats.repo", () => ({ findCatsByIds: jest.fn() }));
jest.mock("@/lib/repo/regions.repo", () => ({
  findRegions: jest.fn(),
  findRegionById: jest.fn(),
}));
jest.mock("@/lib/repo/sessions.repo", () => ({
  resolveCatRegion: jest.fn(),
  findLatestSessionDateForCat: jest.fn(),
}));

import { createRegionSheetTab } from "@/lib/services/helper.service";

interface FakeSheets {
  spreadsheets: {
    get: jest.Mock;
    batchUpdate: jest.Mock;
    values: {
      get: jest.Mock;
      batchGet: jest.Mock;
      update: jest.Mock;
      batchUpdate: jest.Mock;
      clear: jest.Mock;
    };
  };
}

function makeFakeSheets(): FakeSheets {
  return {
    spreadsheets: {
      get: jest.fn().mockResolvedValue({ data: { sheets: [] } }),
      batchUpdate: jest.fn().mockResolvedValue({
        data: { replies: [{ duplicateSheet: { properties: { sheetId: 99 } } }] },
      }),
      values: {
        get: jest.fn().mockResolvedValue({ data: { values: [] } }),
        batchGet: jest.fn().mockResolvedValue({ data: {} }),
        update: jest.fn().mockResolvedValue({ data: {} }),
        batchUpdate: jest.fn().mockResolvedValue({ data: {} }),
        clear: jest.fn().mockResolvedValue({ data: {} }),
      },
    },
  };
}

/** A spreadsheets.get reply listing the given tab titles. */
function sheetsNamed(...titles: string[]) {
  return {
    data: {
      sheets: titles.map((title, i) => ({
        properties: { title, sheetId: i + 1 },
      })),
    },
  };
}

let fakeSheets: FakeSheets;

beforeAll(() => {
  process.env.SERVICE_ACCOUNT_CREDENTIALS = JSON.stringify({
    client_email: "svc@example.com",
    private_key: "key",
  });
});

beforeEach(() => {
  fakeSheets = makeFakeSheets();
  (globalThis as unknown as { __fakeSheets: FakeSheets }).__fakeSheets =
    fakeSheets;
});

describe("createRegionSheetTab", () => {
  it("duplicates the tab named TEMPLATE, not the first region tab", async () => {
    // GATE 3 sorts first and is what the old NON_REGION_TABS-based lookup picked.
    fakeSheets.spreadsheets.get.mockResolvedValue(
      sheetsNamed("GATE 3", "ARETE", "TEMPLATE"),
    );

    await createRegionSheetTab("LIBRARY");

    const req =
      fakeSheets.spreadsheets.batchUpdate.mock.calls[0][0].requestBody
        .requests[0];
    // TEMPLATE is third in the list above, so sheetId 3.
    expect(req.duplicateSheet.sourceSheetId).toBe(3);
    expect(req.duplicateSheet.newSheetName).toBe("LIBRARY");
  });

  it("throws a clear error when no TEMPLATE tab exists", async () => {
    fakeSheets.spreadsheets.get.mockResolvedValue(
      sheetsNamed("GATE 3", "ARETE"),
    );

    await expect(createRegionSheetTab("LIBRARY")).rejects.toThrow(/TEMPLATE/);
    expect(fakeSheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });

  it("stamps row 1 with the new region name", async () => {
    fakeSheets.spreadsheets.get.mockResolvedValue(sheetsNamed("TEMPLATE"));

    await createRegionSheetTab("LIBRARY");

    const titleWrite = fakeSheets.spreadsheets.values.update.mock.calls.find(
      (c) => String(c[0].range).endsWith("!A1"),
    );
    expect(titleWrite).toBeDefined();
    expect(titleWrite![0].requestBody.values).toEqual([["LIBRARY"]]);
  });

  it("clears the data rows but leaves the header rows intact", async () => {
    fakeSheets.spreadsheets.get.mockResolvedValue(sheetsNamed("TEMPLATE"));

    await createRegionSheetTab("LIBRARY");

    expect(fakeSheets.spreadsheets.values.clear).toHaveBeenCalledWith(
      expect.objectContaining({ range: "'LIBRARY'!A3:Z" }),
    );
  });

  it("is a no-op when a tab with that name already exists", async () => {
    fakeSheets.spreadsheets.get.mockResolvedValue(
      sheetsNamed("TEMPLATE", "LIBRARY"),
    );

    await createRegionSheetTab("LIBRARY");

    expect(fakeSheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });
});
```

> **Note on `spreadsheetId`:** `CONFIG_SPREADSHEET_ID` in `helper.service.ts` is a
> module-level `const` read from `process.env` at import time, so in this test it
> evaluates to `undefined`. That is harmless — assert only on `range` and
> `requestBody`, never on `spreadsheetId`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest __tests__/services/region-sheet-tab.test.ts`
Expected: FAIL. The "duplicates the tab named TEMPLATE" case fails with `sourceSheetId` `1` (GATE 3) instead of `3`; "throws a clear error" fails because the current code finds GATE 3 and proceeds; "stamps row 1" fails because no `!A1` write exists.

- [ ] **Step 3: Add the `TEMPLATE_TAB_NAME` constant**

In `lib/constants.ts`, directly below the `NON_REGION_TABS` set:

```ts
/**
 * The curated tab new region sheets are cloned from. It is intentionally also
 * present in NON_REGION_TABS — it is not a region — but that set is the wrong
 * list to pick a template from, which is how region creation ended up cloning a
 * live region tab. Look this up by name instead.
 */
export const TEMPLATE_TAB_NAME = "TEMPLATE";
```

- [ ] **Step 4: Look the template up by name**

In `lib/services/helper.service.ts`, extend the existing constants import:

```ts
import { NON_REGION_TABS, TEMPLATE_TAB_NAME } from "@/lib/constants";
```

Replace the body of `findTemplateSheetId`:

```ts
/** Resolves the curated TEMPLATE tab that new region sheets are cloned from. */
async function findTemplateSheetId(
  glSheets: WrappedSheetsClient,
  glAuth: InstanceType<typeof google.auth.GoogleAuth>,
): Promise<number> {
  const sheets = await getSpreadsheetSheets(
    glSheets,
    glAuth,
    CONFIG_SPREADSHEET_ID,
  );
  const template = sheets.find(
    (s) =>
      s.properties?.title === TEMPLATE_TAB_NAME &&
      s.properties.sheetId != null,
  );
  // Cloning a live region is never a correct fallback — it drags that region's
  // formatting, conditional rules and protections onto the new tab. Fail loudly.
  if (template?.properties?.sheetId == null) {
    throw new Error(
      `Region sheet template "${TEMPLATE_TAB_NAME}" was not found in the spreadsheet. ` +
        `Create a tab named "${TEMPLATE_TAB_NAME}" carrying the standard region header rows before adding a region.`,
    );
  }
  return template.properties.sheetId;
}
```

- [ ] **Step 5: Stamp the title row on the new tab**

In `createRegionSheetTab`, after the existing `values.clear` call, append:

```ts
  // Row 1 is the region title. The clone carries the template's title, and the
  // A3:Z clear above does not reach it — without this the new tab announces
  // itself as "TEMPLATE".
  await glSheets.spreadsheets.values.update({
    auth: glAuth,
    spreadsheetId: CONFIG_SPREADSHEET_ID,
    range: `'${name}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [[name]] },
  });
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm jest __tests__/services/region-sheet-tab.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Run the full suite and type-check**

Run: `pnpm jest __tests__ && pnpm tsc --noEmit`
Expected: all suites PASS, tsc exit 0.

- [ ] **Step 8: Commit**

```bash
git add lib/constants.ts lib/services/helper.service.ts __tests__/services/region-sheet-tab.test.ts
git commit -m "fix(sync): clone region tabs from TEMPLATE and stamp the title row

findTemplateSheetId picked the first tab absent from NON_REGION_TABS, which
excludes TEMPLATE — so it duplicated a live region, inheriting its formatting
and protections. Look the template up by name and fail loudly when missing.
Also write A1 with the new region name; the A3:Z clear never reached row 1,
so new tabs kept the cloned tab's title."
```

---

### Task 3: Make the orphan-tab check structural instead of timed

Closes **G4** (banner destroys the region title row) and the false-positive that flags freshly created region tabs.

**Files:**
- Modify: `workers/apps-script/Protection.gs` (`onSheetChange`, `warnOrphanTab`, plus one new helper)

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: nothing consumed by later tasks. This file is pasted into the spreadsheet by hand and is not imported by the app.

**Background:** `onSheetChange` currently treats "name absent from `_config!B2`" as sufficient to flag a tab. Because Apps Script trigger timing is not deterministic relative to the app's API calls, a tab the app just created can be flagged before B2 propagates. `warnOrphanTab` then merges `A1:L1` and writes a red banner into what, on a region sheet, is the title row — and `createRegionSheetTab` only clears `A3:Z`, so the damage is permanent.

There is no test runner for Apps Script. This task is verified manually in Task 3's final step and again during Task 2's manual check.

- [ ] **Step 1: Add the structural-blankness helper**

In `workers/apps-script/Protection.gs`, directly above `function onSheetChange(e)`:

```js
/**
 * True when a tab has no structure at all — every cell in A1:V2 is empty.
 *
 * This is what makes the orphan check race-proof. A tab cloned from TEMPLATE
 * always carries header row 2, so it can never be flagged no matter when this
 * trigger fires relative to the app writing _config!B2. A tab a steward creates
 * with the "+" button is genuinely blank and is still caught. The test is a
 * fact about the tab rather than a race against the app.
 */
function isStructurallyBlank(sheet) {
  var values = sheet.getRange(1, 1, 2, 22).getValues(); // A1:V2
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length; c++) {
      if (String(values[r][c]).trim() !== "") return false;
    }
  }
  return true;
}
```

- [ ] **Step 2: Narrow the orphan filter**

In `onSheetChange`, replace the `orphans` filter:

```js
  var orphans = ss.getSheets().filter(function (s) {
    var name = s.getName();
    // "_"-prefixed tabs are intentional non-region helper tabs (same opt-out
    // marker as _config). Stewards rename a helper tab to start with "_" to
    // dismiss the orphan warning — see warnOrphanTab banner copy.
    if (name.charAt(0) === "_") return false;
    if (allowed[name]) return false;
    // Only a genuinely blank tab is a hand-made orphan. Anything carrying
    // header structure is a region tab (or a clone of one) mid-provisioning.
    return isStructurallyBlank(s);
  });
```

- [ ] **Step 3: Stop the banner from consuming the title row**

In `warnOrphanTab`, delete the `merge()` block entirely and the `a1` reassignment after it. The function becomes:

```js
function warnOrphanTab(sheet) {
  var a1 = sheet.getRange("A1");
  if (String(a1.getValue()).indexOf("will NOT sync") !== -1) return;

  // Deliberately NOT merged across A1:L1. A merge here destroys the title row
  // of a region sheet if this ever fires on one, and createRegionSheetTab only
  // clears A3:Z so the damage would be permanent.
  a1.setValue(
    "⚠️ This tab was created by hand and will NOT sync — anything entered here is lost. " +
      "To add a REGION, use the app (Admin > Edit Regions), then delete this tab. " +
      'If you meant a HELPER tab (notes/stats, not a region), rename it to start with an ' +
      'underscore — e.g. "_Notes" — and this warning will stop.',
  );
  a1.setBackground("#cc0000");
  a1.setFontColor("#ffffff");
  a1.setFontWeight("bold");
  a1.setWrap(true);
}
```

- [ ] **Step 4: Deploy the script by hand**

1. Open the CATalog spreadsheet → **Extensions → Apps Script**.
2. Open the `Protection` script file.
3. Replace its contents with the updated `workers/apps-script/Protection.gs`.
4. **Save.** No trigger changes are needed — `onSheetChange` is already installed.

- [ ] **Step 5: Verify manually**

Perform each and record the result:

1. Add a region via **Admin → Regions → Add Region**. Confirm the new tab: titled with the new region name in A1, carries the template's header row 2, has empty data rows, and has **no** red banner.
2. Create a blank tab with the `+` button. Confirm it **is** bannered and the toast fires.
3. Rename that hand-made tab to `_Notes`. Confirm the warning stops on the next structural change.
4. Confirm no pre-existing region tab acquired a banner during any of the above.

If step 1 still produces a banner, do not proceed — the structural test is not matching. Check that the TEMPLATE tab actually carries content in row 2.

- [ ] **Step 6: Commit**

```bash
git add workers/apps-script/Protection.gs
git commit -m "fix(apps-script): make orphan-tab detection structural, not timed

onSheetChange flagged any tab absent from _config!B2, so a tab the app had
just created could be bannered before B2 propagated — and warnOrphanTab
merged A1:L1, destroying the region title row permanently (createRegionSheetTab
only clears A3:Z). A tab is now an orphan only when A1:V2 is entirely empty,
which a TEMPLATE clone never is, and the banner no longer merges."
```

---

### Task 4: `updateRegion` replaces `renameRegion` end to end

Backend half of **G10** (region colour is write-once dead data).

**Files:**
- Modify: `lib/validation/regions.ts`
- Modify: `lib/repo/regions.repo.ts`
- Modify: `lib/services/regions.service.ts`
- Modify: `app/actions/regions.ts`
- Modify: `components/app-pages/admin/region-controls.tsx` (call-site swap only)
- Create: `__tests__/services/regions-update.test.ts`

**Interfaces:**
- Produces, consumed by Task 5:
  - `updateRegionSchema` / `UpdateRegionInput` from `@/lib/validation/regions`
  - `updateRegion({ id: string; name?: string; color?: RegionColor | null })` server action from `@/app/actions/regions`
  - `regionsRepo.updateRegion(id, { name?, color? }, client?)` returning the updated rows
- Removes: `renameRegionSchema`, `RenameRegionInput`, `regionsRepo.updateRegionName`, `service.renameRegion`, and the `renameRegion` action.

**Background:** `regions.color` is written at creation and never read or changed. `renameRegion` early-returns when the name is unchanged, which would swallow a colour-only edit, and it unconditionally renames the sheet tab — which must not happen for a colour change.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/regions-update.test.ts`:

```ts
jest.mock("@/lib/repo/regions.repo", () => ({
  findRegionById: jest.fn(),
  findRegionByName: jest.fn(),
  updateRegion: jest.fn(),
}));
jest.mock("@/lib/services/helper.service", () => ({
  renameRegionSheetTab: jest.fn(),
  provisionRegionSheets: jest.fn(),
  createRegionSheetTab: jest.fn(),
  deleteRegionSheetTab: jest.fn(),
  syncRegionSheetNames: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  db: { transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb({})) },
  Transaction: class {},
}));

import { updateRegion } from "@/lib/services/regions.service";
import * as regionsRepo from "@/lib/repo/regions.repo";
import * as helper from "@/lib/services/helper.service";

const mockRepo = regionsRepo as jest.Mocked<typeof regionsRepo>;
const mockHelper = helper as jest.Mocked<typeof helper>;

const EXISTING = { id: "r1", name: "GATE 3", color: "Green" };

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.findRegionById.mockResolvedValue(EXISTING as never);
  mockRepo.findRegionByName.mockResolvedValue(undefined as never);
  mockRepo.updateRegion.mockResolvedValue([
    { ...EXISTING, color: "Blue" },
  ] as never);
});

describe("updateRegion", () => {
  it("colour-only change never touches the spreadsheet", async () => {
    await updateRegion({ id: "r1", color: "Blue" });

    expect(mockRepo.updateRegion).toHaveBeenCalledWith("r1", {
      color: "Blue",
    });
    expect(mockHelper.renameRegionSheetTab).not.toHaveBeenCalled();
    expect(mockHelper.provisionRegionSheets).not.toHaveBeenCalled();
  });

  it("name change renames the sheet tab and re-provisions", async () => {
    await updateRegion({ id: "r1", name: "GATE 4" });

    expect(mockRepo.updateRegion).toHaveBeenCalledWith("r1", {
      name: "GATE 4",
    });
    expect(mockHelper.renameRegionSheetTab).toHaveBeenCalledWith(
      "GATE 3",
      "GATE 4",
    );
    expect(mockHelper.provisionRegionSheets).toHaveBeenCalled();
  });

  it("name and colour together update both and rename once", async () => {
    await updateRegion({ id: "r1", name: "GATE 4", color: "Red" });

    expect(mockRepo.updateRegion).toHaveBeenCalledWith("r1", {
      name: "GATE 4",
      color: "Red",
    });
    expect(mockHelper.renameRegionSheetTab).toHaveBeenCalledTimes(1);
  });

  it("submitting the unchanged name is not treated as a rename", async () => {
    await updateRegion({ id: "r1", name: "GATE 3", color: "Red" });

    expect(mockRepo.updateRegion).toHaveBeenCalledWith("r1", { color: "Red" });
    expect(mockHelper.renameRegionSheetTab).not.toHaveBeenCalled();
  });

  it("rejects a name that collides with another region", async () => {
    mockRepo.findRegionByName.mockResolvedValue({
      id: "r2",
      name: "ARETE",
    } as never);

    await expect(updateRegion({ id: "r1", name: "ARETE" })).rejects.toThrow(
      /already exists/,
    );
    expect(mockRepo.updateRegion).not.toHaveBeenCalled();
    expect(mockHelper.renameRegionSheetTab).not.toHaveBeenCalled();
  });

  it("throws when the region does not exist", async () => {
    mockRepo.findRegionById.mockResolvedValue(undefined as never);

    await expect(updateRegion({ id: "nope", color: "Red" })).rejects.toThrow(
      /not found/,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest __tests__/services/regions-update.test.ts`
Expected: FAIL — `updateRegion is not a function` (the service still exports `renameRegion`).

- [ ] **Step 3: Replace the rename schema with an update schema**

In `lib/validation/regions.ts`, delete `renameRegionSchema` and `RenameRegionInput`, and add:

```ts
export const updateRegionSchema = z
  .object({
    id: z.string().uuid(),
    name: regionName.optional(),
    color: regionsSchema.shape.color.optional(),
  })
  .refine((v) => v.name !== undefined || v.color !== undefined, {
    message: "Provide a name or a colour to update.",
  });

export type UpdateRegionInput = z.infer<typeof updateRegionSchema>;
```

- [ ] **Step 4: Replace the repo's name-only updater**

In `lib/repo/regions.repo.ts`, delete `updateRegionName` and add:

```ts
export const updateRegion = (
  id: string,
  data: { name?: string; color?: RegionColor | null },
  client: DB = db,
) => client.update(regions).set(data).where(eq(regions.id, id)).returning();
```

`RegionColor` is already imported at the top of this file.

- [ ] **Step 5: Replace the service function**

In `lib/services/regions.service.ts`, delete `renameRegion` entirely and add:

```ts
/**
 * Updates a region's name and/or colour.
 *
 * Only a genuine rename touches the spreadsheet — colour is app-side data, so a
 * colour-only edit performs no Sheets writes at all. Submitting the unchanged
 * name counts as no rename.
 */
export const updateRegion = async (data: {
  id: string;
  name?: string;
  color?: RegionColor | null;
}) => {
  const region = await regionsRepo.findRegionById(data.id);
  if (!region) throw new AppError("Region not found.");

  const nameChanged = data.name !== undefined && data.name !== region.name;

  if (nameChanged) {
    const clash = await regionsRepo.findRegionByName(data.name!);
    if (clash) throw new AppError(`Region "${data.name}" already exists.`);
  }

  const patch: { name?: string; color?: RegionColor | null } = {};
  if (nameChanged) patch.name = data.name;
  if (data.color !== undefined) patch.color = data.color;

  const [updated] =
    Object.keys(patch).length > 0
      ? await regionsRepo.updateRegion(data.id, patch)
      : [region];

  if (nameChanged) {
    // Sync matches tabs by name, so the tab must follow the rename.
    await renameRegionSheetTab(region.name, data.name!);
    await provisionRegionSheets();
  }

  return updated;
};
```

- [ ] **Step 6: Replace the server action**

In `app/actions/regions.ts`, swap the import `renameRegionSchema` → `updateRegionSchema` and replace the `renameRegion` export:

```ts
export const updateRegion = actionClient
  .schema(updateRegionSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await service.updateRegion(parsedInput);
  });
```

- [ ] **Step 7: Swap the call site so the tree compiles**

In `components/app-pages/admin/region-controls.tsx`, change the import from `renameRegion` to `updateRegion`, and in the inline-rename save handler replace the call:

```tsx
                            const res = await updateRegion({
                              id: r.id,
                              name: renameValue.trim(),
                            });
```

The rename UI stays name-only for now — Task 5 replaces it with the full edit modal.

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm jest __tests__/services/regions-update.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 9: Run the full suite and type-check**

Run: `pnpm jest __tests__ && pnpm tsc --noEmit`
Expected: all suites PASS, tsc exit 0. If tsc reports an unused `renameRegion` import anywhere, remove it.

- [ ] **Step 10: Commit**

```bash
git add lib/validation/regions.ts lib/repo/regions.repo.ts lib/services/regions.service.ts app/actions/regions.ts components/app-pages/admin/region-controls.tsx __tests__/services/regions-update.test.ts
git commit -m "feat(regions): replace renameRegion with updateRegion (name + colour)

regions.color was written once at creation and never readable or editable.
updateRegion handles both fields independently and only renames the sheet tab
when the name actually changed — renameRegion early-returned on an unchanged
name, which would have swallowed a colour-only edit."
```

---

### Task 5: Region colour in the list and an edit modal

UI half of **G10**.

**Files:**
- Modify: `components/app-pages/admin/region-controls.tsx`

**Interfaces:**
- Consumes: `updateRegion` action from Task 4
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Add the swatch colour map**

At the top of `region-controls.tsx`, below the `Region` type:

```tsx
/**
 * Display colours for the region_color enum. These are data values, not brand
 * tokens — a region's colour is chosen by an administrator and has no semantic
 * relationship to the palette, so it is intentionally not a Tailwind token.
 */
const REGION_COLOR_HEX: Record<string, string> = {
  Red: "#dc2626",
  Orange: "#ea580c",
  Yellow: "#ca8a04",
  Green: "#16a34a",
  Blue: "#2563eb",
  Purple: "#7c3aed",
  Gray: "#6b7280",
  Brown: "#92400e",
  Pink: "#db2777",
};

function ColorDot({ color }: { color: string | null }) {
  if (!color) {
    return (
      <span
        aria-label="No colour"
        className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-brand-dark/20"
      />
    );
  }
  return (
    <span
      aria-label={color}
      title={color}
      className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-brand-dark/10"
      style={{ backgroundColor: REGION_COLOR_HEX[color] ?? "transparent" }}
    />
  );
}
```

- [ ] **Step 2: Replace inline-rename state with edit-modal state**

Remove the `renamingId` / `renameValue` state and add:

```tsx
  // Edit modal (name + colour)
  const [editing, setEditing] = useState<Region | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>("");
```

- [ ] **Step 3: Replace the list row**

Replace the whole `paged.map((r) => ...)` body — the `renamingId === r.id ? (...) : (...)` conditional goes away entirely:

```tsx
              paged.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-4 py-2.5">
                  <ColorDot color={r.color} />
                  <span className="flex-1 text-sm font-semibold text-brand-dark">
                    {r.name}
                  </span>
                  <button
                    type="button"
                    title="Edit"
                    onClick={() => {
                      setEditing(r);
                      setEditName(r.name);
                      setEditColor(r.color ?? "");
                      setError(null);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-brand-dark/40 transition-colors hover:text-brand-dark"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    disabled={isPending}
                    onClick={() => handleDeleteClick(r)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 transition-colors hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
```

- [ ] **Step 4: Add the edit modal**

Directly after the Add Region modal block, add:

```tsx
      {/* Edit Region Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-brand-cream p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-lg font-bold text-brand-dark">
              Edit Region
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/60">
                  Name
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-brand-orange/40"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/60">
                  Color
                </label>
                <div className="mt-1">
                  <CustomSelect
                    options={["—", ...REGION_COLOR_VALUES]}
                    value={editColor || "—"}
                    onChange={(v) => setEditColor(v === "—" ? "" : v)}
                    variant="white"
                    size="sm"
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full px-4 py-2 text-sm font-bold text-brand-dark/60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || !editName.trim()}
                onClick={() =>
                  run(async () => {
                    const res = await updateRegion({
                      id: editing.id,
                      name: editName.trim(),
                      color: (editColor || null) as never,
                    });
                    if (res?.serverError) throw new Error(res.serverError);
                    setEditing(null);
                  })
                }
                className="rounded-full bg-brand-dark px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                {isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Type-check**

Run: `pnpm tsc --noEmit`
Expected: exit 0. If `Pencil` or `Trash2` is reported unused, they are still used above — re-check the row markup was replaced, not appended.

- [ ] **Step 6: Run the full suite**

Run: `pnpm jest __tests__`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add components/app-pages/admin/region-controls.tsx
git commit -m "feat(admin): show and edit region colour

Replaces the name-only inline rename with an Edit modal covering name and
colour, and adds a colour swatch to each row. regions.color was previously
set once at creation and unreachable thereafter."
```

---

### Task 6: Pass regions from the server

Closes **G9** (regions populate only after hydration).

**Files:**
- Modify: `app/(protected)/dashboard/admin/page.tsx`
- Modify: `components/app-pages/admin/admin-screen.tsx`
- Modify: `components/app-pages/admin/region-controls.tsx`
- Modify: `lib/hooks/use-regions.ts`

**Interfaces:**
- Consumes: `RegionOption` from `@/lib/repo/regions.repo` (`{ id, name, color }`)
- Produces: `RegionControls` now requires an `initialRegions: RegionOption[]` prop; `AdminScreen` requires `initialRegions: RegionOption[]`.

- [ ] **Step 1: Fetch regions server-side**

In `app/(protected)/dashboard/admin/page.tsx`, add the import and extend the existing `Promise.all`:

```tsx
import { findRegions } from "@/lib/repo/regions.repo";
```

```tsx
  const [users, syncStatus, regions] = await Promise.all([
    loadData("Users initial load", () => findAllowedEmailsWithProfile(), []),
    loadData<InitialSyncStatus>(
      "Sync status initial load",
      async () => {
        const frozen = await isSyncFrozen();
        return {
          frozen,
          reason: frozen ? await getSyncFreezeReason() : null,
        };
      },
      {
        frozen: null,
        reason: null,
      },
    ),
    loadData("Admin regions initial load", () => findRegions(), []),
  ]);

  return (
    <AdminScreen
      initialUsers={users}
      initialSyncStatus={syncStatus}
      initialRegions={regions}
    />
  );
```

- [ ] **Step 2: Thread the prop through `AdminScreen`**

In `components/app-pages/admin/admin-screen.tsx`, add the import, extend the props type, destructure it, and pass it to **both** `RegionControls` usages (mobile around line 308, desktop around line 429):

```tsx
import type { RegionOption } from "@/lib/repo/regions.repo";
```

```tsx
type AdminScreenProps = {
  initialUsers: AllowedEmailEntry[];
  initialSyncStatus: { frozen: boolean | null; reason: string | null };
  initialRegions: RegionOption[];
};

export function AdminScreen({
  initialUsers,
  initialSyncStatus,
  initialRegions,
}: AdminScreenProps) {
```

```tsx
            <RegionControls initialRegions={initialRegions} />
```

- [ ] **Step 3: Seed `RegionControls` from props**

In `region-controls.tsx`, add the import, accept the prop, seed state, and delete the mount `useEffect` that fetched on load:

```tsx
import type { RegionOption } from "@/lib/repo/regions.repo";
```

```tsx
export function RegionControls({
  initialRegions,
}: {
  initialRegions: RegionOption[];
}) {
  const [regions, setRegions] = useState<Region[]>(
    initialRegions as Region[],
  );
```

Delete this block entirely:

```tsx
  useEffect(() => {
    listRegions({}).then((res) => {
      if (res?.data) setRegions(res.data as Region[]);
    });
  }, []);
```

`refresh()` stays — it is still called after every mutation via `run()`, and `listRegions` is still used inside it. That mount effect was the only `useEffect` in this file, so remove `useEffect` from the React import: `tsc` will not flag it (`noUnusedLocals` is off) but eslint will.

- [ ] **Step 4: Surface a failed refresh instead of silently emptying the list**

Replace `refresh` so a failed refetch reports rather than leaving a stale or empty list:

```tsx
  async function refresh() {
    const res = await listRegions({});
    if (res?.serverError) throw new Error(res.serverError);
    if (res?.data) setRegions(res.data as Region[]);
  }
```

`run()` already catches and routes thrown errors into `setError`.

- [ ] **Step 5: Stop `useRegions` refetching when it was seeded**

In `lib/hooks/use-regions.ts`, replace the effect:

```tsx
export function useRegions(initial: RegionOption[] = []) {
  const [regions, setRegions] = useState<RegionOption[]>(initial);

  useEffect(() => {
    // Seeded from the server — skip the fetch. Overview and TNVR pass their
    // server-loaded regions in, and refetching on mount just re-runs a query
    // whose answer is already on screen.
    if (initial.length > 0) return;

    let cancelled = false;
    listRegions({}).then((res) => {
      if (!cancelled)
        setRegions((res?.data as RegionOption[] | undefined) ?? []);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return regions;
}
```

- [ ] **Step 6: Type-check and test**

Run: `pnpm tsc --noEmit && pnpm jest __tests__`
Expected: tsc exit 0, all suites PASS.

- [ ] **Step 7: Commit**

```bash
git add "app/(protected)/dashboard/admin/page.tsx" components/app-pages/admin/admin-screen.tsx components/app-pages/admin/region-controls.tsx lib/hooks/use-regions.ts
git commit -m "perf(admin): pass regions from the server instead of fetching on mount

RegionControls fetched via useEffect while users and sync status on the same
page were already server-seeded, so the region list visibly populated after
hydration. useRegions now also skips its fetch when seeded — Overview and
TNVR were refetching data they had already been handed."
```

---

### Task 7: Admin mobile layout matches every other screen

Closes **G8** (nested scroll container).

**Files:**
- Modify: `components/app-pages/admin/admin-screen.tsx`
- Modify: `app/(protected)/dashboard/admin/loading.tsx`

**Interfaces:**
- Consumes/produces: nothing. Presentation only.

**Background:** `admin-screen.tsx` is the only screen in the app using `min-h-screen`. Every other mobile branch is `flex flex-1 flex-col tablet:hidden`. Combined with its own `overflow-auto`, it nests a scroller inside the dashboard layout's `<main className="min-h-0 flex-1 overflow-y-auto">`.

- [ ] **Step 1: Fix the screen's mobile root**

In `admin-screen.tsx`, replace the mobile wrapper (currently around lines 208–209):

```tsx
      {/* ── Mobile ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col tablet:hidden">
        <div className="flex-1 px-4 py-4">
```

Both changes matter: `min-h-screen` → `flex-1` on the outer, and `overflow-auto` removed from the inner so the layout's `<main>` owns scrolling.

- [ ] **Step 2: Match the skeleton**

In `app/(protected)/dashboard/admin/loading.tsx`, replace the mobile wrapper so the skeleton and the real screen have identical structure and do not jump on swap:

```tsx
      {/* ── Mobile ── */}
      <div className="flex flex-1 flex-col tablet:hidden">
        <div className="flex-1 px-4 py-4">
```

- [ ] **Step 3: Verify no `min-h-screen` remains**

Run: `grep -rn "min-h-screen" --include="*.tsx" components app`
Expected: no output.

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/app-pages/admin/admin-screen.tsx "app/(protected)/dashboard/admin/loading.tsx"
git commit -m "fix(admin): stop nesting a scroll container on mobile

admin-screen was the only screen using min-h-screen, and paired it with its
own overflow-auto inside the dashboard layout's scrolling <main> — producing
a scroller inside a scroller. Now matches the flex flex-1 flex-col shape used
by every other mobile branch, and the skeleton matches the screen."
```

---

### Task 8: One error surface, and roll back failed role changes

Closes **G5** (failed user deletes show nothing) and **G6** (role changes fail silently and leave the UI wrong).

**Files:**
- Modify: `components/app-pages/admin/admin-screen.tsx`

**Interfaces:**
- Consumes: `editAllowedEmail`, `removeAllowedEmail` from `@/app/actions/users` — signatures unchanged
- Produces: nothing consumed by later tasks

**Background:** `error` is set by three handlers but only ever rendered as a prop to `AddUserDialog` (`error={showAddUser ? error : null}`), so a failed delete or role change is invisible. `handleRoleChange` additionally discards the action result, leaving the optimistic update in place after a rejection.

- [ ] **Step 1: Add a dismissible error banner component**

In `admin-screen.tsx`, above `AdminScreen`:

```tsx
function AdminError({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2"
    >
      <p className="text-xs font-medium text-red-700">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="shrink-0 text-red-400 transition-colors hover:text-red-700"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
```

Add `CloseIcon` to the existing icons import from `@/components/app-pages/shared/icons`.

- [ ] **Step 2: Render the banner in both branches**

Mobile — directly after the `<p className="mb-4 font-heading …">Admin</p>` heading:

```tsx
          {error && !showAddUser ? (
            <AdminError message={error} onDismiss={() => setError(null)} />
          ) : null}
```

Desktop — directly after the `<h1 className="mb-6 font-heading …">Admin</h1>` heading:

```tsx
        {error && !showAddUser ? (
          <AdminError message={error} onDismiss={() => setError(null)} />
        ) : null}
```

The `!showAddUser` guard prevents the message appearing twice while the Add User dialog is open, since that dialog renders it internally.

- [ ] **Step 3: Roll back failed role changes**

Replace `handleRoleChange` entirely:

```tsx
  // Optimistic role update — writes both allowedEmails.auth_role and
  // profiles.auth_role. Reverts on failure; without the rollback a rejected
  // change kept displaying as applied until reload.
  const handleRoleChange = useCallback(
    (userId: string, role: AuthRole) => {
      const previous = users.find((u) => u.id === userId)?.auth_role;
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, auth_role: role } : u)),
      );
      startRoleTransition(async () => {
        const result = await editAllowedEmail.bind(null, userId)({
          auth_role: role,
        });
        if (result?.serverError) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId && previous
                ? { ...u, auth_role: previous }
                : u,
            ),
          );
          setError(result.serverError);
        }
      });
    },
    [users],
  );
```

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Run the full suite**

Run: `pnpm jest __tests__`
Expected: all suites PASS.

- [ ] **Step 6: Commit**

```bash
git add components/app-pages/admin/admin-screen.tsx
git commit -m "fix(admin): surface action errors and roll back failed role changes

error was set by the delete and role-change handlers but only ever rendered
inside AddUserDialog, so both failed silently. Adds a shared banner to both
breakpoints, and handleRoleChange now checks serverError and restores the
previous role instead of leaving the optimistic update in place."
```

---

## Final Verification

After all eight tasks:

- [ ] `pnpm jest __tests__` — all suites pass (19 expected: 17 existing + 2 new)
- [ ] `pnpm tsc --noEmit` — exit 0
- [ ] `pnpm build` — succeeds
- [ ] `grep -rn "renameRegion" --include="*.ts" --include="*.tsx" app lib components` — no output
- [ ] `grep -rn "min-h-screen" --include="*.tsx" app components` — no output
- [ ] `grep -rn "warningText" --include="*.tsx" components` — no output

Manual, against the live spreadsheet (requires the Task 3 Apps Script paste):

- [ ] Add a region → new tab is titled correctly, has template headers, empty data rows, no banner
- [ ] A pre-existing region tab acquires no banner during that flow
- [ ] Create a blank tab by hand → it *is* bannered, toast fires
- [ ] Rename it to `_Notes` → warning stops
- [ ] Edit a region's colour only → swatch updates, sheet tab name unchanged, no sync activity
- [ ] Rename a region → sheet tab renames with it
- [ ] Delete an empty region → confirm modal appears **before** anything is deleted
- [ ] Admin on a phone → single scroll, bottom nav not overlapped, skeleton does not jump

## Out of Scope (recorded, not tasks)

- **Auth de-duplication.** `(protected)/layout.tsx` and `admin/layout.tsx` each resolve user + profile independently. Real redundancy, but not the cause of the mobile symptom (Task 7 is), and React `cache()` would not help server actions where `requireAuth()` does most auth work. Re-resolving per boundary is the deliberate app-wide pattern.
- **`STATIC_TABS` / `NON_REGION_TABS` duplication** between Apps Script and TypeScript — belongs with P3's Apps Script work.
- **Splitting `admin-screen.tsx`** (479 lines) into per-panel components — P2 and P3 both add panels here; restructure after, if still warranted.
- **Repairing already-damaged region tabs.** Any tab currently carrying a banner or a wrong title is not fixed by this plan. Check during Task 3's manual verification and repair by hand if found.
