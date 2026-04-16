// import { db } from "./index";
// import * as schema from "./schema";
// import * as enums from "./enums";
// import { seed } from "drizzle-seed";
// import { sql } from "drizzle-orm";

// async function main() {
//   console.log("Emptying existing data...");

//   // 1. Clear tables in order of dependency to avoid Foreign Key violations
//   const tables = [
//     schema.gsheetSyncQueue,
//     schema.interventions,
//     schema.catHealthRecords,
//     schema.sessionCats,
//     schema.sessionUsers,
//     // schema.sessions,
//     schema.cats,
//     schema.regions,
//     schema.allowedEmails,
//     schema.profiles,
//   ];

//   for (const table of tables) {
//     await db.execute(sql`TRUNCATE TABLE ${table} CASCADE`);
//   }

//   // Clear Supabase Auth users
//   await db.execute(sql`DELETE FROM auth.users`);

//   console.log("Seeding fresh data...");

//   // 2. Mock payload for Google Sheets Sync Queue (22 columns: A-V)
//   // We stringify it so drizzle-seed can handle it as a primitive string
//   const mockPayload = JSON.stringify([
//     "seed-uuid-123", // A: ID
//     "", // B: Photo
//     "Seed Cat", // C: Nickname
//     "Black", // D: Color
//     "Adult", // E: Age
//     "Unknown", // F: Sex
//     "YES", // G: Neutered
//     "Tame", // H: Tame
//     "NO", // I: Sick
//     "NO", // J: Injured
//     "YES", // K: Adoptable
//     "Available", // L: Status
//     "Volunteer", // M: Caretaker
//     new Date().toLocaleDateString(), // N: Date Last Seen
//     "Campus", // O: Place Last Seen
//     "N/A", // P: Date of Kapon
//     "N/A", // Q: Date of Vaccination
//     "Notes", // R: Notes
//     "", // S: Separator (Blacked out)
//     "Will have TNVR intervention", // T: TNVR
//     "Will not have intervention", // U: Vet
//     "Healthy & Adoptable", // V: FOR FA
//   ]);

//   await seed(db, schema).refine((f) => ({
//     supabaseUsers: {
//       count: 10,
//       columns: {
//         email: f.email(),
//       },
//     },
//     profiles: {
//       count: 10,
//       columns: {
//         name: f.firstName(),
//         auth_role: f.valuesFromArray({ values: [...enums.AUTH_ROLE_VALUES] }),
//       },
//     },
//     allowedEmails: {
//       count: 5,
//       columns: {
//         email: f.email(),
//       },
//     },
//     regions: {
//       count: 10,
//       columns: {
//         name: f.valuesFromArray({ values: [...enums.REGION_NAME_VALUES] }),
//         color: f.valuesFromArray({ values: [...enums.REGION_COLOR_VALUES] }),
//       },
//     },
//     cats: {
//       count: 40,
//       columns: {
//         name: f.firstName(),
//         photo_url: f.valuesFromArray({
//           values: ["https://placekitten.com/400/400", ""],
//         }),
//         color: f.valuesFromArray({ values: [...enums.CAT_COLOR_VALUES] }),
//         age: f.valuesFromArray({ values: [...enums.CAT_AGE_VALUES] }),
//         sex: f.valuesFromArray({ values: [...enums.CAT_SEX_VALUES] }),
//         sociability: f.valuesFromArray({
//           values: [...enums.CAT_SOCIABILITY_VALUES],
//         }),
//         cat_status: f.valuesFromArray({ values: [...enums.CAT_STATUS_VALUES] }),
//         entry_status: f.valuesFromArray({
//           values: [...enums.CAT_ENTRY_STATUS_VALUES],
//         }),
//       },
//     },
//     catHealthRecords: {
//       count: 40, // Match cat count for 1:1 relation
//       columns: {
//         condition: f.valuesFromArray({
//           values: [...enums.CATHEALTHRECORD_CONDITION_VALUES],
//         }),
//       },
//     },
//     sessions: {
//       count: 15,
//       columns: {
//         is_finished: f.boolean(),
//       },
//     },
//     interventions: {
//       count: 20,
//       columns: {
//         type: f.valuesFromArray({
//           values: [...enums.INTERVENTION_TYPE_VALUES],
//         }),
//         status: f.valuesFromArray({
//           values: [...enums.INTERVENTION_STATUS_VALUES],
//         }),
//       },
//     },
//     gsheetSyncQueue: {
//       count: 5,
//       columns: {
//         // actionEnum and actionStatusEnum values from your schema
//         action: f.valuesFromArray({ values: ["CREATE", "UPDATE", "DELETE"] }),
//         status: f.valuesFromArray({
//           values: ["PENDING", "COMPLETED", "FAILED"],
//         }),

//         // We use valuesFromArray with our stringified JSON array.
//         // This avoids the 'any' type and prevents the generator crash.
//         payload: f.valuesFromArray({ values: [mockPayload] }),
//       },
//     },
//   }));

//   console.log("✅ AGILA Database Seeded Successfully!");
//   process.exit(0);
// }

// main().catch((err) => {
//   console.error("❌ Seeding failed:", err);
//   process.exit(1);
// });
