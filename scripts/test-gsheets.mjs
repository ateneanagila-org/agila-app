// THIS QUICKLY TESTS CONNECTION TO GSHEETS
// Run node scripts/test-gsheets.mjs from the root level

import { config } from "dotenv";
import { google } from "googleapis";

config();

const creds = JSON.parse(process.env.SERVICE_ACCOUNT_CREDENTIALS);
const privateKey = creds.private_key.replace(/\\n/g, "\n");

const auth = new google.auth.GoogleAuth({
  credentials: { ...creds, private_key: privateKey },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

console.log("Testing GSheets connection...");
console.log("Service account:", creds.client_email);
console.log("Spreadsheet ID:", process.env.CATALOG_SPREADSHEET_ID);

try {
  const res = await sheets.spreadsheets.get({
    spreadsheetId: process.env.CATALOG_SPREADSHEET_ID,
  });
  console.log("\n✓ Connected!");
  console.log("Title:", res.data.properties.title);
  console.log(
    "Sheets:",
    res.data.sheets.map((s) => s.properties.title).join(", "),
  );
} catch (e) {
  console.error("\n✗ Failed:", e.message);
  if (e.code) console.error("Code:", e.code);
  process.exit(1);
}
