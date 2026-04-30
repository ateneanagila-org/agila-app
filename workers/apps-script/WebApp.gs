/**
 * AGILA CATalog — Emergency Freeze/Unfreeze Web App
 *
 * Deployed as an Apps Script Web App so freeze/unfreeze can be triggered
 * from a browser URL (phone, laptop) when the main app is unreachable.
 *
 * HOW TO ADD THIS FILE:
 * 1. Open the CATalog spreadsheet → Extensions > Apps Script
 * 2. Click + next to Files in the left sidebar → Script
 * 3. Name it "WebApp" (it becomes WebApp.gs)
 * 4. Paste the contents of this file, click Save
 *
 * HOW TO DEPLOY AS A WEB APP:
 * 1. In the Apps Script editor, go to Deploy > New deployment
 * 2. Click the gear icon next to "Select type" → Web app
 * 3. Execute as: Me
 * 4. Who has access: Only myself (or "Anyone with the link" if you trust the secret alone)
 * 5. Click Deploy, authorize if prompted, then copy the web app URL — bookmark it
 *
 * HOW TO SET THE SECRET:
 * 1. In the Apps Script editor, go to Project Settings (gear icon)
 * 2. Script Properties > Add property
 *    Name: EMERGENCY_SECRET
 *    Value: a strong random string (generate with: openssl rand -hex 16)
 * 3. Save
 *
 * USAGE (bookmark these URLs):
 *   Freeze:   https://script.google.com/.../exec?action=freeze&secret=YOUR_SECRET
 *   Unfreeze: https://script.google.com/.../exec?action=unfreeze&secret=YOUR_SECRET
 *   Status:   https://script.google.com/.../exec?action=status&secret=YOUR_SECRET
 */

/**
 * Photo import endpoint — called by the Node.js photo-import service.
 *
 * Accepts a POST with JSON body: { secret: string, uuids: string[] }
 * Returns JSON: { photos: Array<{ uuid: string, base64: string }> }
 *
 * For each UUID, scans all region sheets for the matching row (col Y),
 * reads the in-cell image from col B via getCellImage(), fetches the bytes
 * via UrlFetchApp, and returns them as base64.
 *
 * HOW TO SET THE SECRET:
 * 1. In Apps Script editor → Project Settings (gear icon) → Script Properties
 * 2. Add property: PHOTO_IMPORT_SECRET = <same value as PHOTO_WEBAPP_SECRET in .env>
 *
 * HOW TO REDEPLOY after editing:
 * 1. Deploy > Manage deployments > edit the existing web app deployment > Deploy
 * 2. No new URL needed — same /exec URL.
 */
function doPost(e) {
  try {
    return _doPostImpl(e);
  } catch (err) {
    return jsonOut({ error: "Uncaught: " + (err.message || String(err)) });
  }
}

function _doPostImpl(e) {
  var props = PropertiesService.getScriptProperties();
  var storedSecret = props.getProperty("PHOTO_IMPORT_SECRET");

  if (!e || !e.postData || !e.postData.contents) {
    return jsonOut({ error: "No POST body received" });
  }

  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ error: "Invalid JSON: " + err.message });
  }

  if (!storedSecret || data.secret !== storedSecret) {
    return jsonOut({ error: "Unauthorized" });
  }

  var uuids = data.uuids;
  if (!Array.isArray(uuids) || uuids.length === 0) {
    return jsonOut({ photos: [] });
  }

  // Build a lookup set for O(1) membership checks
  var targetSet = {};
  for (var i = 0; i < uuids.length; i++) {
    targetSet[uuids[i]] = true;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName("_config");
  if (!configSheet) return jsonOut({ error: "_config sheet not found" });

  var regionNamesRaw = configSheet.getRange("B2").getValue();
  if (!regionNamesRaw) return jsonOut({ photos: [] });

  var regionNames = String(regionNamesRaw)
    .split(",")
    .map(function (n) { return n.trim(); })
    .filter(Boolean);

  var photos = [];
  var diagnostics = []; // capture info for first non-image cell to help debug
  var remaining = uuids.length;

  for (var r = 0; r < regionNames.length; r++) {
    if (remaining <= 0) break;

    var sheet = ss.getSheetByName(regionNames[r]);
    if (!sheet) continue;

    var lastRow = sheet.getLastRow();
    if (lastRow < 3) continue;

    // Read col Y (UUID) values in one batch call
    var numRows = lastRow - 2;
    var uuidValues = sheet.getRange(3, 25, numRows, 1).getValues(); // col Y = 25

    for (var i = 0; i < uuidValues.length; i++) {
      var uuid = String(uuidValues[i][0]).trim();
      if (!targetSet[uuid]) continue;

      var rowNum = i + 3; // data starts at row 3
      var photoCell = sheet.getRange(rowNum, 2); // col B = 2

      // In-cell images: getValue() returns a CellImage object directly.
      // Regular text cells return a string.
      var cellValue = photoCell.getValue();

      // Detect a CellImage by duck-typing — has getContentUrl/getUrl method.
      if (!cellValue || typeof cellValue !== "object") {
        if (diagnostics.length < 3) {
          diagnostics.push({
            uuid: uuid,
            sheet: regionNames[r],
            row: rowNum,
            valueType: typeof cellValue,
            valueStr: String(cellValue).substring(0, 100),
          });
        }
        continue;
      }

      var contentUrl = null;
      try {
        if (typeof cellValue.getContentUrl === "function") {
          contentUrl = cellValue.getContentUrl();
        } else if (typeof cellValue.getUrl === "function") {
          contentUrl = cellValue.getUrl();
        } else {
          if (diagnostics.length < 3) {
            var keys = [];
            for (var k in cellValue) keys.push(k);
            diagnostics.push({
              uuid: uuid,
              sheet: regionNames[r],
              row: rowNum,
              valueType: "object",
              constructor: cellValue.constructor ? cellValue.constructor.name : "?",
              keys: keys.slice(0, 20),
              str: String(cellValue).substring(0, 200),
            });
          }
          continue;
        }
      } catch (err) {
        Logger.log("Error getting content URL for UUID " + uuid + ": " + err.message);
        continue;
      }

      if (!contentUrl) continue;

      try {
        var fetchResponse = UrlFetchApp.fetch(contentUrl, { muteHttpExceptions: true });
        if (fetchResponse.getResponseCode() !== 200) {
          Logger.log("Non-200 fetching image for UUID " + uuid + ": " + fetchResponse.getResponseCode());
          continue;
        }
        var base64 = Utilities.base64Encode(fetchResponse.getContent());
        photos.push({ uuid: uuid, base64: base64 });
        delete targetSet[uuid];
        remaining--;
      } catch (err) {
        Logger.log("Error fetching image for UUID " + uuid + ": " + err.message);
      }
    }
  }

  Logger.log("PhotoImport: requested=" + uuids.length + " found=" + photos.length);
  return jsonOut({ photos: photos, diagnostics: diagnostics });
}

function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var secret = e.parameter.secret;
  var action = e.parameter.action;

  var storedSecret = PropertiesService.getScriptProperties()
    .getProperty("EMERGENCY_SECRET");

  if (!storedSecret || secret !== storedSecret) {
    return ContentService
      .createTextOutput("Unauthorized")
      .setMimeType(ContentService.MimeType.TEXT);
  }

  if (action === "freeze") {
    freezeMode();
    return ContentService
      .createTextOutput("OK: freeze mode activated. Sheet protections removed.")
      .setMimeType(ContentService.MimeType.TEXT);
  }

  if (action === "unfreeze") {
    unfreezeMode();
    return ContentService
      .createTextOutput("OK: unfreeze mode activated. Sheet protections restored.")
      .setMimeType(ContentService.MimeType.TEXT);
  }

  if (action === "status") {
    var emails = getAuthorizedEmails();
    return ContentService
      .createTextOutput("OK: " + emails.length + " authorized editor(s) in _config.")
      .setMimeType(ContentService.MimeType.TEXT);
  }

  return ContentService
    .createTextOutput("Invalid action. Use ?action=freeze|unfreeze|status&secret=...")
    .setMimeType(ContentService.MimeType.TEXT);
}
