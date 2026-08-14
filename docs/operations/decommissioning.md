# Retiring the Sheets sync

This is a one-way trip. Read it fully before starting.

Retiring stops the app writing to the CATalog spreadsheet, permanently. The app
keeps working on its own database; the spreadsheet becomes a hand-edited
document that nothing overwrites. The two stop being connected.

**There is no undo in the app.** A developer with database access can delete the
`sync_retired` row from `system_config`, but no steward-facing control does.

## Before you start

- Confirm the org actually intends to stop using the app as the source of truth.
  After retiring, edits made in the app never reach the spreadsheet and edits
  made in the spreadsheet never reach the app.
- Note that photos in the sheet are `=IMAGE()` formulas pointing at the app's
  storage. **They keep working only while the app lives.** If the app is later
  shut down entirely, every photo in every sheet breaks silently.

## 1. Retire the sync (in the app)

Admin → GSheet Config → **Retire sync…** → type `RETIRE` → confirm.

This writes the retirement flag and then removes the column protections on
A and W–Y of every region sheet, so stewards can edit those columns by hand.

The flag is written *first*, so retirement still succeeds if the spreadsheet is
already unreachable. If you see "Sync retired, but the spreadsheet could not be
updated", the retirement worked but the protections are still in place —
remove them by hand: open each region sheet → Data → Protected sheets and
ranges → delete the entries for column A and columns W–Y.

## 2. Stop the cron worker (Cloudflare)

The app cannot do this — a Cloudflare `scheduled()` handler has no way to
disable its own trigger.

Either edit `workers/sync-cron/wrangler.toml`, remove the `[triggers]` block,
and redeploy with `wrangler deploy`; or disable the trigger in the Cloudflare
dashboard under Workers → `agila-sync-cron` → Settings → Triggers.

**Do not skip this.** A retired app answers each tick immediately and does no
work, so the cost is small — but if the app is ever deleted while the worker
survives, the worker posts **"App unreachable" to Discord every 20 minutes,
forever**, at a webhook nobody owns any more.

## 3. Remove the Apps Script triggers (spreadsheet)

Open the CATalog spreadsheet → Extensions → Apps Script → Triggers (clock
icon) → delete the `onEditInstallable` and `onSheetChange` triggers.

`onEditInstallable` only stamps the edit-timestamp columns — harmless once nothing reads
them. (It is named `onEditInstallable` rather than `onEdit` because Apps Script
reserves the bare name for simple triggers, which cannot use the Sheets API.)
`onSheetChange` is the reason this step matters: it banners hand-made tabs
with text reading *"To add a REGION, use the app (Admin > Edit Regions)"*. After
retirement that advice is wrong. Stewards may legitimately add tabs by hand, and
would get a red warning pointing them at an app that no longer syncs.

## 4. Confirm

- Edit a cell in a region sheet, wait 20 minutes, confirm nothing overwrites it.
- Confirm the Admin screen shows **Retired** and no longer offers Unfreeze.
- Confirm columns A and W–Y are editable by hand in a region sheet.

## What is NOT affected

- The app itself keeps running and stays fully editable.
- Photos, sessions, the public adoption catalog and sign-in all continue to work.
- The Photo Storage gauge keeps reporting. Automatic orphan cleanup stops with
  the cron, so use Admin → GSheet Config → **Reclaim orphaned photos** manually
  if the gauge climbs.
