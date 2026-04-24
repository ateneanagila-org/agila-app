import { z } from "zod";
import {
  CatColorEnum,
  CatAgeEnum,
  CatSexEnum,
  CatSociabilityEnum,
  CatStatusEnum,
  CatHealthRecordConditionEnum,
} from "@/lib/db/enums";

/**
 * Validates a row from the GSheet before importing into the DB.
 * Maps the 22-column spreadsheet array back to structured data.
 *
 * Sheet columns (0-indexed):
 *  0: id (A), 1: photo (B), 2: name (C), 3: color (D), 4: age (E),
 *  5: sex (F), 6: neutered (G), 7: sociability (H), 8: sick (I),
 *  9: injured (J), 10: adoptable (K), 11: status (L), 12: caretaker (M),
 * 13: date_last_seen (N), 14: place_last_seen (O), 15: neuter_date (P),
 * 16: vaccination_date (Q), 17: notes (R), 18: separator (S),
 * 19: tnvr_status (T), 20: vet_status (U), 21: fa_status (V)
 */
const InterventionSignalEnum = z.enum([
  "will_have",
  "will_not_have",
  "ignore",
]);

export const sheetRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  color: CatColorEnum.nullable(),
  age: CatAgeEnum.nullable(),
  sex: CatSexEnum.nullable(),
  sociability: CatSociabilityEnum.nullable(),
  cat_status: CatStatusEnum.nullable(),
  spot_last_seen: z.string().nullable(),
  caretaker: z.string().nullable(),
  notes: z.string().nullable(),
  is_adoptable: z.boolean(),
  condition: CatHealthRecordConditionEnum.nullable(),
  neuter_date: z.string().nullable(),
  vaccination_date: z.string().nullable(),
  paws_id: z.string().nullable().optional(),
  tnvr_signal: InterventionSignalEnum,
  vet_signal: InterventionSignalEnum,
});

export type SheetRowParsed = z.infer<typeof sheetRowSchema>;

/**
 * Converts a raw sheet row array into the structured object for validation.
 * Returns null if the row can't be parsed (e.g., missing ID).
 */
export function parseSheetRow(row: string[]): Record<string, unknown> | null {
  const id = row[24]?.trim(); // UUID from col Y
  if (!id) return null;

  const isSick = String(row[8] ?? "").toUpperCase() === "YES";
  const isInjured = String(row[9] ?? "").toUpperCase() === "YES";
  let condition: string | null = null;
  if (isSick && isInjured) condition = "Sick and Injured";
  else if (isSick) condition = "Sick";
  else if (isInjured) condition = "Injured";
  else condition = "Healthy";

  const rawSex = String(row[5] ?? "").trim();
  const sex = ["Male", "Female"].includes(rawSex) ? rawSex : "Unknown";

  const rawSociability = String(row[7] ?? "").trim();
  const sociability = ["Domesticated", "Tame", "Feral"].includes(rawSociability)
    ? rawSociability
    : "Unknown";

  const rawStatus = String(row[11] ?? "").trim();
  const validStatuses = ["Deceased", "Fostered", "Adopted", "MIA", "Unknown"];
  const cat_status = validStatuses.includes(rawStatus) ? rawStatus : null;

  const is_adoptable = String(row[10] ?? "").toUpperCase() === "YES";

  const rawColor = String(row[3] ?? "").trim();
  const validColors = [
    "Black", "White", "Black and White", "Calico", "Tortie", "Torbie",
    "Orange Tabby", "Orange and White Tabby", "Gray Tabby",
    "Gray and White Tabby", "Brown Tabby", "Brown and White Tabby",
  ];
  const color = validColors.includes(rawColor) ? rawColor : null;

  const rawAge = String(row[4] ?? "").trim();
  const validAges = ["Neonatal", "Kitten", "Juvenile", "Adult"];
  const age = validAges.includes(rawAge) ? rawAge : null;

  const neuter_date = row[15] && row[15] !== "N/A" ? row[15] : null;
  const vaccination_date = row[16] && row[16] !== "N/A" ? row[16] : null;

  const name = row[2] && row[2] !== "N/A" ? row[2] : null;
  const spot_last_seen = row[14] && row[14] !== "N/A" ? row[14] : null;
  const caretaker = row[12] && row[12] !== "N/A" ? row[12] : null;
  const notes = row[17] && row[17] !== "N/A" ? row[17] : null;

  const rawTnvr = String(row[19] ?? "").trim();
  const rawVet = String(row[20] ?? "").trim();

  function parseInterventionSignal(raw: string): "will_have" | "will_not_have" | "ignore" {
    if (raw === "Will have TNVR intervention" || raw === "Will have Vet intervention") return "will_have";
    if (raw === "Will not have intervention") return "will_not_have";
    return "ignore";
  }

  return {
    id,
    name,
    color,
    age,
    sex,
    sociability,
    cat_status,
    spot_last_seen,
    caretaker,
    notes,
    is_adoptable,
    condition,
    neuter_date,
    vaccination_date,
    tnvr_signal: parseInterventionSignal(rawTnvr),
    vet_signal: parseInterventionSignal(rawVet),
  };
}

/**
 * Converts a raw UNKNOWN sheet row to structured data.
 * UNKNOWN layout: A(0)=CatalogID, B(1)=PossibleLoc, C(2)=PawsId,
 * D(3)=Color, E(4)=Age, F(5)=Sex, G(6)=Neutered, H(7)=Tame,
 * I(8)=Sick, J(9)=Injured, K(10)=Adoptable, L(11)=DateOfKapon,
 * M(12)=DateOfVaccination, Y(24)=UUID.
 */
export function parseUnknownSheetRow(row: string[]): Record<string, unknown> | null {
  const id = row[24]?.trim(); // UUID from col Y
  if (!id) return null;

  const isSick = String(row[8] ?? "").toUpperCase() === "YES";
  const isInjured = String(row[9] ?? "").toUpperCase() === "YES";
  let condition: string | null = null;
  if (isSick && isInjured) condition = "Sick and Injured";
  else if (isSick) condition = "Sick";
  else if (isInjured) condition = "Injured";
  else condition = "Healthy";

  const rawSex = String(row[5] ?? "").trim();
  const sex = ["Male", "Female"].includes(rawSex) ? rawSex : "Unknown";

  const rawSociability = String(row[7] ?? "").trim();
  const sociability = ["Domesticated", "Tame", "Feral"].includes(rawSociability)
    ? rawSociability
    : "Unknown";

  const is_adoptable = String(row[10] ?? "").toUpperCase() === "YES";

  const rawColor = String(row[3] ?? "").trim();
  const validColors = [
    "Black", "White", "Black and White", "Calico", "Tortie", "Torbie",
    "Orange Tabby", "Orange and White Tabby", "Gray Tabby",
    "Gray and White Tabby", "Brown Tabby", "Brown and White Tabby",
  ];
  const color = validColors.includes(rawColor) ? rawColor : null;

  const rawAge = String(row[4] ?? "").trim();
  const validAges = ["Neonatal", "Kitten", "Juvenile", "Adult"];
  const age = validAges.includes(rawAge) ? rawAge : null;

  const spot_last_seen = row[1] && row[1] !== "N/A" ? row[1] : null;
  const paws_id = row[2] && row[2] !== "" ? row[2] : null;
  const neuter_date = row[11] && row[11] !== "N/A" ? row[11] : null;
  const vaccination_date = row[12] && row[12] !== "N/A" ? row[12] : null;

  return {
    id,
    name: null,
    color,
    age,
    sex,
    sociability,
    cat_status: null,
    spot_last_seen,
    paws_id,
    caretaker: null,
    notes: null,
    is_adoptable,
    condition,
    neuter_date,
    vaccination_date,
    tnvr_signal: "ignore" as const,
    vet_signal: "ignore" as const,
  };
}
