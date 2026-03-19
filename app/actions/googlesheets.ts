"use server";
import { google } from "googleapis";

export async function getSheetData() {
  const { glSheets } = await connectToSheets();
  const data = await glSheets.spreadsheets.values.get({
    spreadsheetId: process.env.CATALOG_SPREADSHEET_ID,
    range: "'test'!A:A",
  });

  return { data: data.data.values };
}

export async function uploadSheetData() {
  const { glAuth, glSheets } = await connectToSheets();
  const response = await glSheets.spreadsheets.values.append({
    auth: glAuth,
    spreadsheetId: process.env.CATALOG_SPREADSHEET_ID,
    range: "A1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        ["YOUR_DATA", "YOUR_DATA", "YOUR_DATA"],
        ["YOUR_DATA", "YOUR_DATA", "YOUR_DATA"],
      ],
    },
  });
  return response;
}

async function connectToSheets() {
  const serviceAccountCredentialsString =
    process.env.SERVICE_ACCOUNT_CREDENTIALS!;
  const serviceAccountCredentials = JSON.parse(serviceAccountCredentialsString);
  const privateKey = serviceAccountCredentials.private_key.replace(
    /\\n/g,
    "\n",
  );

  const glAuth = new google.auth.GoogleAuth({
    credentials: {
      ...serviceAccountCredentials,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const glSheets = google.sheets({ version: "v4", auth: glAuth });

  return { glAuth, glSheets };
}
