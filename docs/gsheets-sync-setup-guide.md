# AGILA CATalog — GSheets Sync Setup & Operations Guide

Authoritative guide for the Google Sheets ↔ DB sync system: architecture, one-time
production setup (cutover), adding a region, ongoing operations, and the current
legacy/dead code. Written 2026-06-02 from a live read of the code.

> Convention note: region names are the single source of truth in the **app DB**
> (`regions` table, `name` is a free-text `NOT NULL UNIQUE` column). Google Sheets
> and `_config!B2` are mirrors. Everything below follows from that.
> `REGION_NAME_VALUES` in `lib/db/enums.ts` is now a plain constant retained for
> seed/initial data only — it is no longer a Postgres enum or a runtime constraint.

---

## 1. Architecture at a glance

```
REGION_NAME_VALUES const (lib/db/enums.ts)        ← seed/initial data only (plain TS const)

DB `regions` table                               ← SOURCE OF TRUTH (which regions exist)
        │  regions.name is text NOT NULL UNIQUE (managed in-app, Admin → Edit Regions)
        │
        ├──► reverse sync & forward sync read DB regions DIRECTLY (not B2)
        │
        └──► refreshRegionSheetConfig() admin action → writes _config!B2 (mirror)
                     │
                     ▼
             _config!B2 (comma list)             ← consumed ONLY by Apps Script
                     │                              (Protection.gs + photo WebApp)
                     ▼
             Google Sheet tabs (one per region)  ← sync read/write target
```

**Two sync directions:**

- **Forward (DB → Sheet):** cron route `app/api/cron/sync/route.ts` → `syncAllPendingRegions`
  (`lib/services/sync-cron.service.ts`). Drains the `gsheet_sync_queue`, writes rows
  to each region tab, and regenerates the `For RI` / `For FA` summary sheets.
- **Reverse (Sheet → DB):** `fullReverseSync` (`lib/services/reverse-sync.service.ts`),
  invoked by the admin **unfreeze** action (`app/actions/system.ts`) and the
  `scripts/reset-and-reimport.ts` script. Reads every region tab, matches/creates
  cats **by the col-Y UUID**.

**Row identity = col Y (UUID).** This is the linchpin. Forward sync writes it;
reverse sync reads it to match rows to DB cats. A row with a blank col Y is
**skipped** by reverse sync.

---

## 2. Components

| Component | Where | Responsibility |
|-----------|-------|----------------|
| App (Next.js) | `lib/services/*`, `app/actions/*`, `app/api/cron/*` | All sync logic, queue, reverse/forward sync, admin actions |
| Apps Script `Code.gs` | bound to the spreadsheet | `onEdit` installable trigger: writes W/X timestamps + **generates col-Y UUID on first human edit**. The only load-bearing Apps Script piece. |
| Apps Script `Protection.gs` | bound to the spreadsheet | Manual admin functions: `setupRegionSheets()` (headers + UUID seed + protections), plus lower-level helpers |
| Apps Script `WebApp.gs` | bound to the spreadsheet | Photo-import `doPost` (legacy — see §8). `doGet` freeze/unfreeze is **dead**. |
| Service account | `SERVICE_ACCOUNT_CREDENTIALS` | `catalog-gsheets-service@agila-catalog-app.iam.gserviceaccount.com` — the API identity that reads/writes sheets |

---

## 3. Column layout

Header row = **row 2**. Data starts at **row 3**. Region tabs (all except the
UNKNOWN tab) use this layout — see `mapCatToSheetRow` in `lib/services/helper.service.ts`:

| Col | Idx | Field | | Col | Idx | Field |
|-----|-----|-------|-|-----|-----|-------|
| A | 0 | Catalog ID (+status suffix) | | L | 11 | Cat status |
| B | 1 | Photo (`=IMAGE(url)`) | | M | 12 | Caretaker |
| C | 2 | Name | | N | 13 | Date updated |
| D | 3 | Color | | O | 14 | Spot last seen |
| E | 4 | Age | | P | 15 | Neuter date |
| F | 5 | Sex | | Q | 16 | Vaccination date |
| G | 6 | **Neutered** (YES/NO/???) | | R | 17 | Notes |
| H | 7 | Sociability | | S | 18 | (separator) |
| I | 8 | Sick (YES/NO) | | T | 19 | TNVR status |
| J | 9 | Injured (YES/NO) | | U | 20 | Vet status |
| K | 10 | Adoptable (YES/NO) | | V | 21 | For-FA status |

**System columns (service-account / Apps Script only — protected from humans):**

| Col | Idx | Field | Writer |
|-----|-----|-------|--------|
| W | 22 | `last_edited_at` | Apps Script `onEdit` |
| X | 23 | `edited_by` | Apps Script `onEdit` |
| Y | 24 | `uuid` | `onEdit` (new rows) / `seedMissingUuids` (bulk) / forward sync |

> The **UNKNOWN** tab uses a different layout (`mapUnknownCatToSheetRow`):
> A=Catalog, B=Possible Loc, C=PAWS ID, D=Color, E=Age, F=Sex, G=Neutered,
> H=Tame, I=Sick, J=Injured, K=Adoptable, L=Neuter date, M=Vacc date, N–V empty.
> W/X/Y are the same. Verify a real UNKNOWN tab matches this before importing.

---

## 4. One-time production setup (cutover)

Use this when pointing the system at the **real** spreadsheet for the first time
(rows exist, but W/X/Y do not).

### 4.0 Prerequisites
- App deployed (or local) with env set: `CATALOG_SPREADSHEET_ID`,
  `SERVICE_ACCOUNT_CREDENTIALS`, `DATABASE_URL`, the Supabase keys, optionally
  `DISCORD_WEBHOOK_URL`.
- DB `regions` table must have the live regions. For a fresh deploy the initial
  37 regions were seeded by `pnpm drizzle-kit push` (they carry over from the old
  enum). Add new regions in-app (Admin → Edit Regions). Verify:
  `SELECT name FROM regions ORDER BY name`.
- Every region has a sheet tab named **exactly** as its DB name. A hidden
  `_config` tab exists.

### 4.1 Install the Apps Script files
1. Spreadsheet → **Extensions → Apps Script**.
2. Paste the repo contents of `workers/apps-script/Code.gs`, `Protection.gs`,
   `WebApp.gs` into matching files. **Save**.

### 4.2 Install the onEdit installable trigger (not optional)
Pasting `Code.gs` does **not** install the trigger. In the Apps Script editor →
**Triggers** (clock icon) → **+ Add Trigger**:
- Function: `onEditInstallable` · Event source: From spreadsheet · Event type: On edit
- Save and authorize.

Without this, W/X timestamps and col-Y UUIDs for *future* human edits never fire.

### 4.3 Point the app at the real sheet
Set `CATALOG_SPREADSHEET_ID` to the real spreadsheet ID and redeploy / restart.

### 4.4 Populate `_config!B2`
Run the **`refreshRegionSheetConfig()`** admin action (writes the DB region list
to B2). Apps Script reads B2, so this must happen before §4.5.

### 4.5 Run `setupRegionSheets()` once
Apps Script editor → Run → `setupRegionSheets`. It will, idempotently:
1. read the region list from `_config!B2`,
2. warn (in the log) on any tab/B2 mismatch,
3. ensure the W2/X2/Y2 header labels,
4. **seed col-Y UUIDs for every existing data row that lacks one**
   (`seedMissingUuids`) — this is what makes the pre-existing rows importable,
5. clear + (re)apply the A and W–Y protections.

Check **View → Logs** for `seedMissingUuids: assigned N UUID(s)` and the completion line.

### 4.6 Import the sheet data into the DB
With col Y now populated, import. The full-reset path:

```bash
pnpm tsx scripts/reset-and-reimport.ts
```

This wipes cat data, runs `fullReverseSync` (recreates cats by col-Y UUID), and
bulk-imports photos. ⚠️ It **deletes all existing cats first** — only use it when
the real sheet should be the canonical source and the current DB holds test data.

### 4.7 Verify
- `For RI` / `For FA` tabs appear/refresh after the next forward-sync tick.
- Edit any cell in a fresh row → col Y gets a UUID, W a timestamp, X your email.
- `SELECT count(*) FROM cats` matches the sheet row count (minus skipped/blank).

---

## 5. Adding a new region (after go-live)

Adding a region is now **fully self-serve** — no code changes or deployment needed.

**In-app flow (Admin → Edit Regions):**
1. Type the region name + pick a color → **Add region**.
   This inserts the DB row, creates the Google Sheet tab (duplicated from an
   existing region tab, data rows cleared), applies W/X/Y headers, col-A and
   W–Y protections, and refreshes `_config!B2`. One click.
2. Done. The `onEdit` trigger is column-index based — the new tab is automatically
   covered for W/X/Y on human edits.

**Rename / Archive / Delete** are in the same section. Renaming a region also
renames its sheet tab (keeps sync working). Deleting a non-empty region requires
typing the region name to confirm; orphaned cats (no sessions elsewhere, no
override to another region) are deleted with it.

---

## 6. Ongoing operations

- **Forward sync** runs automatically on the cron schedule (`app/api/cron/sync`).
  No manual action.
- **Reverse sync / recovery:** the admin **unfreeze** action runs `fullReverseSync`.
- **Freeze status:** `getSyncStatus` / `setSyncFrozen` gate sync via `system_config`.
- **Protections drift / new tab:** re-run `setupRegionSheets()` (idempotent).
- **A UUID got cleared on a row:** forward sync rewrites it on the next pass; if a
  wrong UUID was typed, reverse-sync may create a duplicate — check `sync_audit_log`.

---

## 7. Design decisions (why it's built this way)

- **Provisioning is manual Apps Script, never cron.** New regions are rare; running
  idempotent setup every cron tick wastes Sheets API quota (tight headroom) and
  Vercel compute. Apps Script runs as sheet owner, free quota, zero API cost.
- **Regions are now data-driven (text column), self-serve from the Admin tab.**
  The `regions.name` pg enum was dropped (2026-06-02) because the owner is
  handing off to non-technical stewards who can't do deploys. `REGION_NAME_VALUES`
  is retained as a plain TS const for initial seeding and filter dropdowns only.
  Free-text names are accepted; a `NOT NULL UNIQUE` DB constraint prevents blanks
  and duplicates.
- **B2-driven protection path is canonical.** `setupRegionSheets()` (Apps Script)
  reads `_config!B2`. The app keeps B2 in sync from the DB via
  `refreshRegionSheetConfig()`.

---

## 8. Legacy / dead code (do not rely on)

- **`WebApp.gs` `doGet` freeze/unfreeze/status** — calls `freezeMode` /
  `unfreezeMode` / `getAuthorizedEmails`, which no longer exist. Dead; freeze is
  now app-side (`system_config`).
- **`lib/services/helper.service.ts` `setupSystemColProtections()`** — a server-side,
  DB-driven twin of the Apps Script protection path. **Not wired to any caller.**
  Superseded by the chosen Apps Script B2-driven path; candidate for removal.
- **`WebApp.gs` `doPost` photo import** — the base64/getCellImage path. Photo import
  is now done server-side via xlsx/zip export (`bulkImportAllNullPhotos`,
  `photo-import.service.ts`). Verify before relying on the WebApp path.

---

## 9. Environment variables

| Var | Used for |
|-----|----------|
| `CATALOG_SPREADSHEET_ID` | Target spreadsheet |
| `SERVICE_ACCOUNT_CREDENTIALS` | Google service-account JSON (sheet read/write identity) |
| `DATABASE_URL` | Postgres |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client |
| `NEXT_SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase |
| `DISCORD_WEBHOOK_URL` | Sync alerts (optional) |

Apps Script script properties (Project Settings → Script Properties), if using the
photo WebApp: `PHOTO_IMPORT_SECRET` (and historically `EMERGENCY_SECRET` for the
now-dead freeze endpoints).
