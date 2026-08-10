# Sync Engine

Two-way sync between the Postgres DB (source of truth) and the AGILA CATalog Google
Spreadsheet (always-live fallback). This is the riskiest, least-visible part of the app and
carries most of its non-obvious rules.

> **Before changing anything here**, read the invariants in [§6](#6-invariants-that-look-like-dead-code).
> Several deliberate-looking oddities exist to fix specific production bugs, and the Jest suite
> encodes them.

## 1. The column contract

Every region tab shares one layout. Data starts at **row 3** (rows 1–2 are headers).

| Col     | Index | Owner           | Contents                                          |
| ------- | ----- | --------------- | ------------------------------------------------- |
| `A`     | 0     | service account | Catalog number + status suffix (`5`, `5m`, `12a`) |
| `B`     | 1     | service account | Photo, as an `=IMAGE("url")` formula               |
| `C`–`V` | 2–21  | **humans**      | Cat data                                          |
| `W`     | 22    | Apps Script     | ISO timestamp of last human edit                  |
| `X`     | 23    | Apps Script     | Editor's email                                    |
| `Y`     | 24    | service account | **UUID — the record key**                         |

Two rules follow from this and drive nearly everything else:

- **`cats.id` *is* the col-Y UUID.** A row created by a volunteer in the sheet gets a UUID from
  Apps Script, and reverse sync inserts the cat using that UUID as its primary key. There is no
  separate mapping table.
- **A row with a blank col Y is invisible to sync.** It is skipped on read, so anything typed
  into it never reaches the DB. `scripts/find-skipped-rows.ts` diagnoses this.

The catalog number in col A is **derived, not stored** — it lives only in the sheet. The DB has
no `catalog_id` column (it was deliberately dropped). Status suffixes come from
`catalog.service.ts`: `m` MIA · `d` Deceased · `a` Adopted · `f` Fostered · none = active.

### The UNKNOWN region is a different layout

`UNKNOWN` reuses cols A–M for a different schema (`B` = possible location, `C` = PAWS ID,
`L`/`M` = neuter/vaccination dates) and leaves `N`–`V` empty. It has no col N, no status
suffix in col A, and no `=IMAGE()` in col B. Every branch that touches col A, col B, or col N
checks `region.name !== "UNKNOWN"` first.

## 2. One cron tick, in order

`workers/sync-cron/` (Cloudflare, `*/20 * * * *`) health-checks `/api/health`, then POSTs
`/api/cron/sync` with a bearer `CRON_SECRET`. The route returns immediately and does the work
in `after()`, so the worker never blocks on a long sync.

`syncAllPendingRegions()` then runs:

```
Phase 0   readAllRegionSheetStates()      one paced read pass, shared by all phases
          ↓
          idle early-exit: no PENDING tasks AND no col-W edits anywhere → return
          ↓
Phase 1   reverse sync    (sheet → DB)    only regions with a non-empty col W
Phase 2   photo import    (sheet → blob)  non-fatal; Discord alert on failure
Phase 3   forward sync    (DB → sheet)    only regions with PENDING tasks
Phase 4   summary regen   (For RI/For FA) only if reverse imported or tasks ran
```

**Reverse runs before photo import**, deliberately: a brand-new sheet row must exist as a cat
in the DB before the importer tries to attach its photo, or the photo orphans.

Phase 3 merges each region's post-write state back into the snapshot so Phase 4's summaries see
this tick's freshly assigned catalog numbers.

The idle early-exit matters for quota — without it, every tick would burn a full read/write
cycle across all regions. It is also why `removeCat` gates its `DELETE` enqueue on
`entry_status === "Original"`: queueing a no-op task for a never-synced draft would wake an
otherwise-idle cron into a full pass.

## 3. Forward sync (DB → sheet)

`syncAndCompactRegion(regionId)` in `lib/services/helper.service.ts`. Read-modify-write over
the whole tab.

1. **Freeze check** — bail if `sync_frozen`.
2. **Load tasks** — `PENDING`, `retryCount < 3`, oldest first.  No tasks → return `null`.
3. **Read `A3:Y`** and capture `originalRowCount` *before* any mutation.
4. **Apply each task**, matching rows by col Y:
   - `DELETE` → splice the row out.
   - **New** (UUID absent) → assign `nextCatalogId(col A values)`, build the row, push it padded
     as `[...payload, "", "", uuid]` so W/X are skipped and the UUID lands in Y.
   - **Existing** → keep the sheet's catalog *number*, recompute the *suffix* from the payload's
     col L status. Guard col N (see [§6](#6-invariants-that-look-like-dead-code)).
5. **Compact + sort** — drop rows with no UUID *or* no A–V content, then sort by catalog number
   (unnumbered rows sink to the bottom).
6. **Rebuild from DB for every survivor** — col B photo formula and col A status suffix, tasked
   or not.
7. **Write `A3:V`** (clear, then update) — W/X are never touched.
8. **Write col Y separately**, padded with blanks out to `originalRowCount`.
9. Mark tasks `COMPLETED`; return the post-write state for the summary phase.

Failure path: increment `retryCount`, set `FAILED` at 3, and write a `sync_audit_log` row in
`finally` either way.

### The queue

`gsheet_sync_queue` rows are enqueued by `refreshCatInSyncQueue(catId, tx)` inside the same
transaction as the mutation that caused them. It **gates on `entry_status === "Original"`** —
drafts (`Unsubmitted`/`Unreviewed`) and `Merged` duplicates never reach a sheet — but still
returns the resolved region so callers can detect a region move.

## 4. Reverse sync (sheet → DB)

`reverseSyncRegionInternal()` in `lib/services/reverse-sync.service.ts`, per row:

- **No col-W timestamp → skip** (unless `force`). This is the entire change-detection mechanism.
- **Cat not in DB → CREATE.** Parse, Zod-validate, insert using the sheet's UUID as `cats.id`,
  with `entry_status: "Original"`, plus health record, any `will_have` interventions, and a
  system-session link.
- **Cat in DB → conflict check.** If `sheetEditedAt <= dbUpdatedAt + 5s`, the DB wins and the
  row is skipped. Otherwise import.

`importSheetRowToDB()` writes cats + health, reconciles intervention signals from cols T/U, and
**cancels that cat's PENDING forward tasks** (marked `COMPLETED` with
`"Superseded by reverse sync"` — intentional cancellation, not failure).

Two fields are handled by omission rather than null:

- **`photo_url` is never written here** — it belongs exclusively to the photo importer.
- **`date_last_seen` is omitted entirely when absent**, so the UNKNOWN tab (which has no col N)
  can't null it out. Same pattern for `paws_id`.

Afterwards, imported rows have their W/X cleared so the next tick skips them — but only after
**re-reading col W and confirming it still matches the snapshot**. A row edited again mid-tick
keeps its timestamp and gets processed next tick instead of being silently swallowed.

### Status change → forward re-stamp

When a status is edited *in the sheet*, nothing would otherwise queue a forward task, so col A's
suffix would stay stale forever. `importSheetRowToDB` takes the cat's `prevStatus` and enqueues a
re-stamp when it changed — after the cancel above, so it is the sole surviving PENDING task. This
is not a GSheet-wins violation: the catalog number still comes from the sheet, and only the
suffix is rewritten from the value just imported.

## 5. Photo import

`importPhotosIfNeeded()` in `lib/services/photo-import.service.ts`.

Candidates are rows where **col W is set and col B is empty** — a human edited the row and there
is no photo formula. If there are none, the expensive export never fires.

When it does fire, it downloads the **whole spreadsheet as `.xlsx`** and parses it as OOXML by
hand (regex over the zip entries) to find images:

```
xl/workbook.xml                      sheet name → rId
xl/_rels/workbook.xml.rels           rId → worksheets/sheetN.xml
xl/worksheets/sheetN.xml             col-Y UUIDs per row
xl/worksheets/_rels/…rels            sheet → drawingM.xml
xl/drawings/drawingM.xml             image anchors (col, row → rId)
xl/drawings/_rels/…rels              rId → media/imageK.ext
xl/media/imageK.ext                  bytes
```

Images anchored at **col B (index 1)** are matched to that row's UUID, compressed with Sharp
(1200px wide, q80), uploaded to the `cat-photos` bucket, and written back as `photo_url`.

> **Why xlsx and not the HTML zip:** Google's `format=zip` export ignores `gid` and truncates at
> ~84 MB, dropping most sheets. `xlsx` is uncapped and embeds every image.
> `exportSpreadsheetAsZip()` in `helper.service.ts` is the leftover from that approach and has
> **no callers** — it and the `node-html-parser` dependency are both dead.

Sheet tab names are matched loosely (non-alphanumerics stripped) because the xlsx export mangles
names like `CTC/SOM` into `CTCSOM`.

## 6. Invariants that look like dead code

Each of these fixes a real bug. Do not "simplify" them.

**Col-Y padding on shrink.** Cols A:V are `clear()`ed before rewrite, but col Y is only
*update*-written. Without padding the write out to the original read length, a delete/merge/
compaction leaves the vacated Y cells holding their old UUIDs — orphan rows that reverse sync
then tries to import as ghost cats.

**Col B rebuilt from DB every tick.** Reading `A3:Y` returns `""` for `=IMAGE()` cells under
`FORMATTED_VALUE`. Echoing untouched rows back would blank every photo on the sheet.

**Col A re-stamped for every survivor, not just tasked rows.** A status changed via a sheet edit
never queues a forward task, so an untouched row would keep a stale suffix (e.g. `30` for a cat
now Deceased — which then inflates the HOME tab's active count, since HOME counts a row as
active only when col A is purely numeric). Re-stamping every survivor self-heals this at zero
extra cost, because the `findCatsByIds` fetch is already happening for the photo rebuild.

**Col N preserved when the DB has no date.** A null `date_last_seen` serializes to `"N/A"`. The
guard keeps whatever the sheet already has unless the DB genuinely holds a date — this protects
historical sighting dates that predate the column's backfill.

**Ghost-row filter.** A row is kept only if it has a UUID **and** some non-empty A–V content. A
UUID-only row is an orphan left by an older un-padded write; dropping it stops it being
rewritten forever.

**Paced Sheets client.** Every call goes through `sheets-client.service.ts`: ~1.2 s spacing
(~50 calls/min against a 60/min quota) plus retry on 429/5xx with 1s/2s/4s backoff. Never call
`google.sheets()` directly.

## 7. Freeze / recovery

`system_config.sync_frozen` is the kill switch, checked by both sync directions.

- Any unhandled error in a cron tick **auto-freezes** and posts a Discord alert.
- Recovery is manual: **Admin → GSheet Config → Unfreeze**, which runs a full reverse sync
  first, then clears the flag. Pending forward tasks are deliberately *not* discarded — they are
  still valid for cats nobody touched during the freeze, and the reverse import cancels only
  those it supersedes.

Every run appends to `sync_audit_log` (region, direction, counts, error, timing).

## 8. Sheet-side code

`workers/apps-script/` is installed on the spreadsheet, not deployed with the app.

- **`Code.gs`** — installable `onEdit` trigger. Writes col W/X and mints a col-Y UUID on the
  first human edit of a row. Ignores edits by the service account (loop prevention) and edits
  outside `A3:V`.
- **`Protection.gs`** — `onChange` trigger that flags hand-made region tabs (invisible to sync)
  with a red banner, plus deprecated protection helpers.

> Structural setup (headers, protections, UUID seeding) is done **server-side from the Admin
> tab** as the service account. The Apps Script twins are deprecated: owner-created protections
> lock the service account out of its own col A / col Y writes. Only
> `clearSystemColProtections()` still matters, for one-time cutover cleanup.
>
> `STATIC_TABS` in `Protection.gs` must stay in sync with `NON_REGION_TABS` in
> `lib/constants.ts` (same list, minus `UNKNOWN`). Apps Script can't import the TS constant.

Region names flow **DB → `_config!B2` → Apps Script**. Apps Script only ever *reads* that list,
so a typo'd tab can never become a region.

## 9. Related code

| Concern                        | File                                      |
| ------------------------------ | ----------------------------------------- |
| Forward sync, mappers, summaries | `lib/services/helper.service.ts`        |
| Reverse sync, conflict rules   | `lib/services/reverse-sync.service.ts`    |
| Tick orchestration             | `lib/services/sync-cron.service.ts`       |
| Pacing + retry                 | `lib/services/sheets-client.service.ts`   |
| Photo import + storage GC      | `lib/services/photo-import.service.ts`    |
| Row parsing / validation       | `lib/validation/reverse-sync.ts`          |
| Catalog number + suffix        | `lib/services/catalog.service.ts`         |
| Freeze flag                    | `lib/services/system.service.ts`          |

Operational setup and runbook: [../operations/gsheets-sync-setup.md](../operations/gsheets-sync-setup.md).
