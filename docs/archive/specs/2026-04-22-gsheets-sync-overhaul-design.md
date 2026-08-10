# GSheets Sync Overhaul Design

**Date:** 2026-04-22
**Status:** Approved

## Overview

Four tightly coupled changes:
1. GSheets column layout standardization + UNKNOWN-specific layout
2. DB schema additions (`catalog_id`, `paws_id`)
3. One-time initial data import script
4. Sync system overhaul (forward, reverse, summary sheets, Apps Script)

---

## 1. GSheets Column Layouts

### Standard Layout (all regions except UNKNOWN)

| Col | Index | Field | Notes |
|-----|-------|-------|-------|
| A | 0 | Catalog ID | verbal, e.g. `14`, `5m` — always catalog_id, never UUID |
| B | 1 | Photo | `=IMAGE(...)` or empty |
| C | 2 | Nickname | |
| D | 3 | Color | |
| E | 4 | Size/Age | |
| F | 5 | Sex | |
| G | 6 | Neutered | YES/NO |
| H | 7 | Tame | sociability |
| I | 8 | Sick | YES/NO |
| J | 9 | Injured | YES/NO |
| K | 10 | Adoptable | YES/NO |
| L | 11 | Status | |
| M | 12 | Caretaker | |
| N | 13 | Date Last Seen | auto-written by sync |
| O | 14 | Place Last Seen | |
| P | 15 | Date of Kapon | |
| Q | 16 | Date of Vaccination | |
| R | 17 | Notes | |
| S | 18 | *(separator)* | blacked out |
| T | 19 | For Rescues (TNVR) | auto-written by sync |
| U | 20 | For Rescues (Vet) | auto-written by sync |
| V | 21 | For FA | auto-written by sync |
| W | 22 | `last_edited_at` | Apps Script only — never touched by sync |
| X | 23 | `edited_by` | Apps Script only — never touched by sync |
| Y | 24 | Unique ID (UUID) | app-managed, new column |

### UNKNOWN Layout (distinct format, not reformatted to standard)

| Col | Index | Field | Notes |
|-----|-------|-------|-------|
| A | 0 | Catalog ID | always catalog_id, never UUID |
| B | 1 | Possible Loc | → `spot_last_seen` |
| C | 2 | PAWS ID# | → `paws_id` |
| D | 3 | Color | |
| E | 4 | Size/Age | |
| F | 5 | Sex | |
| G | 6 | Neutered | YES/NO |
| H | 7 | Tame | sociability |
| I | 8 | Sick | YES/NO |
| J | 9 | Injured | YES/NO |
| K | 10 | Adoptable | YES/NO |
| L | 11 | Date of Kapon | → `neuter_date` |
| M | 12 | Date of Vaccination | → `vaccination_date` |
| N–V | 13–21 | *(empty)* | |
| W | 22 | `last_edited_at` | Apps Script only |
| X | 23 | `edited_by` | Apps Script only |
| Y | 24 | Unique ID (UUID) | app-managed, new column |

UNKNOWN has no Photo, Nickname, Status, Caretaker, Date Last Seen, Notes, or TNVR/Vet/FA auto-cols. Sync branches on `region.name === "UNKNOWN"` wherever column mapping differs.

**UNKNOWN pre-import checklist (manual):**
- Ensure Date of Kapon (col L) and Date of Vaccination (col M) are separate columns
- Fix `last_edited_at` offset to land on col W (index 22)
- Add col Y with header `"Unique ID"`

**Catalog ID rules (all regions):**
- Col A is always catalog_id — UUID values in col A are testing artifacts and should be discarded
- DB stores base number only (e.g., `"14"`) — suffix never stored
- Status suffix appended at sync time from `cat_status`: MIA → `m`, Deceased → `d`, Adopted → `a`, Fostered → `f`, else none
- Gaps are permanent — retired IDs never reused
- New cats: `max(existing catalog_ids in region) + 1`, always from the highest existing value regardless of gaps

---

## 2. DB Schema Changes

Two nullable text columns added to `cats` via Drizzle migration:

- `catalog_id` — base number string (e.g. `"14"`). Suffix derived at sync time, never stored.
- `paws_id` — external PAWS identifier. Populated from UNKNOWN col C (index 2) during import. Present on all cat records; UI exposes it only for UNKNOWN region cats.

One boolean column added to `sessions`:

- `is_system` — `boolean`, default `false`. Marks sessions created by the system (import script, reverse sync creates, admin cat creation outside field sessions) vs. real field sessions. Prevents false-matching a new field session that hasn't had users added yet.

Health records and regions unchanged.

---

## 3. System Session Contract

One permanent system session per region, created on demand and reused indefinitely.

- Identified by: `is_system = true` on the `sessions` row for that region
- Used for: reverse sync cat creates, admin-created cats outside field sessions
- Admin-created cats are still attributed to the creating admin via the service layer — the system session is purely a region-linking mechanism
- Field sessions remain the canonical mechanism for field data gathering

---

## 4. Initial Import Script (`scripts/import-sheets.ts`)

One-time `tsx` script. Run locally with `.env.local`. Delete after use.

**Per region, in order:**

1. Read `'${regionName}'!A3:X` via Sheets API (col Y does not exist yet)
2. For each data row:
   - Col A is always the catalog_id — strip status suffix (e.g. `"4a"` → `"4"`) to get base number
   - Any unparseable col A value (e.g. leftover test UUIDs): assign `max(existing catalog_ids) + 1`
   - Generate a fresh UUID for every row
3. Parse fields using the appropriate column mapping:
   - **Standard regions**: standard indices (Section 1)
   - **UNKNOWN**: col B (index 1) → `spot_last_seen`; col C (index 2) → `paws_id`; col L (index 11) → `neuter_date`; col M (index 12) → `vaccination_date`; name/status/caretaker/notes/photo → `null`
4. Upsert cat record (skip if already in DB by catalog_id + region)
5. Insert `catHealthRecords` per mapping above
6. Upsert system session for region; link cat via `sessionCats`
7. Batch-write all generated UUIDs to col Y after all rows processed
8. Log results: created / skipped / errors per region

**Deferred — photo migration:**
GSheet photos are directly embedded cell images (not `=IMAGE()` formulas). Extracting them requires a separate `spreadsheets.get` API call with deep field paths per row, followed by an authenticated fetch and re-upload to Supabase storage. Explicitly deferred to a future task. All `photo_url` values imported as `null`.

---

## 5. Sync System Changes

Sync branches on `region.name === "UNKNOWN"` wherever column mapping differs.

### 5a. Forward Sync

**`mapCatToSheetRow` (standard regions):**
- Col A (index 0): `catalog_id + statusSuffix(cat_status)`
- Cols B–V: existing mapping unchanged
- Col Y (index 24): UUID — written in a separate `values.update` to `Y3:Y` after the main `A3:V` write

**`mapUnknownCatToSheetRow` (UNKNOWN region, new):**
- [0] A: `catalog_id + statusSuffix(cat_status)`
- [1] B: `spot_last_seen`
- [2] C: `paws_id`
- [3] D: `color`
- [4] E: `age`
- [5] F: `sex`
- [6] G: neuter_date exists ? `"YES"` : `"NO"`
- [7] H: `sociability`
- [8] I: condition includes Sick ? `"YES"` : `"NO"`
- [9] J: condition includes Injured ? `"YES"` : `"NO"`
- [10] K: `is_adoptable` ? `"YES"` : `"NO"`
- [11] L: `neuter_date` formatted or `"N/A"`
- [12] M: `vaccination_date` formatted or `"N/A"`
- [13–21] N–V: `""` (empty)
- Col Y: UUID written separately

**`syncAndCompactRegion` changes (all regions):**
- Row matching: `r[24] === task.entityId` (col Y UUID) instead of `r[0]`
- Main data write range stays `A3:V`; UUID written separately to `Y3:Y`

**New catalog_id assignment:**
- If `catalog_id` is null when syncing a cat, read col A from current sheet state, parse all base numbers (strip suffixes), take `max + 1`, persist to DB, then write

### 5b. Reverse Sync

**`readSheetState` changes (all regions):**
- Read range: `A3:X` → `A3:Y`
- `entityId` = `row[24]` (col Y UUID)
- `lastEditedAt` = `row[22]` (col W), `editedBy` = `row[23]` (col X) — unchanged
- `clearSheetEditTimestamps` continues clearing W and X only

**`parseSheetRow` — standard regions:** no changes to existing field mappings

**`parseUnknownSheetRow` — UNKNOWN region (new):**
- `id`: `row[24]`
- `spot_last_seen`: `row[1]`
- `paws_id`: `row[2]`
- `color`: `row[3]`
- `age`: `row[4]`
- `sex`: `row[5]`
- neutered: `row[6]` → infer neuter_date exists
- `sociability`: `row[7]`
- sick: `row[8]`, injured: `row[9]` → derive `condition`
- `is_adoptable`: `row[10]`
- `neuter_date`: `row[11]`
- `vaccination_date`: `row[12]`
- `name`, `cat_status`, `caretaker`, `notes`, `photo_url`: `null`

**New CREATE support (all regions):**
- If `entityId` UUID not in DB → create new cat
- Parse fields using appropriate mapping (standard or UNKNOWN)
- Parse `catalog_id` from col A (strip suffix)
- Upsert system session for region; link new cat via `sessionCats`
- Insert `catHealthRecords`

**Deletion policy:**
- No sheet-deletion detection. DB is source of truth.
- Rows accidentally deleted from the sheet are recreated by the next forward sync cycle.
- Hard deletes originate from the app only.

### 5c. Apps Script Changes

- `onEdit` trigger: when a new data row is added (col A has a value, col Y is empty) → auto-generate UUID via `Utilities.getUuid()` and write to col Y
- UUID v4 is fully compatible with Postgres UUID type
- UUID picked up by reverse sync on next cycle to create the cat in DB

### 5d. Admin Cat Creation (App-side, outside sessions)

- UI requires region selection when creating a cat without an active field session
- On submit: upsert system session for selected region → link cat via `sessionCats` → queue for forward sync
- Creating admin attributed via service layer as normal
- `catalog_id` assigned at forward sync time (`max + 1` for selected region)

---

## 6. Summary Sheets (For RI + For FA)

Step 3 in `syncAllPendingRegions`, runs after all forward syncs complete. Both sheets wiped and fully regenerated from DB each cycle. Manual edits will be overwritten.

### For RI (Rescues & Interventions)

4-column layout. Region name as header row. 20 blank rows per region section.

| Col A | Col B | Col C | Col D |
|-------|-------|-------|-------|
| `catalog_id+suffix` | TNVR status | `catalog_id+suffix` | Vet status |

Query: cats with `Pending` TNVR or Vet interventions, joined to region via latest session.

### For FA (Foster & Adoption)

6-column layout. Region name as header row. 20 blank rows per region section.

| Col A | Col B | Col C | Col D | Col E | Col F |
|-------|-------|-------|-------|-------|-------|
| `catalog_id+suffix` | `"Healthy & Adoptable"` | `catalog_id+suffix` | `"Sick & Adoptable"` | `catalog_id+suffix` | `"Injured & Adoptable"` |

Query: cats where `is_adoptable = true`, joined to region via latest session, grouped by condition.

Both sheets: no UUID or timestamp columns. Pure derived output.

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| UUID in col Y, catalog_id in col A | Preserves verbal IDs ("faura 20") team relies on; col Y invisible to casual users |
| UNKNOWN keeps distinct column layout | Different data captured for unplaced cats; sync branches on `region.name === "UNKNOWN"` |
| Col A is always catalog_id, never UUID | UUID lives only in col Y; any UUID values in col A are testing artifacts |
| Catalog ID suffix derived at sync time | Always derivable from `cat_status`; no need to store separately |
| Gaps in catalog_id are permanent | Prevents "faura 5" from referring to two different cats over time |
| No sheet-deletion → DB-deletion | DB is source of truth; forward sync self-heals accidentally deleted rows |
| Photos deferred | Embedded images require auth'd fetch + Supabase re-upload — separate task |
| System session per region, reused | Avoids sessions table pollution; preserves normalization (no `region_id` on cats) |
| `paws_id` on all cats, UI-gated to UNKNOWN | Schema stays consistent; only meaningful for UNKNOWN region currently |
| Reverse sync handles CREATE | Apps Script UUID + reverse sync create = seamless manual sheet additions flow to DB |
| Admin cat creation requires region selection | Only managers/admins; sessions remain canonical for field data |
