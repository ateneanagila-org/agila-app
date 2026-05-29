/**
 * AGILA CATalog — Auto-timestamp, editor tracking, and UUID generation on manual edit
 *
 * Installed as an "installable trigger" (not a simple trigger)
 * so that Session.getActiveUser() returns the editor's email.
 *
 * Writes to:
 *   Column W (index 23): ISO 8601 timestamp of last edit
 *   Column X (index 24): Email of the editor
 *   Column Y (index 25): Auto-generated UUID — on the first human edit that places
 *                        a real value in the row, if col Y is still empty
 *
 * Only triggers for edits in the data range (columns A-V, rows 3+).
 * Does NOT trigger for edits by the service account (prevents loops).
 * Col Y is protected separately (see Protection.gs setupUuidProtection).
 * Script-level writes bypass sheet protection, so UUID generation still works.
 *
 * HOW TO DEPLOY:
 * 1. Open the CATalog spreadsheet in Google Sheets
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing Code.gs content and paste this file
 * 4. Click Save
 * 5. Go to Triggers (clock icon in left sidebar)
 * 6. Click + Add Trigger
 *    - Function: onEditInstallable
 *    - Event source: From spreadsheet
 *    - Event type: On edit
 *    - Failure notification: Notify daily
 * 7. Click Save and authorize when prompted
 * 8. Run Protection.gs > setupUuidProtection() once to lock col Y
 */

var SERVICE_ACCOUNT_EMAIL = "catalog-gsheets-service@agila-catalog-app.iam.gserviceaccount.com";
var TIMESTAMP_COL = 23; // Column W (1-indexed)
var EDITOR_COL = 24;    // Column X (1-indexed)
var UUID_COL = 25;      // Column Y (1-indexed)
var DATA_START_ROW = 3;
var DATA_END_COL = 22;  // Column V (1-indexed)

function onEditInstallable(e) {
  if (!e || !e.range) return;

  var sheet = e.range.getSheet();
  var row = e.range.getRow();
  var col = e.range.getColumn();

  // Ignore edits outside the data range
  if (row < DATA_START_ROW) return;
  if (col > DATA_END_COL) return;

  // Ignore edits by the service account (forward sync writes)
  var editor = "";
  try {
    var user = Session.getActiveUser();
    editor = user ? user.getEmail() : "unknown";
  } catch (err) {
    editor = "unknown";
  }

  if (editor === SERVICE_ACCOUNT_EMAIL) return;

  // Generate UUID on the first human edit that puts real data in the row.
  // Checking the edited cell's value (not col A) so this fires naturally when
  // a volunteer types anything — col A is catalog number, assigned by the system.
  // The reverse sync CREATE path uses this UUID as the DB cat ID directly.
  var editedValue = e.range.getValue();
  var colYValue = sheet.getRange(row, UUID_COL).getValue();
  if (editedValue && !colYValue) {
    sheet.getRange(row, UUID_COL).setValue(Utilities.getUuid());
  }

  // Write timestamp and editor
  sheet.getRange(row, TIMESTAMP_COL).setValue(new Date().toISOString());
  sheet.getRange(row, EDITOR_COL).setValue(editor);
}
