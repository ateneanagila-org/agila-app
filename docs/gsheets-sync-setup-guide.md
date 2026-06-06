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
        └──► provisionSheets() admin action (Admin → GSheet Config → Provision Sheets)
                     │        → writes _config!B2 (mirror) as part of provisioning
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

**Region routing rule:** A cat's sheet tab is determined by its _effective region_ —
`COALESCE(cats.region_id override, most-recent session's region)`. The same rule the
app display uses. If a manager changes a cat's region on the General tab (writes
`cats.region_id`), the cat automatically routes to the new tab and the old-tab row is
deleted on the next cron tick. A brief one-tick duplication across two tabs is expected
and self-heals.

---

## 2. Components

| Component                   | Where                                               | Responsibility                                                                                                                                                                                                   |
| --------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App (Next.js)               | `lib/services/*`, `app/actions/*`, `app/api/cron/*` | All sync logic, queue, reverse/forward sync, admin actions                                                                                                                                                       |
| Cron scheduler              | `workers/sync-cron/` (Cloudflare Worker)            | Fires every 20 min (`*/20 * * * *`): health-checks `/api/health`, then POSTs `/api/cron/sync` with `CRON_SECRET`. Skips + Discord-alerts if the app is unhealthy. The app, not the worker, holds the sync logic. |
| Apps Script `Code.gs`       | bound to the spreadsheet                            | `onEditInstallable` + `onSheetChange` triggers: write W/X timestamps, **generate col-Y UUID on first human edit**, flag orphan tabs. The only load-bearing Apps Script piece.                                    |
| Apps Script `Protection.gs` | bound to the spreadsheet                            | **Legacy setup** (`setupRegionSheets`, etc.) — superseded by the admin UI (§8). Retained only for the one-time cutover `clearSystemColProtections()`.                                                            |
| Apps Script `WebApp.gs`     | bound to the spreadsheet                            | Photo-import `doPost` (legacy — see §8). `doGet` freeze/unfreeze is **dead**.                                                                                                                                    |
| Service account             | `SERVICE_ACCOUNT_CREDENTIALS`                       | `catalog-gsheets-service@agila-catalog-app.iam.gserviceaccount.com` — the API identity that reads/writes sheets                                                                                                  |

---

## 3. Column layout

Header row = **row 2**. Data starts at **row 3**. Region tabs (all except the
UNKNOWN tab) use this layout — see `mapCatToSheetRow` in `lib/services/helper.service.ts`:

| Col | Idx | Field                       |     | Col | Idx | Field            |
| --- | --- | --------------------------- | --- | --- | --- | ---------------- |
| A   | 0   | Catalog ID (+status suffix) |     | L   | 11  | Cat status       |
| B   | 1   | Photo (`=IMAGE(url)`)       |     | M   | 12  | Caretaker        |
| C   | 2   | Name                        |     | N   | 13  | Date updated     |
| D   | 3   | Color                       |     | O   | 14  | Spot last seen   |
| E   | 4   | Age                         |     | P   | 15  | Neuter date      |
| F   | 5   | Sex                         |     | Q   | 16  | Vaccination date |
| G   | 6   | **Neutered** (YES/NO/???)   |     | R   | 17  | Notes            |
| H   | 7   | Sociability                 |     | S   | 18  | (separator)      |
| I   | 8   | Sick (YES/NO)               |     | T   | 19  | TNVR status      |
| J   | 9   | Injured (YES/NO)            |     | U   | 20  | Vet status       |
| K   | 10  | Adoptable (YES/NO)          |     | V   | 21  | For-FA status    |

**System columns (service-account / Apps Script only — protected from humans):**

| Col | Idx | Field            | Writer                                                         |
| --- | --- | ---------------- | -------------------------------------------------------------- |
| W   | 22  | `last_edited_at` | Apps Script `onEdit`                                           |
| X   | 23  | `edited_by`      | Apps Script `onEdit`                                           |
| Y   | 24  | `uuid`           | `onEdit` (new rows) / `seedMissingUuids` (bulk) / forward sync |

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

### 4.2 Install the installable triggers (not optional)

Pasting the script files does **not** install triggers. In the Apps Script editor →
**Triggers** (clock icon) → **+ Add Trigger**, add **both**:

1. Function: `onEditInstallable` · From spreadsheet · On edit
   — without it, W/X timestamps and col-Y UUIDs for future human edits never fire.
2. Function: `onSheetChange` · From spreadsheet · **On change**
   — flags region tabs created by hand (outside the app). A tab not created via
   the app is invisible to sync, so data typed into it is silently lost; this
   drops a red "won't sync" banner into the new tab + toasts the creator. App-made
   tabs aren't flagged (the app writes the name to `_config!B2` before creating
   the tab). **Never add region tabs by hand — always use Admin → Edit Regions.**

Save and authorize each.

### 4.3 Point the app at the real sheet

Set `CATALOG_SPREADSHEET_ID` to the real spreadsheet ID and redeploy / restart.

### 4.4 Provision the region sheets (admin UI)

Run **Admin → GSheet Config → Provision Sheets** (`provisionSheets()` server
action). Running as the **service account**, this idempotently:

1. widens every region grid to 25 columns so W/X/Y are addressable
   (`ensureRegionSheetWidth`),
2. writes the W2/X2/Y2 header labels (`ensureRegionSheetHeaders`),
3. applies **and owns** the A and W–Y protections, granting the service account
   itself as editor so its sync writes succeed (`setupSystemColProtections`),
4. mirrors the DB region list to `_config!B2` (`syncRegionSheetNames`).

This is structure-only and safe to re-run anytime (drift repair, protection fix).
It deliberately does **not** mint UUIDs — that's the separate, identity-affecting
§4.5 action.

> **Apps Script is no longer used for setup** — the admin UI does everything
> `setupRegionSheets()` did. The lone exception is a **one-time cutover cleanup**:
> if protections were ever applied via the Apps Script `setupRegionSheets()` /
> `setupSystemColProtection()`, the service account **cannot** delete them (a
> protected range is removable only by its creator). Run Apps Script →
> `clearSystemColProtections()` **once as the owner** first, then Provision Sheets.
> On a clean sheet (no prior protections) skip this. After this, the service
> account owns all protections and re-provisioning is fully self-serve forever.

### 4.5 Seed col-Y UUIDs (admin UI)

Run **Admin → GSheet Config → Seed UUIDs** (`seedSheetUuids()` →
`seedMissingUuidsAllRegions()`). Assigns a UUID to every existing data row that
has content but no col-Y UUID — this is what makes the pre-existing rows
importable (reverse sync **skips UUID-less rows**). Idempotent: only fills blanks,
never overwrites. The result reports how many were newly assigned (rows that
already had a UUID are not re-counted).

> Kept separate from Provision (§4.4) on purpose: this mints **permanent cat
> identity** and is a **once-at-cutover** act, whereas Provision is safe structural
> repair you may click anytime. After go-live the `onEdit` trigger mints UUIDs for
> new rows automatically — this button should essentially never run again.

### 4.6 Import the sheet data into the DB

With col Y now populated, import. The full-reset path — **at cutover, pass
`--wipe-photos`** (see below for why):

```bash
pnpm tsx scripts/reset-and-reimport.ts --wipe-photos
```

This wipes cat data, runs `fullReverseSync` (recreates cats by col-Y UUID), and
bulk-imports photos. ⚠️ It **deletes all existing cats first** — only use it when
the real sheet should be the canonical source and the current DB holds test data.

**`--wipe-photos` (opt-in storage wipe):** photos are stored at
`${uuid}/photo.jpg` and uploaded with `upsert`, so a rerun with **stable** UUIDs
overwrites each photo in place — no flag needed. But a **full reintegration**
re-seeds **fresh** col-Y UUIDs (§4.5), which re-keys every photo path and orphans
all prior objects (the old `${oldUuid}/photo.jpg` files are never overwritten or
deleted). `--wipe-photos` empties the bucket first so storage ends with exactly
the current set, zero orphans. It's safe because photos are sourced from the sheet
xlsx and fully rebuilt by the import.

> **Full reintegration is the only case that warrants it.** It's gated behind the
> flag on purpose: the wipe forces a re-download of _every_ photo from the sheet,
> which is slow and occasionally flaky. For routine reruns (stable UUIDs) leave it
> off — upsert handles overwrites and you skip the expensive re-download. Only at a
> fresh-UUID cutover does the orphan cleanup justify the cost.

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

**Rename / Delete** are in the same section. Renaming a region also
renames its sheet tab (keeps sync working). Deleting a non-empty region requires
typing the region name to confirm; orphaned cats (no sessions elsewhere, no
override to another region) are deleted with it.

---

## 6. Ongoing operations

- **Scheduler:** a Cloudflare Worker (`workers/sync-cron/`) fires every 20 minutes,
  health-checks `/api/health`, then POSTs `/api/cron/sync`. **Forward sync** runs from
  there automatically (drains the queue) — no manual action.
- **Auto-freeze on failure:** if a sync tick throws, the cron route freezes sync
  (`setSyncFrozen`) and fires a Discord alert. Clear it from Admin → GSheet Config →
  **Unfreeze** after resolving the cause (unfreeze also runs a full reverse sync).
- **Reverse sync / recovery:** the admin **unfreeze** action runs `fullReverseSync`.
- **Freeze status:** `getSyncStatus` / `setSyncFrozen` gate sync via `system_config`.
- **Protections drift / new tab:** re-run **Admin → GSheet Config → Provision
  Sheets** (idempotent). Runs as the service account; no Apps Script needed.
- **A UUID got cleared on a row:** forward sync rewrites it on the next pass; if a
  wrong UUID was typed, reverse-sync may create a duplicate — check `sync_audit_log`.
- **Cat appears in two tabs:** the region routing rule was recently applied to sync
  (2026-06-03). Pre-existing stale rows from before that date won't self-clean unless
  the cat is edited again. Manually delete the stale row, or just re-save the cat from
  the General tab to trigger the cleanup.
- **HOME totals don't match the app's counts:** expected and usually harmless — the
  HOME tab and the app count cats differently. See §10 for which one to trust and how
  to reconcile.

---

## 7. Design decisions (why it's built this way)

- **Provisioning is admin-triggered, never cron.** New regions are rare; running
  idempotent setup every cron tick wastes Sheets API quota (tight headroom) and
  Vercel compute. The admin **Provision Sheets** button runs it on demand.
- **Setup is server-side (admin UI), not Apps Script.** `provisionSheets()` runs
  as the service account and does the whole structural setup — grid width, W/X/Y
  headers, A + W–Y protections (granting itself as editor), and the `_config!B2`
  mirror. This is the canonical path. It supersedes the Apps Script
  `setupRegionSheets()` (see §8), which is retained only for the one-time cutover
  `clearSystemColProtections()` cleanup. Reason for moving off Apps Script: the
  owner is handing off to non-technical stewards who can't open the script editor,
  so anything operationally necessary must be a button. The earlier Apps Script
  protection path also had a service-account-lockout bug (it stripped all editors
  and never re-added the service account), which the server path avoids by design.
- **Provision and Seed UUIDs are deliberately two buttons.** Provision is
  structure-only and safe to re-run anytime. Seed UUIDs mints **permanent cat
  identity** and is a once-at-cutover act. Folding them would risk minting a
  permanent UUID on a transient half-typed row during a routine provision, so they
  stay separate. See §4.4 / §4.5.
- **Regions are data-driven (text column), self-serve from the Admin tab.**
  The `regions.name` pg enum was dropped (2026-06-02). `REGION_NAME_VALUES` is
  retained as a plain TS const for initial seeding and filter dropdowns only.
  Free-text names are accepted; a `NOT NULL UNIQUE` DB constraint prevents blanks
  and duplicates.

---

## 8. Legacy / dead code (do not rely on)

- **`WebApp.gs` `doGet` freeze/unfreeze/status** — calls `freezeMode` /
  `unfreezeMode` / `getAuthorizedEmails`, which no longer exist. Dead; freeze is
  now app-side (`system_config`).
- **Apps Script `setupRegionSheets()` / `setupSystemColProtection()` /
  `seedMissingUuids()`** — the original owner-run setup path. **Superseded by the
  admin UI** (Provision Sheets + Seed UUIDs), which runs as the service account.
  Retained runnable only for the **one-time cutover** `clearSystemColProtections()`
  (the service account can't delete owner-created protections). Do not use them for
  routine setup — they create owner-owned protections that lock the service account
  out of its own A / W–Y writes.
- **`WebApp.gs` `doPost` photo import** — the base64/getCellImage path. Photo import
  is now done server-side via xlsx/zip export (`bulkImportAllNullPhotos`,
  `photo-import.service.ts`). Verify before relying on the WebApp path.

---

## 9. Environment variables

| Var                                                          | Used for                                                |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| `CATALOG_SPREADSHEET_ID`                                     | Target spreadsheet                                      |
| `SERVICE_ACCOUNT_CREDENTIALS`                                | Google service-account JSON (sheet read/write identity) |
| `DATABASE_URL`                                               | Postgres                                                |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client                                         |
| `NEXT_SUPABASE_SERVICE_ROLE_KEY`                             | Server-side Supabase                                    |
| `DISCORD_WEBHOOK_URL`                                        | Sync alerts (optional)                                  |

Apps Script script properties (Project Settings → Script Properties), if using the
photo WebApp: `PHOTO_IMPORT_SECRET` (and historically `EMERGENCY_SECRET` for the
now-dead freeze endpoints).

---

## 10. Data integrity: why HOME can disagree with the app — and which to trust

**Short answer: trust the app (the database). The HOME tab is a convenience
summary built from spreadsheet formulas, and it can drift. The app's numbers are
computed from the actual cat records.**

This is not a bug you can permanently "fix" — it's a built-in consequence of the
spreadsheet being editable by many hands. Expect HOME and the app to disagree by a
few cats from time to time. Here's the plain-language version of why.

### The two count cats differently

Every region tab stores each cat's status in **two places**:

- **Column A** — the catalog number, with a letter suffix for non-active cats:
  `m` = MIA, `d` = Deceased, `a` = Adopted, `f` = Fostered. An active cat is just a
  plain number (e.g. `30`); a deceased one is `30d`.
- **Column L** — the status spelled out (`Adopted`, `Deceased`, `MIA`, …).

The **HOME tab counts "active" cats by Column A** (it counts the cells that are a
plain number). The **app counts status from Column L** (the real record). As long as
those two agree, HOME and the app match. The moment someone edits one without the
other, they drift.

### How the drift happens

When a volunteer changes a cat's status **in the sheet** — say, types `Deceased` in
Column L — the app picks that up correctly on the next sync, and (as of 2026-06-06)
**re-stamps Column A to `30d` automatically** on the following forward-sync tick.
Historically Column A was *not* rewritten by that path, so a window of drift could
open between a sheet-side status edit and the next in-app edit. During that window:

- HOME sees `30` (a plain number) and counts the cat as **active**.
- HOME _also_ sees `Deceased` in Column L and counts it under **Deceased**.
- The same cat is counted **twice**, inflating HOME's overall total.

The reverse can also happen (Column A says `26m` but Column L says the cat is active),
which makes HOME count the cat in _neither_ bucket and _under_-count. The net of these
is why HOME's "OVERALL TOTAL" can still sit a few above or below the app's true count
**between sync ticks** — the suffix self-heal is now automatic but not instantaneous
(it lands on the next 20-min forward tick), and a row whose status was never changed
through the app *or* sheet is never re-examined.

> Worked example (June 2026): the app held **551** cats; HOME showed **555**. The
> import was perfect — every one of the 551 sheet rows became exactly one cat, no
> duplicates, no drops. The 4-cat gap was entirely **8 rows double-counted** minus
> **4 rows missed** by HOME's Column-A method. The database was right; HOME was inflated.

### Which number to trust

- **For any real decision (census, reporting, adoptions): trust the app.** Its counts
  come straight from the cat records and are validated on the way in.
- **Treat HOME as an at-a-glance dashboard**, not an authoritative tally. It's only as
  accurate as the Column-A suffixes, which humans can leave stale.

### How to reconcile HOME back to the app

A **forward sync** rewrites Column A from the database's status, so the suffixes
correct themselves and HOME snaps back to the true numbers. As of 2026-06-06 forward
sync re-stamps Column A for **every surviving row in any region it syncs** (not just
the rows with a queued change), and a sheet-side status edit now **enqueues its own
forward re-stamp** — so any region that sees activity self-heals on the next tick with
no manual step. To force it sooner:

- Re-save any cat in the affected region from the app's General tab (queues a sync), **or**
- Run a full reset (`scripts/reset-and-reimport.ts`) — its final **global snap** step
  forward-syncs **every** region from the DB, catching even regions that have seen no
  activity at all (the one case the per-tick self-heal can't reach).

To _find_ the drifted rows manually, run `pnpm tsx scripts/find-suffix-drift.ts` (lists
every row where the Column-A suffix disagrees with Column L).

### One thing to actually be careful about

A cat only exists to the database once its row has a **UUID in Column Y** (§4.5,
"Seed UUIDs"). A row with a blank Column Y is **silently skipped** on import while
HOME still counts it — a real (not cosmetic) discrepancy. Today every row is seeded,
but the rule to remember: **always run Admin → GSheet Config → Seed UUIDs before a
reset/reimport**, so no freshly-added row is left behind.
