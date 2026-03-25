import * as sessionsRepo from "../repo/sessions.repo";
import * as catsRepo from "../repo/cats.repo";
import { CreateSessionCatSchema } from "../validation/sessions";

import { CreateCatSchema, EditCatSchema, InsertCat } from "../validation/cats";
import { db, DB } from "../db";
import { InsertSession } from "../validation/sessions";
import { catHealthRecords, cats, regions, sessionCats } from "../db/schema";
import { eq } from "drizzle-orm";
import { AppError } from "../error/app-error";
import { connectToSheets } from "./helper.service";

export function deleteCatFromSheet() {}

export function insertInterventionToSheet() {}

export function updateInterventionInSheet() {}

export function deleteInterventionFromSheet() {}

export const createCat = async (data: CreateCatSchema) => {
  return await db.transaction(async (tx) => {
    const { region_id, ...catData } = data;

    // INSERT INTO CATS TABLE
    const [newCat] = await catsRepo.insertCat(catData, tx);

    // INSERT INTO CATHEALTHRECORDS TABLE
    const [newCatHealthRecord] = await catsRepo.insertCatHealthRecord(
      { cat_id: newCat.id, condition: catData.condition },
      tx,
    );

    // INSERT INTO CATALOG GSHEETS
    // Find which sheet to insert into;
    const region = await tx.query.regions.findFirst({
      where: eq(regions.id, region_id),
    });

    // Type Var validators
    if (!region) throw new AppError("Region not found");
    if (!newCat.id) {
      throw new AppError("Cannot insert cat to sheet with Invalid ID");
    }

    const newCatRow = [
      newCat.id,
      catData.photo_url ? `=IMAGE("${catData.photo_url}")` : "N/A",
      catData.name || "N/A",
      catData.color,
      catData.age,
      catData.sex !== "Unknown" && catData.sex ? catData.sex : "???",
      newCatHealthRecord?.neuter_date ? "YES" : "NO",
      catData.sociability !== "Unknown" && catData.sociability
        ? catData.sociability
        : "???",
      newCatHealthRecord?.condition?.includes("Sick") ? "YES" : "NO",
      newCatHealthRecord?.condition?.includes("Injured") ? "YES" : "NO",
      catData.is_adoptable ? "YES" : "NO",
      catData.cat_status !== "Unknown" && catData.cat_status
        ? catData.cat_status
        : "None of the above",
      catData.caretaker || "N/A",
      new Date().toLocaleDateString(),
      catData.spot_last_seen || "N/A",
      newCatHealthRecord?.neuter_date?.toLocaleDateString() || "N/A",
      newCatHealthRecord?.vaccination_date?.toLocaleDateString() || "N/A",
      catData.notes || "N/A",
    ];

    const { glAuth, glSheets } = await connectToSheets();
    await glSheets.spreadsheets.values.append({
      auth: glAuth,
      spreadsheetId: process.env.CATALOG_SPREADSHEET_ID,
      range: `'${region!.name}'!A3`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [newCatRow],
      },
    });
    return newCat;
  });
};

export const editCat = async (id: string, data: EditCatSchema) => {
  return await db.transaction(async (tx) => {
    const {
      condition,
      neuter_date,
      vaccination_date,
      region_id,
      ...catTableFields
    } = data;

    // UPDATE CATS TABLE
    const [newCat] = await catsRepo.updateCat(id, catTableFields, tx);
    if (!newCat) throw new AppError("Cat not found in database");

    // UPDATE CATHEALTHRECORDS TABLE
    const [newCatHealthRecord] = await catsRepo.updateCatHealthRecord(
      id,
      {
        condition,
        neuter_date,
        vaccination_date,
        last_updated_at: new Date(),
      },
      tx,
    );
    if (!newCatHealthRecord) throw new AppError("Health record not found");

    // Find which sheet to insert into
    let targetRegionId = region_id;

    // If region_id wasn't changed in this edit, find the cat's existing latest region
    if (!targetRegionId) {
      const currentRegion = await sessionsRepo.findCatRegionByLatestSession(
        id,
        tx,
      );
      targetRegionId = currentRegion?.id;
    }

    if (!targetRegionId) {
      throw new AppError(
        "Region information is required to update the spreadsheet.",
      );
    }

    const region = await tx.query.regions.findFirst({
      where: eq(regions.id, targetRegionId),
    });
    if (!region) throw new AppError("Region not found");

    // UPDATE CAT IN GSHEETS
    // Mapping data to gsheet row
    const updatedCatRow = [
      id,
      newCat.photo_url ? `=IMAGE("${newCat.photo_url}")` : "N/A",
      newCat.name || "N/A",
      newCat.color,
      newCat.age,
      newCat.sex !== "Unknown" && newCat.sex ? newCat.sex : "???",
      newCatHealthRecord.neuter_date ? "YES" : "NO",
      newCat.sociability !== "Unknown" && newCat.sociability
        ? newCat.sociability
        : "???",
      newCatHealthRecord.condition?.includes("Sick") ? "YES" : "NO",
      newCatHealthRecord.condition?.includes("Injured") ? "YES" : "NO",
      newCat.is_adoptable ? "YES" : "NO",
      newCat.cat_status !== "Unknown" && newCat.cat_status
        ? newCat.cat_status
        : "None of the above",
      newCat.caretaker || "N/A",
      new Date().toLocaleDateString(),
      newCat.spot_last_seen || "N/A",
      newCatHealthRecord.neuter_date?.toLocaleDateString() || "N/A",
      newCatHealthRecord.vaccination_date?.toLocaleDateString() || "N/A",
      newCat.notes || "N/A",
    ];

    // Gsheets Update Logic
    const { glAuth, glSheets } = await connectToSheets();
    const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID;
    const sheetData = await glSheets.spreadsheets.values.get({
      auth: glAuth,
      spreadsheetId,
      range: `'${region.name}'!A:A`,
    });

    const rows = sheetData.data.values || [];
    // Find the row index where Column A matches our Cat ID
    const rowIndex = rows.findIndex((row) => row[0] === id);

    if (rowIndex === -1) {
      // If cat ID isn't found, append it to Row 3 (starts checking from A3)
      await glSheets.spreadsheets.values.append({
        auth: glAuth,
        spreadsheetId,
        range: `'${region.name}'!A3`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [updatedCatRow] },
      });
    } else {
      // If found, update that exact row (Sheets is 1-indexed)
      const rowNumber = rowIndex + 1;
      await glSheets.spreadsheets.values.update({
        auth: glAuth,
        spreadsheetId,
        range: `'${region.name}'!A${rowNumber}:R${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [updatedCatRow] },
      });
    }

    return newCat;
  });
};

export const getCats = () => {};
