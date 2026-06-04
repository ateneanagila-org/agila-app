import "dotenv/config";
import { db } from "@/lib/db";
import { regions } from "@/lib/db/schema";
import { connectToSheets } from "@/lib/services/helper.service";
import { statusSuffix } from "@/lib/services/catalog.service";

// HOME counts a row "active" iff col A is a pure number (Sheets count() = numeric).
// True status lives in col L (index 11). Drift = suffix(colA) != statusSuffix(colL).
async function main() {
  const { glAuth, glSheets } = await connectToSheets();
  const spreadsheetId = process.env.CATALOG_SPREADSHEET_ID!;
  const allRegions = await db.select().from(regions);

  const typeX: any[] = []; // colA numeric but colL = a status  -> HOME double-counts
  const typeY: any[] = []; // colA suffixed but colL = active    -> HOME drops

  for (const region of allRegions) {
    if (region.name === "UNKNOWN") continue; // different layout, col L = date
    const res = await glSheets.spreadsheets.values.get({
      auth: glAuth, spreadsheetId, range: `'${region.name}'!A3:Y`,
    });
    const rows = res.data.values ?? [];
    rows.forEach((row, i) => {
      const colA = String(row[0] ?? "").trim();
      const colY = String(row[24] ?? "").trim();
      const colL = String(row[11] ?? "").trim();
      const name = String(row[2] ?? "").trim();
      if (!colY || !colA) return;
      const isPureNumeric = /^\d+$/.test(colA);
      const status = ["MIA", "Deceased", "Adopted", "Fostered"].includes(colL) ? colL : null;
      const wantSuffix = statusSuffix(status);
      const haveSuffix = colA.replace(/^\d+/, ""); // trailing letters on col A
      if (haveSuffix === wantSuffix) return; // in sync
      const rec = { region: region.name, row: i + 3, name, colA, colL };
      if (isPureNumeric && status) typeX.push(rec);
      else typeY.push(rec);
    });
  }

  console.log(`=== TYPE X: col A numeric but col L is a status (HOME counts active AND in status bucket -> +1 each) : ${typeX.length} ===`);
  console.table(typeX);
  console.log(`=== TYPE Y: col A suffixed/text but col L active (HOME counts in NEITHER -> -1 each) : ${typeY.length} ===`);
  console.table(typeY);
  console.log(`Net HOME overcount = ${typeX.length} - ${typeY.length} = ${typeX.length - typeY.length}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
