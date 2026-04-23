/**
 * AGILA CATalog — Sheet Protection Toggle
 *
 * Run these functions manually from the Apps Script editor
 * when switching between normal operation and freeze mode.
 *
 * FREEZE: Adds authorized personnel as editors so they can edit during app failure.
 * UNFREEZE: Re-locks data range; only service account writes during normal ops.
 *
 * Authorized emails are stored dynamically in the _config sheet (B1),
 * managed by the app via the Sheets API. No need to hardcode them here.
 *
 * Region sheet names are stored in the _config sheet (B2) as a comma-separated
 * list, also managed by the app. Only sheets matching a known region name receive
 * data range and UUID protections — static sheets (For RI, For FA, etc.) are skipped.
 *
 * HOW TO DEPLOY:
 * 1. Open the CATalog spreadsheet -> Extensions > Apps Script
 * 2. Click + next to Files -> Script -> name it "Protection"
 * 3. Paste the contents of this file
 * 4. Click Save
 *
 * SETUP:
 * - Create a hidden, protected sheet tab named "_config" in the spreadsheet
 * - The app will write authorized emails as a comma-separated list to cell B1
 * - The app will write region sheet names as a comma-separated list to cell B2
 * - Run setupUuidProtection() once after initial spreadsheet setup
 *
 * USAGE:
 * - When app goes down: run freezeMode() from the Apps Script editor
 * - After app recovery and reverse sync: run unfreezeMode()
 */

/**
 * Reads authorized emails from the _config sheet (cell B1).
 * Returns an empty array if the sheet or cell doesn't exist.
 */
function getAuthorizedEmails() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName("_config");
  if (!configSheet) {
    Logger.log(
      "WARNING: _config sheet not found. No authorized emails loaded.",
    );
    return [];
  }
  var value = configSheet.getRange("B1").getValue();
  if (!value) return [];
  return String(value)
    .split(",")
    .map(function (e) {
      return e.trim();
    })
    .filter(Boolean);
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

var DATA_RANGE_NOTATION = "A3:V"; // Data range to protect/unprotect
var UUID_COL_NOTATION = "Y3:Y"; // UUID column — permanently protected, never manually editable

/**
 * FREEZE MODE: Remove data range protection so all users with sheet access can edit.
 * Call this when the app goes down — students and volunteers can now update the sheet directly.
 * Only removes protections from region sheets (read from _config!B2).
 */
function freezeMode() {
  var regionNames = getRegionSheetNames();
  if (regionNames.length === 0) {
    Logger.log("WARNING: No region names found in _config!B2. Freeze aborted.");
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  regionNames.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      Logger.log("WARNING: Sheet '" + name + "' not found — skipping.");
      return;
    }

    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    protections.forEach(function (protection) {
      var notation = protection.getRange().getA1Notation();
      if (notation.indexOf("A3") === 0) {
        protection.remove();
      }
    });
  });

  Logger.log(
    "FREEZE MODE: Data range protections removed on: " + regionNames.join(", "),
  );
}

/**
 * UNFREEZE MODE: Re-protect data range, restricting edits to managers/admins only.
 * Authorized emails are read from the _config sheet (B1), managed by the app.
 * Only re-protects region sheets (read from _config!B2).
 * Call this after app recovery and reverse sync completion.
 */
function unfreezeMode() {
  var authorizedEmails = getAuthorizedEmails();
  if (authorizedEmails.length === 0) {
    Logger.log(
      "WARNING: No authorized emails found in _config!B1. Unfreeze aborted — add manager emails via the app first.",
    );
    return;
  }

  var regionNames = getRegionSheetNames();
  if (regionNames.length === 0) {
    Logger.log(
      "WARNING: No region names found in _config!B2. Unfreeze aborted.",
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
    var range = sheet.getRange("A3:V" + lastRow);
    var protection = range
      .protect()
      .setDescription("App-managed data — edit via app only");

    // Lock down to everyone, then add back only the authorized managers/admins
    protection.removeEditors(protection.getEditors());
    protection.addEditors(authorizedEmails);

    if (protection.canDomainEdit()) {
      protection.setDomainEdit(false);
    }
  });

  Logger.log(
    "UNFREEZE MODE: Data range protected on: " +
      regionNames.join(", ") +
      ". Editors: " +
      authorizedEmails.join(", "),
  );
}

/**
 * Removes ALL Y column protections on region sheets.
 * Must be run from GAS (as the spreadsheet owner) because the service account
 * cannot delete protections it didn't create.
 * Run this ONCE, then let the app's setupUuidProtections() recreate them
 * with the service account in the editors list.
 */
function clearUuidProtections() {
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
      var notation = protection.getRange().getA1Notation();
      if (notation.indexOf("Y") === 0) {
        protection.remove();
        cleared++;
      }
    });
  });

  Logger.log("Cleared " + cleared + " Y column protection(s).");
}

/**
 * SETUP (run once): Permanently protect col Y (UUID column) on all region sheets.
 * No one should manually edit UUIDs — they are assigned by Apps Script (new rows)
 * or by the service account (forward sync). Script-level writes bypass this protection.
 *
 * Region sheets are read from _config!B2. Run this once after initial spreadsheet
 * setup, or after adding a new region sheet.
 */
function setupUuidProtection() {
  var regionNames = getRegionSheetNames();
  if (regionNames.length === 0) {
    Logger.log(
      "WARNING: No region names found in _config!B2. UUID protection aborted.",
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
    var range = sheet.getRange("Y3:Y" + lastRow);
    var protection = range
      .protect()
      .setDescription("UUID column — do not edit manually");

    // Remove all editors so no human can change UUIDs through the UI.
    // Scripts and the service account bypass protection and can still write.
    protection.removeEditors(protection.getEditors());
    if (protection.canDomainEdit()) {
      protection.setDomainEdit(false);
    }
  });

  Logger.log("UUID column (Y) protected on: " + regionNames.join(", "));
}
