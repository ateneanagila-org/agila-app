# Cat Entry Form + Unknown → null Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove "Unknown" as a first-class enum value from cat_sex/cat_sociability/cat_status, migrate DB to null, wire "Unknown" as a UI-only affordance in the entry form, fix forward/reverse-sync fallbacks, and apply a display helper across all cat-rendering components.

**Architecture:** DB migration first (Supabase MCP) to null out existing "Unknown" rows and recreate the Postgres enum types. TypeScript enum arrays then shrink to match. The UI maps null ↔ "Unknown" at the form boundary using a `normalize()` helper. A `displayCatField()` util renders "Unknown" for null across all display components.

**Tech Stack:** Next.js App Router, Drizzle ORM, Supabase (Postgres), Zod, Tailwind. `pnpm tsc --noEmit` is the verification gate. No test suite.

---

## File Map

| File | Change |
|------|--------|
| **Supabase MCP** | Run one-shot SQL migration |
| `lib/db/enums.ts` | Remove "Unknown" from CAT_SEX_VALUES, CAT_SOCIABILITY_VALUES, CAT_STATUS_VALUES |
| `lib/db/schema.ts` | Drop `.default("Unknown")` from `sex` and `sociability` columns |
| `lib/services/helper.service.ts` | Fix fallbacks in mapCatToSheetRow + mapUnknownCatToSheetRow; simplify adoptable-cats query |
| `lib/validation/reverse-sync.ts` | Map unknown sex/sociability/status to null (not "Unknown") |
| `scripts/import-sheets.ts` | Map unknown sex/sociability to null in both parseRow functions |
| `components/app-pages/shared/cat-entry-form.tsx` | Remove Status field, add "Unknown" option to 4 dropdowns, normalize on save, TextField for Spot Last Seen |
| `lib/hooks/filter-sort-configs.ts` | Add "Unknown" to color/age/sex/sociability/status filter options |
| `components/app-pages/database/database-list-screen.tsx` | Update getFilterValue accessor to return "Unknown" for null |
| `components/app-pages/sessions/sessions-manager-screen.tsx` | Update getFilterValue accessor (has color/sex filters) |
| `lib/utils.ts` | Add `displayCatField()` helper |
| `components/app-pages/shared/cat-card.tsx` | Use displayCatField for color/age display |
| `components/app-pages/database/database-general-screen.tsx` | Use displayCatField in read-view display fields |
| `components/app-pages/database/database-medical-screen.tsx` | Use displayCatField for cat field displays |
| `components/app-pages/database/database-interventions-screen.tsx` | Use displayCatField for cat field displays |
| `components/app-pages/catalog/catalog-detail-screen.tsx` | Use displayCatField for profileFields values |
| `components/app-pages/tnvr/tnvr-screen.tsx` | Use displayCatField for cat field displays |
| `components/app-pages/sessions/sessions-manager-screen.tsx` | Use displayCatField for color/age display |
| `components/app-pages/sessions/sessions-screen.tsx` | Audit only — skip if no cat enum fields rendered |

---

## Task 1: DB Migration

**Files:**
- Supabase MCP: `mcp__claude_ai_Supabase__apply_migration`

This is a one-shot migration. Run steps in the exact order below — step 3 will fail if any rows still contain `'Unknown'` at enum-cast time.

- [ ] **Step 1: Apply migration via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` with the following SQL (name it `remove_unknown_from_cat_enums`):

```sql
-- 1. Null out existing "Unknown" values before recreating enum types
UPDATE cats SET sex = NULL WHERE sex = 'Unknown';
UPDATE cats SET sociability = NULL WHERE sociability = 'Unknown';
UPDATE cats SET cat_status = NULL WHERE cat_status = 'Unknown';

-- 2. Drop column defaults that reference "Unknown"
ALTER TABLE cats ALTER COLUMN sex DROP DEFAULT;
ALTER TABLE cats ALTER COLUMN sociability DROP DEFAULT;

-- 3. Recreate cat_sex without "Unknown"
ALTER TYPE cat_sex RENAME TO cat_sex_old;
CREATE TYPE cat_sex AS ENUM ('Female', 'Male');
ALTER TABLE cats ALTER COLUMN sex TYPE cat_sex USING sex::text::cat_sex;
DROP TYPE cat_sex_old;

-- 4. Recreate cat_sociability without "Unknown"
ALTER TYPE cat_sociability RENAME TO cat_sociability_old;
CREATE TYPE cat_sociability AS ENUM ('Domesticated', 'Tame', 'Feral');
ALTER TABLE cats ALTER COLUMN sociability TYPE cat_sociability USING sociability::text::cat_sociability;
DROP TYPE cat_sociability_old;

-- 5. Recreate cat_status without "Unknown"
ALTER TYPE cat_status RENAME TO cat_status_old;
CREATE TYPE cat_status AS ENUM ('Deceased', 'Fostered', 'Adopted', 'MIA');
ALTER TABLE cats ALTER COLUMN cat_status TYPE cat_status USING cat_status::text::cat_status;
DROP TYPE cat_status_old;
```

- [ ] **Step 2: Confirm via Supabase MCP**

Use `mcp__claude_ai_Supabase__execute_sql` to verify:
```sql
SELECT COUNT(*) FROM cats WHERE sex = 'Unknown' OR sociability = 'Unknown' OR cat_status = 'Unknown';
-- Expected: 0 rows (the WHERE itself may error if enum no longer has 'Unknown' — that's fine, it proves the type was recreated)

SELECT enum_range(NULL::cat_sex), enum_range(NULL::cat_sociability), enum_range(NULL::cat_status);
-- Expected: {Female,Male} | {Domesticated,Tame,Feral} | {Deceased,Fostered,Adopted,MIA}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: migrate cat enum types — drop Unknown, null existing rows"
```

---

## Task 2: Enum + Schema TypeScript Update

**Files:**
- Modify: `lib/db/enums.ts` (lines 117–146)
- Modify: `lib/db/schema.ts` (lines 126–128)

- [ ] **Step 1: Update CAT_SEX_VALUES in `lib/db/enums.ts`**

Current (line 117):
```ts
export const CAT_SEX_VALUES = ["Female", "Male", "Unknown"] as const;
```
Replace with:
```ts
export const CAT_SEX_VALUES = ["Female", "Male"] as const;
```

- [ ] **Step 2: Update CAT_SOCIABILITY_VALUES in `lib/db/enums.ts`**

Current (lines 123–128):
```ts
export const CAT_SOCIABILITY_VALUES = [
  "Domesticated",
  "Tame",
  "Feral",
  "Unknown",
] as const;
```
Replace with:
```ts
export const CAT_SOCIABILITY_VALUES = [
  "Domesticated",
  "Tame",
  "Feral",
] as const;
```

- [ ] **Step 3: Update CAT_STATUS_VALUES in `lib/db/enums.ts`**

Current (lines 137–143):
```ts
export const CAT_STATUS_VALUES = [
  "Deceased",
  "Fostered",
  "Adopted",
  "MIA",
  "Unknown",
] as const;
```
Replace with:
```ts
export const CAT_STATUS_VALUES = [
  "Deceased",
  "Fostered",
  "Adopted",
  "MIA",
] as const;
```

- [ ] **Step 4: Drop `.default("Unknown")` from `lib/db/schema.ts`**

Current (lines 126–128):
```ts
  sex: catSexEnum("sex").default("Unknown"),
  name: text("name"),
  sociability: catSociabilityEnum("sociability").default("Unknown"),
```
Replace with:
```ts
  sex: catSexEnum("sex"),
  name: text("name"),
  sociability: catSociabilityEnum("sociability"),
```

- [ ] **Step 5: Check TypeScript**

```bash
pnpm tsc --noEmit
```

Expect: errors in files that reference `"Unknown"` as a CatSex/CatSociability/CatStatus value. These are intentional — they'll be fixed in later tasks. Fix any _unintentional_ errors now.

- [ ] **Step 6: Commit**

```bash
git add lib/db/enums.ts lib/db/schema.ts
git commit -m "feat: remove Unknown from cat enum TS arrays and schema defaults"
```

---

## Task 3: Forward-Sync Fallback Updates

**Files:**
- Modify: `lib/services/helper.service.ts` (lines ~134–157, ~176–199, ~649–654)

- [ ] **Step 1: Update `mapCatToSheetRow` fallbacks**

In `mapCatToSheetRow` (around line 134), the return array contains:

```ts
    cat.color ?? "N/A", // 3  (D)
    cat.age ?? "N/A", // 4  (E)
    cat.sex ?? "Unknown", // 5  (F)
    ...
    cat.sociability ?? "Unknown", // 7  (H)
    ...
    catStatus || "Unknown", // 11 (L)
```

Replace those specific lines with:
```ts
    cat.color ?? "", // 3  (D)
    cat.age ?? "", // 4  (E)
    cat.sex ?? "???", // 5  (F)
    ...
    cat.sociability ?? "???", // 7  (H)
    ...
    catStatus || "None of the above", // 11 (L)
```

(Leave all other lines in the array untouched.)

- [ ] **Step 2: Update `mapUnknownCatToSheetRow` fallbacks**

In `mapUnknownCatToSheetRow` (around line 176), the return array contains:

```ts
    cat.color ?? "N/A", // 3  (D)
    cat.age ?? "N/A", // 4  (E)
    cat.sex ?? "Unknown", // 5  (F)
    ...
    cat.sociability ?? "Unknown", // 7  (H)
```

Replace those specific lines with:
```ts
    cat.color ?? "", // 3  (D)
    cat.age ?? "", // 4  (E)
    cat.sex ?? "???", // 5  (F)
    ...
    cat.sociability ?? "???", // 7  (H)
```

- [ ] **Step 3: Simplify adoptable-cats query**

Find the adoptable-cats query around line 649 (inside `getForFASheetData` or similar). The current where clause contains:

```ts
or(eq(c.cat_status, "Unknown"), isNull(c.cat_status)),
```

Replace the entire `or(...)` with:
```ts
isNull(c.cat_status),
```

After migration, all former "Unknown" rows are null — the `eq(c.cat_status, "Unknown")` arm is dead code.

- [ ] **Step 4: Check TypeScript**

```bash
pnpm tsc --noEmit
```

Expect zero errors in this file after removing the `"Unknown"` string literals that TypeScript was previously happy with (since those strings are no longer in the enum).

- [ ] **Step 5: Commit**

```bash
git add lib/services/helper.service.ts
git commit -m "fix: forward-sync fallbacks — blank/??? /None of the above to match sheet validation"
```

---

## Task 4: Reverse-Sync + Import Script Updates

**Files:**
- Modify: `lib/validation/reverse-sync.ts` (lines ~67–76, ~149–155)
- Modify: `scripts/import-sheets.ts` (lines ~145–148, ~184–187)

- [ ] **Step 1: Fix `parseSheetRow` in `lib/validation/reverse-sync.ts`**

Current (lines ~67–68):
```ts
  const sex = ["Male", "Female"].includes(rawSex) ? rawSex : "Unknown";
```
Replace with:
```ts
  const sex = ["Male", "Female"].includes(rawSex) ? rawSex : null;
```

Current (lines ~71–73):
```ts
  const sociability = ["Domesticated", "Tame", "Feral"].includes(rawSociability)
    ? rawSociability
    : "Unknown";
```
Replace with:
```ts
  const sociability = ["Domesticated", "Tame", "Feral"].includes(rawSociability)
    ? rawSociability
    : null;
```

Current (line ~76):
```ts
  const validStatuses = ["Deceased", "Fostered", "Adopted", "MIA", "Unknown"];
```
Replace with:
```ts
  const validStatuses = ["Deceased", "Fostered", "Adopted", "MIA"];
```

(The `cat_status` already maps non-matching values to null on line 77 — dropping "Unknown" from validStatuses means sheet cells containing "Unknown", "???", "None of the above", or blank all map to null correctly.)

- [ ] **Step 2: Fix `parseUnknownSheetRow` in `lib/validation/reverse-sync.ts`**

Same change in the second parse function (around lines 149–155):

```ts
  const sex = ["Male", "Female"].includes(rawSex) ? rawSex : null;
```

```ts
  const sociability = ["Domesticated", "Tame", "Feral"].includes(rawSociability)
    ? rawSociability
    : null;
```

- [ ] **Step 3: Fix `parseRow` in `scripts/import-sheets.ts`**

Current (lines ~145–148):
```ts
    sex: (VALID_SEXES.includes(sexStr) ? sexStr : "Unknown") as CatSex,
    sociability: (VALID_SOCIABILITIES.includes(socStr)
      ? socStr
      : "Unknown") as CatSociability,
```
Replace with:
```ts
    sex: (VALID_SEXES.includes(sexStr) ? sexStr : null) as CatSex | null,
    sociability: (VALID_SOCIABILITIES.includes(socStr)
      ? socStr
      : null) as CatSociability | null,
```

- [ ] **Step 4: Fix `parseUnknownRow` in `scripts/import-sheets.ts`**

Current (lines ~184–187):
```ts
    sex: (VALID_SEXES.includes(sexStr) ? sexStr : "Unknown") as CatSex,
    sociability: (VALID_SOCIABILITIES.includes(socStr)
      ? socStr
      : "Unknown") as CatSociability,
```
Replace with:
```ts
    sex: (VALID_SEXES.includes(sexStr) ? sexStr : null) as CatSex | null,
    sociability: (VALID_SOCIABILITIES.includes(socStr)
      ? socStr
      : null) as CatSociability | null,
```

Note: if `ParsedRow` type in import-sheets.ts has `sex: CatSex` (non-nullable), update the type to `sex: CatSex | null` and `sociability: CatSociability | null`. Follow the TypeScript errors.

- [ ] **Step 5: Check TypeScript**

```bash
pnpm tsc --noEmit
```

Fix any type errors that surface (likely the `ParsedRow` type if it was non-nullable for these fields).

- [ ] **Step 6: Commit**

```bash
git add lib/validation/reverse-sync.ts scripts/import-sheets.ts
git commit -m "fix: reverse-sync and import-script map unknown sex/sociability/status to null"
```

---

## Task 5: Cat Entry Form Rework

**Files:**
- Modify: `components/app-pages/shared/cat-entry-form.tsx`

Four changes: remove Status field, add "Unknown" option to 4 dropdowns, normalize on save, TextField for Spot Last Seen.

- [ ] **Step 1: Remove Status state and imports**

Remove from the import block (around line 14–25):
```ts
  CAT_STATUS_VALUES,        // ← remove this line
```
```ts
  CatStatus,                // ← remove this line
```

Remove line 98 (catStatus state):
```ts
  const [catStatus, setCatStatus] = useState(initialCat?.cat_status ?? "");
```

Remove `catStatus` from the `useCallback` dependency array (around line 298):
```ts
    catStatus,    // ← remove this line
```

- [ ] **Step 2: Update state init for edit mode (null → "Unknown")**

Current (lines 94–97):
```ts
  const [color, setColor] = useState(initialCat?.color ?? "");
  const [age, setAge] = useState(initialCat?.age ?? "");
  const [sex, setSex] = useState(initialCat?.sex ?? "");
  const [sociability, setSociability] = useState(initialCat?.sociability ?? "");
```
Replace with:
```ts
  const [color, setColor] = useState(initialCat?.color ?? (initialCat ? "Unknown" : ""));
  const [age, setAge] = useState(initialCat?.age ?? (initialCat ? "Unknown" : ""));
  const [sex, setSex] = useState(initialCat?.sex ?? (initialCat ? "Unknown" : ""));
  const [sociability, setSociability] = useState(initialCat?.sociability ?? (initialCat ? "Unknown" : ""));
```

This way: in edit mode, null DB value shows "Unknown" selected; in create mode, "" shows the placeholder.

- [ ] **Step 3: Add normalize helper and update save payloads**

Add this helper directly inside the component (before `handleSave`), after all state declarations:
```ts
  const normalize = <T,>(v: string): T | undefined =>
    v === "Unknown" || v === "" ? undefined : (v as T);
```

In `handleSave`, inside the edit-mode block (around line 184–196), replace the individual field lines:
```ts
          color: (color || undefined) as CatColor | undefined,
          age: (age || undefined) as CatAge | undefined,
          sex: (sex || undefined) as CatSex | undefined,
          sociability: (sociability || undefined) as CatSociability | undefined,
          cat_status: (catStatus || undefined) as CatStatus | undefined,
```
With:
```ts
          color: normalize<CatColor>(color),
          age: normalize<CatAge>(age),
          sex: normalize<CatSex>(sex),
          sociability: normalize<CatSociability>(sociability),
```
(Drop the `cat_status` line entirely.)

In the create-mode payload (around lines 221–235), replace:
```ts
          color: (color || undefined) as CatColor | undefined,
          age: (age || undefined) as CatAge | undefined,
          sex: (sex || undefined) as CatSex | undefined,
          sociability: (sociability || undefined) as
            | CatSociability
            | undefined,
          cat_status: (catStatus || undefined) as CatStatus | undefined,
```
With:
```ts
          color: normalize<CatColor>(color),
          age: normalize<CatAge>(age),
          sex: normalize<CatSex>(sex),
          sociability: normalize<CatSociability>(sociability),
```
(Again, no `cat_status` line.)

- [ ] **Step 4: Update the four dropdowns to include "Unknown" option**

Find these four `<DropdownField>` blocks in the JSX (around lines 425–448) and update their `options` prop:

```tsx
          <DropdownField
            label="Color"
            options={["Unknown", ...CAT_COLOR_VALUES]}
            value={color}
            onChange={setColor}
          />
          <DropdownField
            label="Size / Age"
            options={["Unknown", ...CAT_AGE_VALUES]}
            value={age}
            onChange={setAge}
          />
          <DropdownField
            label="Sex"
            options={["Unknown", ...CAT_SEX_VALUES]}
            value={sex}
            onChange={setSex}
          />
          <DropdownField
            label="Sociability"
            options={["Unknown", ...CAT_SOCIABILITY_VALUES]}
            value={sociability}
            onChange={setSociability}
          />
```

- [ ] **Step 5: Remove the Status DropdownField from JSX**

Delete these lines (around lines 449–454):
```tsx
          <DropdownField
            label="Status"
            options={CAT_STATUS_VALUES}
            value={catStatus}
            onChange={setCatStatus}
          />
```

- [ ] **Step 6: Replace Spot Last Seen CustomSelect with TextField**

Delete the current Spot Last Seen block (around lines 461–472):
```tsx
          <div>
            <label className="text-sm font-semibold text-brand-orange">Spot Last Seen</label>
            <div className="mt-1.5">
              <CustomSelect
                options={regionOptions.map((r) => r.name)}
                value={spotLastSeen}
                onChange={setSpotLastSeen}
                placeholder={regionsLoading ? "Loading..." : "—"}
                variant="white"
              />
            </div>
          </div>
```

Replace with:
```tsx
          <TextField label="Spot Last Seen" value={spotLastSeen} onChange={setSpotLastSeen} />
```

- [ ] **Step 7: Check TypeScript**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add components/app-pages/shared/cat-entry-form.tsx
git commit -m "feat: cat entry form — remove Status, Unknown dropdown options, free-text spot"
```

---

## Task 6: Filter Config Updates

**Files:**
- Modify: `lib/hooks/filter-sort-configs.ts`
- Modify: `components/app-pages/database/database-list-screen.tsx`
- Modify: `components/app-pages/sessions/sessions-manager-screen.tsx` (if it has a getFilterValue accessor)

- [ ] **Step 1: Add "Unknown" to filter options in `lib/hooks/filter-sort-configs.ts`**

Current `DATABASE_LIST_CONFIG` (lines 17–26):
```ts
export const DATABASE_LIST_CONFIG: FilterSortConfig = {
  filters: [
    { label: "Region", key: "region_name", options: REGION_FILTER_OPTIONS },
    { label: "Color", key: "color", options: CAT_COLOR_VALUES },
    { label: "Age", key: "age", options: CAT_AGE_VALUES },
    { label: "Sex", key: "sex", options: CAT_SEX_VALUES },
    { label: "Sociability", key: "sociability", options: CAT_SOCIABILITY_VALUES },
    { label: "Status", key: "cat_status", options: CAT_STATUS_VALUES },
  ],
```

Replace the five affected filter lines (not Region):
```ts
export const DATABASE_LIST_CONFIG: FilterSortConfig = {
  filters: [
    { label: "Region", key: "region_name", options: REGION_FILTER_OPTIONS },
    { label: "Color", key: "color", options: [...CAT_COLOR_VALUES, "Unknown"] },
    { label: "Age", key: "age", options: [...CAT_AGE_VALUES, "Unknown"] },
    { label: "Sex", key: "sex", options: [...CAT_SEX_VALUES, "Unknown"] },
    { label: "Sociability", key: "sociability", options: [...CAT_SOCIABILITY_VALUES, "Unknown"] },
    { label: "Status", key: "cat_status", options: [...CAT_STATUS_VALUES, "Unknown"] },
  ],
```

Current `SESSIONS_MANAGER_CONFIG` (lines 71–81):
```ts
export const SESSIONS_MANAGER_CONFIG: FilterSortConfig = {
  filters: [
    { label: "Color", key: "color", options: CAT_COLOR_VALUES },
    { label: "Sex", key: "sex", options: CAT_SEX_VALUES },
    { label: "Condition", key: "condition", options: CATHEALTHRECORD_CONDITION_VALUES },
  ],
```

Replace color/sex options:
```ts
export const SESSIONS_MANAGER_CONFIG: FilterSortConfig = {
  filters: [
    { label: "Color", key: "color", options: [...CAT_COLOR_VALUES, "Unknown"] },
    { label: "Sex", key: "sex", options: [...CAT_SEX_VALUES, "Unknown"] },
    { label: "Condition", key: "condition", options: CATHEALTHRECORD_CONDITION_VALUES },
  ],
```

- [ ] **Step 2: Update filter value accessor in `components/app-pages/database/database-list-screen.tsx`**

Find where `CatFilterToolbar` or `useFilterSort` is called with a `getFilterValue` (or equivalent) accessor. The accessor currently returns `cat[key]` or similar. It needs to map null to `"Unknown"` for cat fields.

Search for the accessor pattern in `database-list-screen.tsx`. If `CatFilterToolbar` takes a `getFilterValue` prop, the call site will look like:

```tsx
<CatFilterToolbar
  cats={cats}
  config={DATABASE_LIST_CONFIG}
  getFilterValue={(cat, key) => {
    if (key === "region_name") return cat.region_name ?? null;
    const val = cat[key as keyof typeof cat];
    if (val == null) return "Unknown";
    return String(val);
  }}
/>
```

If the accessor is defined inline in `useFilterSort` or elsewhere, apply the same `val == null → "Unknown"` mapping. Grep for `getFilterValue` or `filterValue` in database-list-screen.tsx and its related hook to locate the exact callsite.

- [ ] **Step 3: Apply same accessor fix to `sessions-manager-screen.tsx`**

Same `val == null → "Unknown"` mapping for the sessions manager filter accessor, for the color and sex keys.

- [ ] **Step 4: Check TypeScript**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/filter-sort-configs.ts components/app-pages/database/database-list-screen.tsx components/app-pages/sessions/sessions-manager-screen.tsx
git commit -m "feat: add Unknown filter option for nullable cat fields"
```

---

## Task 7: Display Helper + Component Audit

**Files:**
- Modify: `lib/utils.ts`
- Modify: `components/app-pages/shared/cat-card.tsx`
- Modify: `components/app-pages/catalog/catalog-detail-screen.tsx`
- Modify: `components/app-pages/database/database-general-screen.tsx`
- Modify: `components/app-pages/database/database-medical-screen.tsx`
- Modify: `components/app-pages/database/database-interventions-screen.tsx`
- Modify: `components/app-pages/tnvr/tnvr-screen.tsx`
- Modify: `components/app-pages/sessions/sessions-manager-screen.tsx`
- Audit only: `components/app-pages/sessions/sessions-screen.tsx`

- [ ] **Step 1: Add `displayCatField` to `lib/utils.ts`**

Current `lib/utils.ts` (full file):
```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Add after the `cn` function:
```ts
export const displayCatField = (v: string | null | undefined): string => v ?? "Unknown";
```

- [ ] **Step 2: Apply to `catalog-detail-screen.tsx`**

Import `displayCatField` at the top of the file:
```ts
import { displayCatField } from "@/lib/utils";
```

Find the `profileFields` array (around line 125):
```ts
  const profileFields: { label: string; value: React.ReactNode }[] = [
    { label: "Sex", value: cat.sex ? (sex ? `${cat.sex} ${sex}` : cat.sex) : "—" },
    { label: "Size / Age", value: cat.age ?? "—" },
    { label: "Color", value: cat.color ?? "—" },
    { label: "Sociability", value: cat.sociability ?? "—" },
  ];
```

Replace with:
```ts
  const profileFields: { label: string; value: React.ReactNode }[] = [
    { label: "Sex", value: cat.sex ? (sex ? `${cat.sex} ${sex}` : cat.sex) : "Unknown" },
    { label: "Size / Age", value: displayCatField(cat.age) },
    { label: "Color", value: displayCatField(cat.color) },
    { label: "Sociability", value: displayCatField(cat.sociability) },
  ];
```

Also find any chip rendering blocks that conditionally render `{cat.color ? (...) : null}` and `{cat.age ? (...) : null}` — these show nothing when null. Leave those conditional chip renders as-is (null cat.color = no color chip is correct; the profileFields table is where the "Unknown" label should appear).

- [ ] **Step 3: Apply to `cat-card.tsx`**

Import `displayCatField`:
```ts
import { displayCatField } from "@/lib/utils";
```

Find the color/age combined display used in all three variants (compact, default, wide). Current pattern:
```tsx
{[cat.color, cat.age].filter(Boolean).join(" · ") || "—"}
```

Replace with:
```tsx
{[cat.color, cat.age].filter(Boolean).join(" · ") || "Unknown"}
```

This preserves the "color · age" join behavior when both are set, and shows "Unknown" when both are null. (We don't use `displayCatField` here since it's a combined display — showing "Unknown · Unknown" would be wrong.)

Note: `cat.spot_last_seen || "Unknown"` is already correct — leave it as-is.

- [ ] **Step 4: Apply to `database-general-screen.tsx`**

Import `displayCatField`:
```ts
import { displayCatField } from "@/lib/utils";
```

This screen is primarily an edit form, but search for any read-only display of `cat.sex`, `cat.color`, etc. that uses `?? "—"` or `|| "—"`. Replace those patterns with `displayCatField(...)`.

The form dropdowns themselves (`populateForm` initializing state as `catData.color ?? ""`) are fine — empty string shows a placeholder, which is correct for an edit form. Do not change those.

- [ ] **Step 5: Apply to `database-medical-screen.tsx`**

Import `displayCatField`. Find any display of sex/color/age/sociability/cat_status using `?? "—"` or `|| "—"` patterns and replace with `displayCatField(...)`.

- [ ] **Step 6: Apply to `database-interventions-screen.tsx`**

Same: import `displayCatField`, replace `?? "—"` / `|| "—"` patterns for cat enum fields.

- [ ] **Step 7: Apply to `tnvr-screen.tsx`**

Same: import `displayCatField`, replace `?? "—"` / `|| "—"` patterns for cat enum fields.

- [ ] **Step 8: Apply to `sessions-manager-screen.tsx`** (display only)

Current pattern on approximately line 151:
```tsx
{item.cat.color || "Unknown"}{item.cat.age ? ` ${item.cat.age}` : ""}
```

Replace with:
```tsx
{displayCatField(item.cat.color)}{item.cat.age ? ` ${item.cat.age}` : ""}
```

Import `displayCatField`. Leave sex-glyph logic untouched (null sex → no glyph shown, which is fine).

- [ ] **Step 9: Audit `sessions-screen.tsx`**

Open the file and check if it renders any of: `cat.sex`, `cat.color`, `cat.age`, `cat.sociability`, `cat.cat_status` as text. If not (e.g., it only shows region or session-level data), skip. If yes, apply `displayCatField` the same way.

- [ ] **Step 10: Final TypeScript check**

```bash
pnpm tsc --noEmit
```

Expect zero errors. If any remain, they are likely stale "Unknown" string literals being compared to the narrowed enum types — remove them.

- [ ] **Step 11: Commit**

```bash
git add lib/utils.ts components/app-pages/shared/cat-card.tsx components/app-pages/catalog/catalog-detail-screen.tsx components/app-pages/database/database-general-screen.tsx components/app-pages/database/database-medical-screen.tsx components/app-pages/database/database-interventions-screen.tsx components/app-pages/tnvr/tnvr-screen.tsx components/app-pages/sessions/sessions-manager-screen.tsx components/app-pages/sessions/sessions-screen.tsx
git commit -m "feat: displayCatField helper — consistent Unknown display for null cat fields"
```

---

## Self-Review

### Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Remove Status field from cat entry form (create + edit) | Task 5 steps 1, 5 |
| Eliminate "Unknown" from CAT_SEX_VALUES, CAT_SOCIABILITY_VALUES, CAT_STATUS_VALUES | Task 2 steps 1–3 |
| Migrate existing "Unknown" rows to null | Task 1 |
| Drop `.default("Unknown")` from sex/sociability columns | Task 2 step 4 |
| Add "Unknown" UI option for color/age/sex/sociability in entry form | Task 5 step 4 |
| Map "Unknown" UI selection → null on save | Task 5 step 3 |
| Map null DB value → "Unknown" in edit mode init | Task 5 step 2 |
| Switch Spot Last Seen to free text | Task 5 step 6 |
| Forward-sync color/age fallback: "" | Task 3 step 1+2 |
| Forward-sync sex/sociability fallback: "???" | Task 3 step 1+2 |
| Forward-sync cat_status fallback: "None of the above" | Task 3 step 1 |
| Simplify adoptable-cats query (drop eq "Unknown" arm) | Task 3 step 3 |
| Reverse-sync maps "???"/unknown/blank → null for sex/sociability | Task 4 steps 1–2 |
| Reverse-sync drops "Unknown" from valid statuses | Task 4 step 1 |
| Import script maps unknown sex/sociability → null | Task 4 steps 3–4 |
| Filter configs add "Unknown" to color/age/sex/sociability/status | Task 6 step 1 |
| Filter accessor maps null → "Unknown" | Task 6 steps 2–3 |
| `displayCatField` helper in utils | Task 7 step 1 |
| Apply displayCatField across display components | Task 7 steps 2–9 |
| `pnpm tsc --noEmit` passes | End of every task |

### Notes for Implementer

- **`database-general-screen.tsx`** also has a `cat_status` dropdown (for the manager edit flow). After Task 2, `CAT_STATUS_VALUES` no longer includes "Unknown". The dropdown will still work — it just won't offer "Unknown" as an option, which is correct. The Status dropdown in this screen stays (it's the manager flow, not the volunteer entry flow). No change needed beyond the shared enum update.
- **Drizzle-kit push**: Do NOT run `pnpm drizzle-kit push` after Task 2. The DB was already updated via MCP in Task 1. Running push would attempt to alter already-modified enum types and fail. The TS changes in Task 2 bring the code into sync with the DB — `pnpm tsc --noEmit` is the only check needed.
- **`lib/db/seed.ts` line 159** has a commented "Unknown" reference. Grep for it and delete the comment if it references "Unknown" as an enum value.
- **`sheetRowSchema` in `lib/validation/reverse-sync.ts`**: uses `CatSexEnum.nullable()`, `CatSociabilityEnum.nullable()`, `CatStatusEnum.nullable()`. After Task 2, these Zod enums auto-narrow to the new values — no manual change needed. But verify after Task 2.
