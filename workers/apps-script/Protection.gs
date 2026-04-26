/**
 * AGILA CATalog — System Column Protection
 *
 * Permanently protects the system-managed columns (W, X, Y) on all region sheets:
 *   W — edited_at timestamp (written by the onEdit trigger)
 *   X — editor email (written by the onEdit trigger)
 *   Y — UUID (assigned on first human edit; used as the DB catalog ID)
 *
 * Volunteers can freely edit all data columns (A–V). The system columns are
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
 * - The app will write region sheet names as a comma-separated list to cell B2
 * - Run setupSystemColProtection() once after initial spreadsheet setup,
 *   or after adding a new region sheet
 *
 * USAGE (manual, run from Apps Script editor only):
 * - Run clearSystemColProtections() then setupSystemColProtection() to reset protections
 */

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
      // Columns W (23), X (24), Y (25)
      if (col >= 23 && col <= 25) {
        protection.remove();
        cleared++;
      }
    });
  });

  Logger.log("Cleared " + cleared + " system column protection(s).");
}

/**
 * SETUP (run once): Permanently protect cols W–Y (edited_at, editor, UUID) on all region sheets.
 * No one should manually edit these — they are written by the onEdit trigger and the service account.
 * Script-level writes bypass this protection automatically.
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
    var range = sheet.getRange("W3:Y" + lastRow);
    var protection = range
      .protect()
      .setDescription("System columns (edited_at, editor, UUID) — do not edit manually");

    // Remove all editors so no human can change these through the UI.
    // Scripts and the service account bypass protection and can still write.
    protection.removeEditors(protection.getEditors());
    if (protection.canDomainEdit()) {
      protection.setDomainEdit(false);
    }
  });

  Logger.log("System columns (W–Y) protected on: " + regionNames.join(", "));
}
