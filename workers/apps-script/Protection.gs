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
 * HOW TO DEPLOY:
 * 1. Open the CATalog spreadsheet -> Extensions > Apps Script
 * 2. Click + next to Files -> Script -> name it "Protection"
 * 3. Paste the contents of this file
 * 4. Click Save
 *
 * SETUP:
 * - Create a hidden, protected sheet tab named "_config" in the spreadsheet
 * - The app will write authorized emails as a comma-separated list to cell B1
 * - You can also set the initial list from the app's admin settings
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
    Logger.log("WARNING: _config sheet not found. No authorized emails loaded.");
    return [];
  }
  var value = configSheet.getRange("B1").getValue();
  if (!value) return [];
  return String(value).split(",").map(function(e) { return e.trim(); }).filter(Boolean);
}

var DATA_RANGE_NOTATION = "A3:V"; // Data range to protect/unprotect

/**
 * FREEZE MODE: Remove data range protection so all users with sheet access can edit.
 * Call this when the app goes down — students and volunteers can now update the sheet directly.
 */
function freezeMode() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  sheets.forEach(function(sheet) {
    if (sheet.getName() === "_config") return;

    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    protections.forEach(function(protection) {
      var notation = protection.getRange().getA1Notation();
      if (notation.indexOf("A3") === 0) {
        protection.remove();
      }
    });
  });

  Logger.log("FREEZE MODE: Data range protections removed. All sheet users can now edit.");
}

/**
 * UNFREEZE MODE: Re-protect data range, restricting edits to managers/admins only.
 * Authorized emails are read from the _config sheet (B1), managed by the app.
 * Call this after app recovery and reverse sync completion.
 */
function unfreezeMode() {
  var authorizedEmails = getAuthorizedEmails();
  if (authorizedEmails.length === 0) {
    Logger.log("WARNING: No authorized emails found in _config!B1. Unfreeze aborted — add manager emails via the app first.");
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  sheets.forEach(function(sheet) {
    if (sheet.getName() === "_config") return;

    var lastRow = Math.max(sheet.getLastRow(), 3);
    var range = sheet.getRange("A3:V" + lastRow);
    var protection = range.protect()
      .setDescription("App-managed data — edit via app only");

    // Lock down to everyone, then add back only the authorized managers/admins
    protection.removeEditors(protection.getEditors());
    protection.addEditors(authorizedEmails);

    if (protection.canDomainEdit()) {
      protection.setDomainEdit(false);
    }
  });

  Logger.log("UNFREEZE MODE: Data range protected. Editors: " + authorizedEmails.join(", "));
}
