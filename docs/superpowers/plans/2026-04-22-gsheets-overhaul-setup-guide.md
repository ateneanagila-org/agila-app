# GSheets Sync Overhaul — Setup Guide

This guide covers everything you need to do manually after deploying the GSheets sync overhaul. Work through the sections in order — each depends on the previous.

This is a **one-time setup**. Ongoing ops (freeze/unfreeze, adding cats) need no manual steps after this.

---

## Prerequisites

Before starting:

- The overhaul code is deployed to Vercel (or you're running locally with `.env.local`)
- `.env.local` has `CATALOG_SPREADSHEET_ID` and `SERVICE_ACCOUNT_CREDENTIALS` set
- The DB has all region rows (verify with: `SELECT name FROM regions ORDER BY name`)
- The CATalog Google Spreadsheet already has one tab per region named **exactly** as the region's DB name (e.g., `GATE 3`, `ARETE`, `UNKNOWN`, etc.)

---

## 1. Add the UUID Column Header to Every Region Sheet

Col Y is the UUID column. Add a header label so it's identifiable.

1. Open the CATalog spreadsheet
2. For **every region sheet tab** (not `_config`, `For RI`, or `For FA`):
   - Click cell **Y2**
   - Type: `uuid`
3. Leave all data rows (row 3+) in col Y empty — the import script fills these

> Col Y is 0-indexed position 24 in the sheet array, 1-indexed column 25. If your sheet currently ends at col X (24 columns), you're just adding one more column.

---

## 2. Add the `_config!B2` Label Row

The app will write region names to `_config!B2`. Add a label in A2 for clarity.

1. In the spreadsheet, click the `_config` tab (unhide it if hidden: right-click any tab → **Unhide**)
2. In cell **A2**, type: `region_sheet_names`
3. Leave **B2** empty for now — the import script populates it
4. Re-hide the `_config` tab if you want

---

## 3. Update the Apps Script Files

The Apps Script files have changed significantly. You need to replace the existing content.

### 3a. Update Code.gs

1. In the spreadsheet, go to **Extensions → Apps Script**
2. Open `Code.gs`
3. **Select all content and delete it**
4. Paste the full contents of `workers/apps-script/Code.gs` from the repo
5. Click **Save**

**What changed:** `onEditInstallable` now auto-generates a UUID in col Y when a human types any value into a new data row, if col Y is still empty.

### 3b. Update Protection.gs

1. In the Apps Script editor, open `Protection.gs`
2. **Select all content and delete it**
3. Paste the full contents of `workers/apps-script/Protection.gs` from the repo
4. Click **Save**

**What changed:**
- All three protection functions (`freezeMode`, `unfreezeMode`, `setupUuidProtection`) now read region names from `_config!B2` and operate **only on region sheets** — static sheets like `For RI` and `For FA` are untouched
- New `setupUuidProtection()` function permanently locks col Y on all region sheets

---

## 4. Run the Import Script

This is the main one-time data migration. It:

1. Reads every region sheet (A3:X) from the spreadsheet
2. Creates a cat + health record + system session in the DB for each row
3. Writes a UUID back to col Y for each row (batch write)
4. Writes all region names to `_config!B2`

**Run:**

```bash
pnpm tsx scripts/import-sheets.ts
```

Expected output:
```
Starting GSheets → DB import...

[GATE 3] Importing...
  created: 47, errors: 0
[ARETE] Importing...
  created: 23, errors: 0
...
[UNKNOWN] Importing...
  created: 12, errors: 0

Done. Total created: 312, errors: 0
Syncing region sheet names to _config!B2...
Done. Run setupUuidProtection() in Apps Script to lock col Y.
```

If you see errors, check the specific row numbers in the output — usually a malformed date or an enum value that doesn't match exactly. You can re-run the script safely; `onConflictDoNothing()` prevents duplicate inserts.

> **UNKNOWN region:** The import script uses a different column layout for the UNKNOWN sheet (no name/status columns, PAWS ID in col C). Make sure your UNKNOWN sheet matches this layout before running.

---

## 5. Run setupUuidProtection() in Apps Script

Now that col Y has UUIDs in every row and `_config!B2` has region names, lock col Y permanently.

1. In the Apps Script editor, click the **Run** button dropdown → select `setupUuidProtection`
2. A permissions dialog may appear — authorize it
3. Check the **Execution log** (View → Logs) — you should see:
   ```
   UUID column (Y) protected on: GATE 3, ARETE, SDC, ...
   ```

After this, col Y cells in all region sheets will show a lock icon. Human users cannot edit them through the Sheets UI — only Apps Script and the service account can write to col Y.

---

## 6. Verify the Trigger Is Still Working

The `onEditInstallable` trigger should still be installed from the original setup. Confirm it's active and test UUID generation.

1. In the Apps Script editor → **Triggers** (clock icon in left sidebar)
2. Confirm `onEditInstallable` is listed. If it's missing:
   - Click **+ Add Trigger**
   - Function: `onEditInstallable`, Event source: From spreadsheet, Event type: On edit
   - Click **Save** and authorize

**Test UUID generation for new rows:**
1. Go to any region sheet tab
2. Find the first empty row after all data (e.g., row 50 if data ends at row 49)
3. Type anything in any cell (col A–V) in that row
4. Col Y of that row should immediately populate with a UUID like `a1b2c3d4-...`
5. Col W should get an ISO timestamp, col X your email

If col Y stays empty, check that col Y is not fully protected (the protection covers data rows, so empty rows at the bottom may not be included). Try editing again — the Apps Script writes col Y programmatically, bypassing protection.

---

## 7. Verify the Summary Sheets Exist

The forward sync generates `For RI` and `For FA` summary sheets automatically on the next sync pass. If they don't exist yet:

- Trigger a forward sync manually (via the Cloudflare Worker dashboard or wait for the next cron cycle)
- After the sync, you should see `For RI` and `For FA` tabs appear in the spreadsheet

If the tabs already exist from a previous setup, the sync will overwrite them — no action needed.

---

## 8. Seed _config!B1 (Authorized Emails)

If you haven't done this already from the original setup guide, seed the authorized editors list:

1. Open the AGILA app → **Users** page
2. Edit any Administrator or Manager profile (change role to same value and save)
3. This triggers `syncSheetEditors()` which writes manager/admin emails to `_config!B1`

---

## Ongoing Operations

### Adding a new region

When you add a new region to the DB and create a matching sheet tab:

1. Add the sheet tab named exactly as the region DB name
2. Add the `uuid` header in cell Y2
3. In the AGILA app, trigger `syncRegionSheetNames()` (or a manager/admin profile save will eventually do it via the sheet editors sync — but you can also call `syncRegionSheetNames` directly from the import script logic)
4. In Apps Script, run `setupUuidProtection()` again to protect col Y on the new tab
5. Run `unfreezeMode()` in Apps Script (or via the app's unfreeze action) to apply data range protections to the new tab

### If col Y gets corrupted on a row

If a UUID in col Y is accidentally deleted or changed (should be rare with the protection in place):

- The forward sync will rewrite the correct UUID to col Y on the next pass
- If the cat no longer exists in DB (wrong UUID entered), the reverse sync CREATE path will create a duplicate — check the sync audit log and delete the duplicate manually

### Freeze / Unfreeze

No changes from the original setup guide. `freezeMode()` and `unfreezeMode()` now only operate on region sheets — summary sheets and `_config` are untouched.
