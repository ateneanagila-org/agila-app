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
*Getting the sheets ready for reverse sync*

**Add hidden timestamp columns.** Two new columns (W and X) are added to every regional sheet tab: `last_edited_at` and `edited_by`. These are invisible to managers in normal use and are protected so only the Apps Script can write to them.

**Deploy a Google Apps Script trigger.** An `onEdit` trigger that fires whenever anyone manually edits a cell in the data range. It records the exact timestamp and the editor's email in columns W and X. Crucially, it ignores edits made by the service account (our sync system) to prevent feedback loops.

**Configure sheet protection.** The data range (columns A-V) is protected so volunteers can't accidentally edit it. Managers have emergency edit access. Columns W and X are always locked — only the Apps Script writes there.

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

**Freeze.** When the maintainer flips the freeze flag, all cron sync jobs halt (both forward and reverse). The maintainer then manually runs the `freezeMode()` script in Google Sheets to unlock the data range for managers. Managers can now edit the sheets directly as a temporary database.

**Unfreeze (recovery).** When the app is fixed:
1. Full reverse sync runs across all regions — manager edits made during the freeze are imported into the database
2. For cats where a GSheet edit wins, the corresponding pending DB tasks are cancelled by the conflict resolution system (the GSheet version is newer, so the stale DB change is superseded)
3. The freeze flag is cleared — cron resumes
4. The next cron cycle picks up any remaining pending tasks — these are cats that managers **didn't touch** during the freeze, so their DB changes are still valid and need to push out to the sheet
5. The maintainer runs `unfreezeMode()` in Apps Script to re-lock the sheets

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
  Maintainer flips freeze flag
    -> cron skips all sync
    -> freezeMode() unlocks GSheets for managers
    -> managers edit GSheet directly

On recovery:
  Maintainer calls unfreezeSync()
    -> reverse sync imports freeze-period edits
    -> conflict resolution cancels PENDING tasks for edited cats
    -> freeze flag cleared, cron resumes
    -> remaining PENDING tasks (untouched cats) run on next cron cycle
    -> unfreezeMode() re-locks GSheets
```
