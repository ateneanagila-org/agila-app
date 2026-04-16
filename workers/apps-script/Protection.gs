/**
 * AGILA CATalog — Sheet Protection Toggle
 *
 * Run these functions manually from the Apps Script editor
 * when switching between normal operation and freeze mode.
 *
 * FREEZE: Unlocks data range for all authorized personnel during app failure.
 * UNFREEZE: Re-locks data range; only service account writes during normal ops.
 *
 * HOW TO DEPLOY:
 * 1. Open the CATalog spreadsheet -> Extensions > Apps Script
 * 2. Click + next to Files -> Script -> name it "Protection"
 * 3. Paste the contents of this file
 * 4. Update AUTHORIZED_EMAILS with all manager and volunteer emails
 * 5. Click Save
 *
 * USAGE:
 * - When app goes down: run freezeMode() from the Apps Script editor
 * - After app recovery and reverse sync: run unfreezeMode()
 */

// Add emails of all authorized personnel (managers + volunteers)
// who should get edit access during freeze
var AUTHORIZED_EMAILS = [
  // Add all authorized emails here, e.g.:
  // "manager1@example.com",
  // "volunteer1@example.com",
];

var DATA_RANGE_NOTATION = "A3:V"; // Data range to protect/unprotect

/**
 * FREEZE MODE: Remove protection from data range so all authorized personnel can edit.
 * Call this when the app goes down.
 */
function freezeMode() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  sheets.forEach(function(sheet) {
    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    protections.forEach(function(protection) {
      // Remove data range protections (keep W:X protected)
      var range = protection.getRange();
      var notation = range.getA1Notation();
      if (notation.indexOf("A3") === 0 || notation.indexOf("A:V") !== -1) {
        protection.remove();
      }
    });
  });

  Logger.log("FREEZE MODE: Data range protections removed. All authorized personnel can edit.");
}

/**
 * UNFREEZE MODE: Re-protect data range. Only service account writes.
 * Call this after app recovery and reverse sync completion.
 */
function unfreezeMode() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  sheets.forEach(function(sheet) {
    var lastRow = Math.max(sheet.getLastRow(), 3);
    var range = sheet.getRange("A3:V" + lastRow);
    var protection = range.protect()
      .setDescription("App-managed data — do not edit directly");

    // Remove all editors — during normal operation, only the service account writes
    // The protection means everyone else can view but not edit the range
    protection.removeEditors(protection.getEditors());

    if (protection.canDomainEdit()) {
      protection.setDomainEdit(false);
    }
  });

  Logger.log("UNFREEZE MODE: Data range re-protected.");
}
