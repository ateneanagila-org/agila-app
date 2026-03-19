"use server";
import { google } from "googleapis";
import { InsertCat } from "../validation/cats";
import { db, DB } from "../db";
import { InsertSession } from "../validation/sessions";
import { catHealthRecords, regions } from "../db/schema";
import { eq } from "drizzle-orm";
import { AppError } from "../error/app-error";

export async function insertCatToSheet(
  catData: InsertCat,
  sessionData: InsertSession,
  client: DB = db,
) {
  const region = await client.query.regions.findFirst({
    where: eq(regions.id, sessionData.region_id),
  });

  //   Var validators
  if (!region) throw new AppError("Region not found");
  if (!catData.id) {
    throw new AppError("Cannot insert cat to sheet with Invalid ID");
  }

  const catHealthRecord = await client.query.catHealthRecords.findFirst({
    where: eq(catHealthRecords.id, catData.id),
  });

  const newCatRow = [
    catData.id,
    catData.photo_url ? `=IMAGE("${catData.photo_url}")` : "N/A",
    catData.name || "N/A",
    catData.color,
    catData.age,
    catData.sex || "???",
    catHealthRecord?.neuter_date ? "YES" : "NO",
    catData.sociability || "???",
    catHealthRecord?.condition?.includes("Sick") ? "YES" : "NO",
    catHealthRecord?.condition?.includes("Injured") ? "YES" : "NO",
    catData.is_adoptable ? "YES" : "NO",
    catData.cat_status || "None of the above",
    catData.caretaker || "N/A",
    sessionData.last_updated_at,
    catData.spot_last_seen || "N/A",
    catHealthRecord?.neuter_date || "N/A",
    catHealthRecord?.vaccination_date || "N/A",
    catData.notes || "N/A",
  ];

  const { glAuth, glSheets } = await connectToSheets();

  const response = await glSheets.spreadsheets.values.append({
    auth: glAuth,
    spreadsheetId: process.env.CATALOG_SPREADSHEET_ID,
    range: `'${region!.name}'!A3`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [newCatRow],
    },
  });

  return response.data;
}
export function updateCatInSheet() {}

export function deleteCatFromSheet() {}

export function insertInterventionToSheet() {}

export function updateInterventionInSheet() {}

export function deleteInterventionFromSheet() {}

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
    range: "'test'!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["try1"]],
    },
  });
  return response;
}

async function connectToSheets() {
  const serviceAccountCredentials = JSON.parse(
    process.env.SERVICE_ACCOUNT_CREDENTIALS!,
  );
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
