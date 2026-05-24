# Cat Entry Form + Unknown → null — Design

**Date:** 2026-05-24
**Cluster:** B (of 4 — see `project_session_ui_brainstorm_clusters.md`)
**Scope:** `components/app-pages/shared/cat-entry-form.tsx`, cat enum cleanup (sex/sociability/cat_status), sync system (forward + reverse), filter configs, display layer, schema/migration.

## Problem

Three issues with the cat entry form and how "Unknown" propagates through the system:

1. The **Status** field doesn't belong in create or edit flows for cat entries — status (Deceased/MIA/Fostered/Adopted) is set elsewhere (manager/intervention flows). Remove from the entry form.
2. The string `"Unknown"` is currently a first-class enum value for `cat_sex`, `cat_sociability`, and `cat_status`. This is semantically wrong (Unknown = absence of data, not a real category) and causes friction throughout sync, filtering, and display. It should be `null` in the database, with `"Unknown"` only as a UI affordance.
3. **Spot Last Seen** is currently a region dropdown — should be free text so volunteers can enter specific landmarks ("near gate 3 trash bins") instead of region names.

Additionally, color and age dropdowns lack an explicit "Unknown" option, leaving volunteers no way to mark "I don't know" without leaving the dropdown unselected. We're adding the option for those fields too — and aligning forward-sync fallbacks to the actual GSheets validation values, which fixes a pre-existing visual bug (sheets show validation warnings on today's "Unknown"/"N/A" writes because those strings aren't in the sheet's dropdown list).

## Goal

- Remove the Status field from cat entry form (create and edit).
- Eliminate `"Unknown"` from `CAT_SEX_VALUES`, `CAT_SOCIABILITY_VALUES`, `CAT_STATUS_VALUES` enums. Migrate existing rows to null.
- Add `"Unknown"` as a UI-only dropdown option for color, age, sex, sociability in the cat entry form (mapped to `null` on save, shown when DB value is null on load).
- Switch Spot Last Seen to a free-text input.
- Update forward sync fallbacks to use the strings the sheet validation actually accepts: `"???"` for sex/sociability, `"None of the above"` for cat_status, and `""` (blank) for color/age.
- Add a small display helper that renders `"Unknown"` for null cat fields, and apply it across all cat-rendering components for visual consistency.

## Non-goals

- Changing the `cat_status` column or removing it from the DB. Status is still meaningful — just not set from this form.
- Modifying GSheets validation rules (sheet side, separate work).
- Renaming or restructuring `regions` table or its "UNKNOWN" catch-all (that's a completely separate concept).
- Touching forward-sync fallbacks for fields other than the five listed above.

## Design

### 1. Remove Status field from `cat-entry-form.tsx`

- Delete `catStatus` state and `setCatStatus`.
- Delete the `DropdownField` rendering Status (currently lines 449-454).
- Remove `cat_status` from the payload passed to `createCat` / `createSessionCat` / `editCat`.
- Drop `CatStatus` and `CAT_STATUS_VALUES` imports.

### 2. Remove `"Unknown"` from cat enums

#### Enums (`lib/db/enums.ts`)

```ts
export const CAT_SEX_VALUES = ["Female", "Male"] as const;
export const CAT_SOCIABILITY_VALUES = ["Domesticated", "Tame", "Feral"] as const;
export const CAT_STATUS_VALUES = ["Deceased", "Fostered", "Adopted", "MIA"] as const;
```

#### Schema (`lib/db/schema.ts`)

- Drop `.default("Unknown")` from `sex` (line 125) and `sociability` (line 127).

#### Migration (Supabase MCP `apply_migration`)

Run as a single block:

```sql
-- 1. Null out existing "Unknown" values
UPDATE cats SET sex = NULL WHERE sex = 'Unknown';
UPDATE cats SET sociability = NULL WHERE sociability = 'Unknown';
UPDATE cats SET cat_status = NULL WHERE cat_status = 'Unknown';

-- 2. Drop column defaults that reference "Unknown"
ALTER TABLE cats ALTER COLUMN sex DROP DEFAULT;
ALTER TABLE cats ALTER COLUMN sociability DROP DEFAULT;

-- 3. Recreate enum types without "Unknown"
ALTER TYPE cat_sex RENAME TO cat_sex_old;
CREATE TYPE cat_sex AS ENUM ('Female', 'Male');
ALTER TABLE cats ALTER COLUMN sex TYPE cat_sex USING sex::text::cat_sex;
DROP TYPE cat_sex_old;

ALTER TYPE cat_sociability RENAME TO cat_sociability_old;
CREATE TYPE cat_sociability AS ENUM ('Domesticated', 'Tame', 'Feral');
ALTER TABLE cats ALTER COLUMN sociability TYPE cat_sociability USING sociability::text::cat_sociability;
DROP TYPE cat_sociability_old;

ALTER TYPE cat_status RENAME TO cat_status_old;
CREATE TYPE cat_status AS ENUM ('Deceased', 'Fostered', 'Adopted', 'MIA');
ALTER TABLE cats ALTER COLUMN cat_status TYPE cat_status USING cat_status::text::cat_status;
DROP TYPE cat_status_old;
```

Step 1 must run before step 3, or the `USING cast` will fail (any leftover `'Unknown'` value cannot cast to the new enum). The migration is idempotent for repeats only after the type swap — re-running step 3 on the already-recreated type will error. Treat this as a one-shot.

### 3. Forward-sync fallback updates ([lib/services/helper.service.ts](lib/services/helper.service.ts))

In both `mapCatToSheetRow` (lines ~134-157) and `mapUnknownCatToSheetRow` (lines ~176-199):

| Line (approx) | Current | Change to |
|---|---|---|
| 138, 180 | `cat.color ?? "N/A"` | `cat.color ?? ""` |
| 139, 181 | `cat.age ?? "N/A"` | `cat.age ?? ""` |
| 140, 182 | `cat.sex ?? "Unknown"` | `cat.sex ?? "???"` |
| 142, 184 | `cat.sociability ?? "Unknown"` | `cat.sociability ?? "???"` |
| 146 | `catStatus \|\| "Unknown"` | `catStatus \|\| "None of the above"` |

These match the actual GSheets data-validation options for those columns. Fixes a pre-existing visual bug (today's writes flag sheet cells as invalid).

#### Adoptable-cats query (line 653)

Was:
```ts
or(eq(c.cat_status, "Unknown"), isNull(c.cat_status))
```
After migration all `"Unknown"` rows are null. Simplify to:
```ts
isNull(c.cat_status)
```

`statusSuffix` ([lib/services/catalog.service.ts](lib/services/catalog.service.ts)) — already returns `""` for unrecognized status via default case. Null falls through correctly. No change.

### 4. Reverse-sync updates ([lib/validation/reverse-sync.ts](lib/validation/reverse-sync.ts))

Lines 67-68 and 149-150:
```ts
const sex = ["Male", "Female"].includes(rawSex) ? rawSex : null;
```

Lines 70-73 and 153-155:
```ts
const sociability = ["Domesticated", "Tame", "Feral"].includes(rawSociability) ? rawSociability : null;
```

Line 76:
```ts
const validStatuses = ["Deceased", "Fostered", "Adopted", "MIA"];
```

(The `cat_status` already returns null for invalid — just drop "Unknown" from the list.)

The reverse path correctly handles every variant a sheet cell might contain: `"???"`, `"None of the above"`, legacy `"Unknown"`, blank, or invalid text — all map to null.

### 5. Import script updates ([scripts/import-sheets.ts](scripts/import-sheets.ts))

Lines 145, 148, 184, 187 — replace `"Unknown"` fallback with `null`:
```ts
sex: (VALID_SEXES.includes(sexStr) ? sexStr : null) as CatSex | null,
sociability: (VALID_SOCIABILITIES.includes(socStr) ? socStr : null) as CatSociability | null,
```

### 6. Cat entry form updates ([components/app-pages/shared/cat-entry-form.tsx](components/app-pages/shared/cat-entry-form.tsx))

#### Dropdown options
Prepend `"Unknown"` to each affected dropdown's option list:
- Color: `["Unknown", ...CAT_COLOR_VALUES]`
- Age: `["Unknown", ...CAT_AGE_VALUES]`
- Sex: `["Unknown", ...CAT_SEX_VALUES]`
- Sociability: `["Unknown", ...CAT_SOCIABILITY_VALUES]`

#### State init (edit mode)
Map DB null to UI string:
```ts
const [color, setColor] = useState(initialCat?.color ?? "Unknown");
const [age, setAge] = useState(initialCat?.age ?? "Unknown");
const [sex, setSex] = useState(initialCat?.sex ?? "Unknown");
const [sociability, setSociability] = useState(initialCat?.sociability ?? "Unknown");
```

(Create mode: defaults stay empty string so placeholder shows.)

#### Save payload
Map UI `"Unknown"` to undefined (treated as null by the action):
```ts
const normalize = <T>(v: string): T | undefined =>
  v === "Unknown" || v === "" ? undefined : (v as T);

const payload = {
  region_id: effectiveRegionId,
  condition: condition as CatHealthRecordCondition,
  color: normalize<CatColor>(color),
  age: normalize<CatAge>(age),
  sex: normalize<CatSex>(sex),
  sociability: normalize<CatSociability>(sociability),
  // cat_status removed
  spot_last_seen: spotLastSeen || undefined,
  caretaker: caretaker || undefined,
  notes: notes || undefined,
  name: name || undefined,
};
```

#### Spot Last Seen
Replace the `CustomSelect` block (lines 461-472) with the existing `TextField`:
```tsx
<TextField label="Spot Last Seen" value={spotLastSeen} onChange={setSpotLastSeen} />
```
No schema change required (`spot_last_seen` is already `text`).

### 7. Filter configs ([lib/hooks/filter-sort-configs.ts](lib/hooks/filter-sort-configs.ts))

Add `"Unknown"` to the displayed filter options for color, age, sex, sociability (in `DATABASE_LIST_CONFIG` and any other config that filters by these fields):

```ts
{ label: "Color", key: "color", options: [...CAT_COLOR_VALUES, "Unknown"] },
{ label: "Age", key: "age", options: [...CAT_AGE_VALUES, "Unknown"] },
{ label: "Sex", key: "sex", options: [...CAT_SEX_VALUES, "Unknown"] },
{ label: "Sociability", key: "sociability", options: [...CAT_SOCIABILITY_VALUES, "Unknown"] },
```

In the consumer screens that pass the `getFilterValue` accessor to `useFilterSort` ([database-list-screen.tsx:45-49](components/app-pages/database/database-list-screen.tsx#L45) and any other), update the accessor to return `"Unknown"` when the DB value is null:

```ts
(cat, key) => {
  if (key === "region_name") return cat.region_name ?? null;
  const val = cat[key as keyof SelectCat];
  if (val == null) return "Unknown";  // <- new
  return String(val);
}
```

This makes the "Unknown" filter pill select all rows with null in that column.

#### Status filter
`cat_status` filter, if present in any config, must also have `"Unknown"` added the same way. The enum values dropping "Unknown" means the filter would otherwise lose access to that bucket.

### 8. Display helper ([lib/utils.ts](lib/utils.ts))

Add:
```ts
export const displayCatField = (v: string | null | undefined): string => v ?? "Unknown";
```

Apply across cat-rendering components for color, age, sex, sociability, cat_status displays:
- [components/app-pages/shared/cat-card.tsx](components/app-pages/shared/cat-card.tsx)
- [components/app-pages/database/database-general-screen.tsx](components/app-pages/database/database-general-screen.tsx)
- [components/app-pages/database/database-medical-screen.tsx](components/app-pages/database/database-medical-screen.tsx)
- [components/app-pages/database/database-interventions-screen.tsx](components/app-pages/database/database-interventions-screen.tsx)
- [components/app-pages/catalog/catalog-detail-screen.tsx](components/app-pages/catalog/catalog-detail-screen.tsx)
- [components/app-pages/tnvr/tnvr-screen.tsx](components/app-pages/tnvr/tnvr-screen.tsx)
- [components/app-pages/sessions/sessions-manager-screen.tsx](components/app-pages/sessions/sessions-manager-screen.tsx)
- [components/app-pages/sessions/sessions-screen.tsx](components/app-pages/sessions/sessions-screen.tsx) (audit — may only render region; skip if so)
- Pattern: replace `cat.sex ?? "—"`, `cat.color ?? "—"`, `cat.sex || "—"` etc. with `displayCatField(cat.sex)` etc.
- Drops the inconsistency between "—", raw enum text, and empty fallback across components.

### 9. Round-trip verification

| Path | Color/Age | Sex/Sociability | Cat Status |
|---|---|---|---|
| App "Unknown" selection | normalize → undefined → null in DB | normalize → undefined → null | n/a (no input here anymore) |
| DB null → forward sync | writes `""` (blank, valid) | writes `"???"` (valid) | writes `"None of the above"` (valid) |
| Sheet "???" / "None of the above" / blank → reverse sync | maps to null | maps to null | maps to null |
| Reverse-sync stored null → app display | `displayCatField()` shows "Unknown" | shows "Unknown" | shows "Unknown" |

Every path lands on null in DB and "Unknown" in the UI. No data loss, no validation warnings on freshly synced rows.

## Risks / Open items

- **Catalog screen** ([components/app-pages/catalog/catalog-detail-screen.tsx](components/app-pages/catalog/catalog-detail-screen.tsx)) and **TNVR screen** ([components/app-pages/tnvr/tnvr-screen.tsx](components/app-pages/tnvr/tnvr-screen.tsx)) may have display patterns specific to status that need a non-trivial audit during implementation.
- **`mapUnknownCatToSheetRow`** is the function used for the regions = "UNKNOWN" catch-all sheet. Unrelated to our `cat_sex`/`cat_sociability` Unknown removal — clarified in non-goals but worth re-stating: the region name `"UNKNOWN"` stays.
- **Drizzle schema regen** after migration: drizzle's enum representation needs to match the recreated Postgres types. Run `pnpm drizzle-kit pull` (or manually update the schema file) so `catSexEnum`, `catSociabilityEnum`, `catStatusEnum` reflect the trimmed values, then verify `pnpm tsc --noEmit` passes.
- **Tests / seed data** ([lib/db/seed.ts](lib/db/seed.ts) has a commented "Unknown" reference at line 159) — confirm there are no active seed values relying on the removed enum entries.
- **Sheet validation mismatch on legacy rows** — existing sheet rows that contain literal "Unknown" / "N/A" strings (written by the current sync) will continue to show validation warnings until the next forward sync of that row updates the cell. Forward sync triggers on cat updates; touching each cat once clears the noise. No code needed.

## Verification

- `pnpm tsc --noEmit` passes after schema regen.
- Existing cats previously stored as `"Unknown"` now show as null in DB and "Unknown" in the UI.
- Creating a cat with the new "Unknown" UI option saves null in DB.
- Editing a cat with null fields shows "Unknown" selected in the dropdown.
- Forward sync of a cat with null color/age/sex/sociability/cat_status writes `""`/`""`/`"???"`/`"???"`/`"None of the above"` to the sheet — no validation warning on those cells.
- Reverse sync of a sheet row with `"???"` / `"None of the above"` / `"Unknown"` / blank → DB null.
- Filter pill "Unknown" on each affected column selects only rows where the column is null.
- Spot Last Seen accepts free text and persists.

## Out of scope

- Cluster C (edit entry modal pre-uploaded photo display) — separate spec.
- Sheet-side updates to data validation rules.
- Decommissioning `cat_status` from the schema.
