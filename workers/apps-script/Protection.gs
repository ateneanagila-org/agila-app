/**
 * AGILA CATalog — System Column Protection
 *
 * Permanently protects the system-managed columns (A, W, X, Y) on all region sheets:
 *   A — catalog number (assigned by the system; never manually typed)
 *   W — edited_at timestamp (written by the onEdit trigger)
 *   X — editor email (written by the onEdit trigger)
 *   Y — UUID (assigned on first human edit; used as the DB catalog ID)
 *
 * Volunteers can freely edit all data columns (B–V). The system columns are
 * off-limits to humans — script-level writes bypass the protection automatically.
 *
 * Region sheet names are stored in _config!B2 as a comma-separated list,
 * managed by the app via the Sheets API. Static sheets (For RI, For FA, etc.)
 * are skipped.
 *
 * HOW TO DEPLOY:
 * 1. Open the CATalog spreadsheet -> Extensions > Apps Script
 * 2. Click + next to Files -> Script -> name it "Protection"
 * 3. Paste the contents of this file
 * 4. Click Save
 *
 * SETUP:
 * - Create a hidden, protected sheet tab named "_config" in the spreadsheet
 * - Run setupRegionSheets() once after initial setup, AND after adding any new
 *   region sheet. It is the single entry point — see USAGE below.
 *
 * SOURCE OF TRUTH: region names live in the app DB `regions` table (constrained
 * by the REGION_NAME_VALUES enum). The app mirrors that list into _config!B2 on
 * region create/delete (syncRegionSheetNames). Apps Script only READS B2 — it
 * never derives region names from tab titles, so a stray/typo'd tab can't become
 * a "region" and corrupt the sync.
 *
 * USAGE (manual, run from Apps Script editor only):
 * - setupRegionSheets()  — RECOMMENDED. Idempotent one-shot: reads the region
 *     list from _config!B2, warns on any tab/list mismatch, ensures the W/X/Y
 *     header labels, and (re)applies the A + W–Y protections. Run after creating
 *     a new region tab. PRECONDITION: the region already exists in the app and
 *     B2 is populated (the app writes B2 from the DB).
 * - setupSystemColProtection() / clearSystemColProtections() — lower-level
 *     protection-only helpers, kept for manual control.
 *
 * STATIC_TABS below lists non-region tabs to ignore in the mismatch check.
 */

// Non-region tabs to ignore when cross-checking tabs against the B2 region list.
// UNKNOWN is intentionally NOT here — it is a synced region sheet with UUIDs.
var STATIC_TABS = ["_config", "For RI", "For FA"];

/**
 * Consistency check (warns only, never acts). The region list is owned by the
 * app DB and mirrored to _config!B2 — this never derives names from tabs. It
 * just surfaces drift between the actual tabs and B2 so a typo'd or missing tab
 * is caught before it silently breaks sync.
 */
function warnTabMismatch(names) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var skip = {};
  STATIC_TABS.forEach(function (n) {
    skip[n] = true;
  });
  var tabs = ss
    .getSheets()
    .map(function (s) {
      return s.getName();
    })
    .filter(function (n) {
      return !skip[n];
    });

  var inList = {};
  names.forEach(function (n) {
    inList[n] = true;
  });
  var inTabs = {};
  tabs.forEach(function (n) {
    inTabs[n] = true;
  });

  tabs.forEach(function (t) {
    if (!inList[t]) {
      Logger.log(
        "WARN: tab '" +
          t +
          "' is not in _config!B2 — skipped. Fix the tab name to match a region, or add the region in the app first.",
      );
    }
  });
  names.forEach(function (n) {
    if (!inTabs[n]) {
      Logger.log("WARN: region '" + n + "' has no matching sheet tab yet.");
    }
  });
}

/**
 * Ensures the system-column header labels exist on each region sheet (row 2;
 * data starts row 3). Idempotent — overwrites with the same values each run.
 *   W2 = last_edited_at, X2 = edited_by, Y2 = uuid
 */
function ensureSystemHeaders(names) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  names.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    sheet.getRange("W2").setValue("last_edited_at");
    sheet.getRange("X2").setValue("edited_by");
    sheet.getRange("Y2").setValue("uuid");
  });
}

/**
 * ONE-SHOT region setup (run from the Apps Script editor). Idempotent — safe to
 * re-run after adding a new region tab. Steps:
 *   1. Read the region list from _config!B2 (app-owned mirror of the DB)
 *   2. Warn on any tab/list mismatch (does not act on it)
 *   3. Ensure W/X/Y header labels
 *   4. Clear then (re)apply the A + W–Y protections
 *
 * PRECONDITION: the region already exists in the app and B2 is populated (the
 * app writes B2 from the DB via syncRegionSheetNames). If B2 is empty, add the
 * region in the app first, then re-run.
 *
 * The onEdit trigger (Code.gs) is column-index based, so new tabs are already
 * covered for W/X/Y timestamping — no per-tab trigger setup needed.
 */
function setupRegionSheets() {
  var names = getRegionSheetNames();
  if (names.length === 0) {
    Logger.log(
      "_config!B2 is empty. Add the region in the app first (it writes the DB region list to B2), then re-run.",
    );
    return;
  }

  warnTabMismatch(names);
  ensureSystemHeaders(names);

  // Clear first so re-runs don't stack duplicate protection objects.
  clearSystemColProtections();
  setupSystemColProtection();

  Logger.log("setupRegionSheets complete for: " + names.join(", "));
}

/**
 * Reads region sheet names from the _config sheet (cell B2).
 * The app writes region names here so protections apply only to region data sheets.
 * Returns an empty array if the sheet or cell doesn't exist.
 */
function getRegionSheetNames() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName("_config");
  if (!configSheet) {
    Logger.log("WARNING: _config sheet not found. No region names loaded.");
    return [];
  }
  var value = configSheet.getRange("B2").getValue();
  if (!value) return [];
  return String(value)
    .split(",")
    .map(function (n) {
      return n.trim();
    })
    .filter(Boolean);
}

// System columns that must never be manually edited
var CATALOG_COL_NOTATION = "A3:A"; // catalog number (A) — assigned by system
var SYSTEM_COLS_NOTATION = "W3:Y"; // edited_at (W), editor email (X), UUID (Y)

/**
 * Removes all W:Y system column protections on region sheets.
 * Must be run from GAS (as the spreadsheet owner) because the service account
 * cannot delete protections it didn't create.
 * Run this before setupSystemColProtection() to reset cleanly.
 */
function clearSystemColProtections() {
  var regionNames = getRegionSheetNames();
  if (regionNames.length === 0) {
    Logger.log("WARNING: No region names found in _config!B2. Clear aborted.");
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cleared = 0;

  regionNames.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;

    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    protections.forEach(function (protection) {
      var col = protection.getRange().getColumn();
      // Column A (1) and columns W (23), X (24), Y (25)
      if (col === 1 || (col >= 23 && col <= 25)) {
        protection.remove();
        cleared++;
      }
    });
  });

  Logger.log("Cleared " + cleared + " system column protection(s).");
}

/**
 * SETUP (run once): Permanently protect cols A and W–Y on all region sheets.
 *   A — catalog number, assigned by the system on each cron tick
 *   W–Y — edited_at, editor email, UUID (managed by trigger + service account)
 * No human should manually edit these. Script-level writes bypass protection.
 *
 * Region sheets are read from _config!B2. Run after initial setup or after adding a new region sheet.
 */
function setupSystemColProtection() {
  var regionNames = getRegionSheetNames();
  if (regionNames.length === 0) {
    Logger.log(
      "WARNING: No region names found in _config!B2. System column protection aborted.",
    );
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  regionNames.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      Logger.log("WARNING: Sheet '" + name + "' not found — skipping.");
      return;
    }

    var lastRow = Math.max(sheet.getLastRow(), 3);

    // Protect col A (catalog number)
    var colARange = sheet.getRange("A3:A" + lastRow);
    var colAProtection = colARange
      .protect()
      .setDescription("Catalog number (A) — assigned by system, do not edit manually");
    colAProtection.removeEditors(colAProtection.getEditors());
    if (colAProtection.canDomainEdit()) {
      colAProtection.setDomainEdit(false);
    }

    // Protect cols W–Y (system metadata)
    var sysRange = sheet.getRange("W3:Y" + lastRow);
    var sysProtection = sysRange
      .protect()
      .setDescription("System columns (edited_at, editor, UUID) — do not edit manually");
    sysProtection.removeEditors(sysProtection.getEditors());
    if (sysProtection.canDomainEdit()) {
      sysProtection.setDomainEdit(false);
    }
  });

  Logger.log("System columns (A, W–Y) protected on: " + regionNames.join(", "));
}
