"use server";
import { google } from "googleapis";

export async function getSheetData() {
  const glAuth = await google.auth.getClient({
    projectId: "YOUR_PROJECT_ID",
    credentials: {
      type: "service_account",
      project_id: "YOUR_PROJECT_ID",
      private_key_id: "YOUR_PRIVATE_KEY_ID",
      private_key: "YOUR_PRIVATE_KEY",
      client_email: "YOUR_CLIENT_EMAIL",
      universe_domain: "googleapis.com",
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const glSheets = google.sheets({ version: "v4", auth: glAuth });

  const data = await glSheets.spreadsheets.values.get({
    spreadsheetId: "SHEET_ID",
    range: "RANGE",
  });

  return { data: data.data.values };
}
