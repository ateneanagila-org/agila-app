# AGILA DB Sync — Implementation Summary

## What we're building

A reliable two-way synchronization system between the AGILA app database (PostgreSQL) and the CATalog Google Sheets. The sheets serve as a read-only "living view" for volunteers and managers, with the database as the authoritative source of truth. In emergencies, the sheets become a temporary database when the app is down.

---

## Phase 1 — Forward Sync Hardening
*Making the existing DB -> GSheets sync production-ready*

**Fix duplicate code.** The intervention service has its own copy of a sync helper that's slightly worse than the canonical version. Remove it, use the one from the shared helper.

**Add retry tracking.** Right now if a sync fails, tasks sit in PENDING forever with no record of why. We add a retry counter and a "last error" field to each queued task so the system can track failures and give up gracefully after 3 attempts.

**Add an audit log.** Every sync cycle — whether it succeeds or fails — gets recorded in a new audit table: which region, how many tasks processed, how many failed, any error messages, and when it ran. This is the foundation for future alerting.

**Add a freeze flag.** A simple on/off switch stored in the database that halts all sync operations when flipped. This is the kill switch for the failover scenario.

**Add API endpoints.** Two new routes: `/api/cron/sync` (the sync trigger, protected by a secret token) and `/api/health` (a simple database connectivity check for uptime monitoring).

**Set up the Cloudflare Worker.** A lightweight cron job that runs every 10 minutes. It first pings `/api/health` — if the app is unhealthy, it sends a Discord alert and skips sync. If healthy, it triggers `/api/cron/sync`. This is free on Cloudflare's plan and gives us sub-hourly intervals that Vercel Hobby doesn't support.

---

## Phase 2 — Google Sheets Preparation
*Getting the sheets ready for reverse sync, plus the freeze/unfreeze control system*

**Add hidden timestamp columns.** Two new columns (W and X) are added to every regional sheet tab: `last_edited_at` and `edited_by`. These are protected so only the Apps Script can write to them.

**Deploy a Google Apps Script trigger.** An `onEdit` trigger that fires whenever anyone manually edits a cell in the data range. It records the exact timestamp and the editor's email in columns W and X. Crucially, it ignores edits made by the service account (our sync system) to prevent feedback loops.

**Sheet protection managed by the app.** The data range (A-V) is protected via the Sheets API directly from the Next.js app — no manual Apps Script steps required for normal freeze/unfreeze operations. `freezeSheetProtections()` removes protections so all sheet users can edit freely. `unfreezeSheetProtections()` re-adds them, restricting edits to authorized managers/admins only.

**Dynamic authorized editors via `_config` sheet.** A hidden, protected `_config` tab stores the comma-separated list of authorized editors in cell B1. This is read by Apps Script's `unfreezeMode()` and by the app's `unfreezeSheetProtections()`. The list is derived automatically from DB profiles: whenever any Administrator or Manager profile is updated, `syncSheetEditors()` re-derives the emails from `profiles` + Supabase auth and writes them to `_config!B1`. No hardcoded email lists anywhere.

**Freeze/unfreeze via app UI.** A `SyncControls` component with Freeze and Unfreeze buttons handles the full cycle in one click — sets the DB flag, manages sheet protections, and shows live status. No manual Apps Script editor access needed for normal operations.

**Emergency fallback for when the app is down.** `WebApp.gs` deploys as an Apps Script Web App, giving a bookmarkable URL (`?action=freeze&secret=...`) that triggers `freezeMode()` and `unfreezeMode()` from a phone browser. Protected by a secret stored in Script Properties. Only needed if the app is completely unreachable.

---

## Phase 3 — Reverse Sync
*Reading manual GSheet edits back into the database*

**Read the full sheet state.** A new function that reads the entire sheet including the timestamp columns, returning structured data per row with the entity ID and edit metadata.

**Reconciliation logic.** For each row in the sheet, the system compares the GSheet `last_edited_at` timestamp against the database's `last_updated_at` timestamp. Rules:
- No timestamp on the sheet row -> skip (no manual edit)
- Cat doesn't exist in DB -> skip (don't auto-create)
- GSheet timestamp is newer by more than 5 seconds -> import the edit
- DB is newer or within the 5-second buffer -> DB wins, skip

Every imported row is validated through strict Zod schemas before touching the database. If a manager entered an invalid value (e.g., a misspelled cat color), the row is skipped, the error is logged, and the maintainer gets a record of it.

**Conflict resolution.** When a GSheet edit wins and gets imported, any pending forward sync tasks for that same cat are cancelled. This prevents the DB-originated change from coming back around and overwriting the manager's correction.

**Integrate into the cron cycle.** The order matters: reverse sync (Phase A) runs first on all regions, then forward sync (Phase C) runs for regions with pending tasks. Manager edits are always imported before new DB changes are pushed out.

**Clear timestamps after import.** Once a row is successfully imported, columns W and X are cleared. This prevents the same edit from being re-imported on the next cron cycle.

---

## Phase 4 — Freeze/Unfreeze Flow
*The failover and recovery system*

**Freeze.** The maintainer clicks **Freeze** in the app's Sync panel. In one step: the DB freeze flag is set, all cron sync jobs halt, and sheet protections are removed via the Sheets API so managers and volunteers can edit the spreadsheet directly as a temporary database. If the app is completely down, the emergency `WebApp.gs` URL triggers the same protection removal independently.

**Unfreeze (recovery).** The maintainer clicks **Unfreeze** in the app's Sync panel. In one step:
1. Sheet protections are restored via the Sheets API — only authorized managers/admins can edit again
2. *(Phase 3)* Full reverse sync runs across all regions — manager edits made during the freeze are imported into the database
3. For cats where a GSheet edit wins, the conflict resolution system cancels their pending DB tasks
4. The freeze flag is cleared — cron resumes
5. The next cron cycle picks up any remaining pending tasks for cats managers didn't touch during the freeze

**Why we don't discard pending tasks during recovery.** After a crash there are two categories of cats:
- **Cat A** — manager edited it during the freeze. GSheet has a newer `last_edited_at` than the DB's `last_updated_at`. Reverse sync imports the edit and conflict resolution cancels that cat's PENDING forward sync task. Handled automatically.
- **Cat B** — manager did NOT edit it. No `last_edited_at` on the GSheet row. The DB state is authoritative and its PENDING forward sync task should still run.

Bulk-discarding all PENDING tasks would kill Cat B's valid changes — data loss. Instead, we let the existing conflict resolution (from Phase 3) selectively cancel only the tasks that were superseded by manual edits. Everything else runs normally.

---

## Phase 5 — Final Wiring

Forward sync range boundary is documented — it writes columns A through V only, explicitly avoiding the W and X timestamp columns managed by the Apps Script. Environment variable documentation is updated to include the new `CRON_SECRET`.

---

## End State

```
Every 10 minutes:
  Cloudflare Worker
    -> health check -> alert if down
    -> POST /api/cron/sync
        -> reverse sync all regions (GSheet edits -> DB)
        -> forward sync pending regions (DB changes -> GSheet)
        -> audit log entry per region

On failure / app down:
  Maintainer clicks Freeze in app UI (or hits emergency WebApp.gs URL)
    -> DB freeze flag set, cron skips all sync
    -> sheet protections removed via Sheets API (or Apps Script fallback)
    -> managers + volunteers edit GSheet directly

On recovery:
  Maintainer clicks Unfreeze in app UI
    -> sheet protections restored via Sheets API
    -> (Phase 3) reverse sync imports freeze-period edits
    -> conflict resolution cancels PENDING tasks for edited cats
    -> freeze flag cleared, cron resumes
    -> remaining PENDING tasks (untouched cats) run on next cron cycle

Authorized editors always in sync:
  Any admin/manager role change in the app
    -> syncSheetEditors() fires in background
    -> derives emails from profiles table + Supabase auth
    -> writes to _config!B1 in GSheet
```
