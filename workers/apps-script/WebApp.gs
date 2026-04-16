/**
 * AGILA CATalog — Emergency Freeze/Unfreeze Web App
 *
 * Deployed as an Apps Script Web App so freeze/unfreeze can be triggered
 * from a browser URL (phone, laptop) when the main app is unreachable.
 *
 * HOW TO DEPLOY:
 * 1. In the Apps Script editor, go to Deploy > New deployment
 * 2. Type: Web app
 * 3. Execute as: Me
 * 4. Who has access: Only myself (or "Anyone with the link" if you trust the secret alone)
 * 5. Click Deploy and copy the web app URL — bookmark it
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
