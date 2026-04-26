// import { db } from "./index";
// import * as schema from "./schema";
// import * as enums from "./enums";
// import { sql } from "drizzle-orm";
// import { v4 as uuidv4 } from "uuid";

// // Simplified random generators
// const randomEmail = () => `user${Math.random().toString(36).slice(2)}@test.com`;
// const randomName = () => {
//   const names = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry", "Ivy", "Jack"];
//   return names[Math.floor(Math.random() * names.length)];
// };
// const randomBoolean = () => Math.random() > 0.5;
// const randomChoice = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// async function main() {
//   console.log("Emptying existing data...");

//   // 1. Clear tables in order of dependency
//   const tables = [
//     schema.gsheetSyncQueue,
//     schema.interventions,
//     schema.catHealthRecords,
//     schema.sessionCats,
//     schema.sessionUsers,
//     schema.sessions,
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

//   // 2. Create supabase users in auth.users
//   const userIds = Array(10)
//     .fill(0)
//     .map(() => uuidv4());
//   const userEmails = userIds.map(() => randomEmail());

//   await Promise.all(
//     userIds.map((id, i) =>
//       db.execute(sql`INSERT INTO auth.users (id, email, created_at, updated_at) VALUES (${id}, ${userEmails[i]}, now(), now())`)
//     )
//   );

//   // 3. Create profiles linked to users
//   await db.insert(schema.profiles).values(
//     userIds.map((id) => ({
//       id,
//       name: randomName(),
//       auth_role: randomChoice(["Manager", "Volunteer"] as const),
//     }))
//   );

//   // 4. Create regions
//   const regionIds = Array(10)
//     .fill(0)
//     .map(() => ({
//       id: uuidv4(),
//       name: randomChoice([...enums.REGION_NAME_VALUES]),
//       color: randomChoice([...enums.REGION_COLOR_VALUES]),
//     }));
//   await db.insert(schema.regions).values(regionIds);

//   // 5. Create cats
//   const catIds = Array(40)
//     .fill(0)
//     .map(() => ({
//       id: uuidv4(),
//       name: randomName(),
//       photo_url: randomChoice(["https://placekitten.com/400/400", ""]),
//       color: randomChoice([...enums.CAT_COLOR_VALUES]),
//       age: randomChoice([...enums.CAT_AGE_VALUES]),
//       sex: randomChoice([...enums.CAT_SEX_VALUES]),
//       sociability: randomChoice([...enums.CAT_SOCIABILITY_VALUES]),
//       cat_status: randomChoice([...enums.CAT_STATUS_VALUES]),
//       entry_status: randomChoice([...enums.CAT_ENTRY_STATUS_VALUES]),
//     }));
//   await db.insert(schema.cats).values(catIds);

//   // 6. Create cat health records
//   await db.insert(schema.catHealthRecords).values(
//     catIds.map((cat) => ({
//       cat_id: cat.id,
//       condition: randomChoice([...enums.CATHEALTHRECORD_CONDITION_VALUES]),
//     }))
//   );

//   // 7. Create allowed emails
//   await db.insert(schema.allowedEmails).values(
//     Array(5)
//       .fill(0)
//       .map(() => ({
//         id: uuidv4(),
//         email: randomEmail(),
//         allower_id: randomChoice(userIds),
//       }))
//   );

//   // 8. Create sessions
//   const sessionIds = Array(15)
//     .fill(0)
//     .map(() => ({
//       id: uuidv4(),
//       region_id: randomChoice(regionIds).id,
//       is_finished: randomBoolean(),
//     }));
//   await db.insert(schema.sessions).values(sessionIds);

//   // 9. Create session users
//   await db.insert(schema.sessionUsers).values(
//     Array(15)
//       .fill(0)
//       .map(() => ({
//         id: uuidv4(),
//         user_id: randomChoice(userIds),
//         session_id: randomChoice(sessionIds).id,
//       }))
//   );

//   // 10. Create session cats
//   await db.insert(schema.sessionCats).values(
//     Array(20)
//       .fill(0)
//       .map(() => ({
//         id: uuidv4(),
//         cat_id: randomChoice(catIds).id,
//         session_id: randomChoice(sessionIds).id,
//       }))
//   );

//   // 11. Create interventions
//   await db.insert(schema.interventions).values(
//     Array(20)
//       .fill(0)
//       .map(() => ({
//         id: uuidv4(),
//         cat_id: randomChoice(catIds).id,
//         type: randomChoice([...enums.INTERVENTION_TYPE_VALUES]),
//         status: randomChoice([...enums.INTERVENTION_STATUS_VALUES]),
//       }))
//   );

//   // 12. Create gsheet sync queue items
//   const mockPayload: string[] = [
//     "seed-uuid-123",
//     "",
//     "Seed Cat",
//     "Black",
//     "Adult",
//     "Unknown",
//     "YES",
//     "Tame",
//     "NO",
//     "NO",
//     "YES",
//     "Available",
//     "Volunteer",
//     new Date().toLocaleDateString(),
//     "Campus",
//     "N/A",
//     "N/A",
//     "Notes",
//     "",
//     "Will have TNVR intervention",
//     "Will not have intervention",
//     "Healthy & Adoptable",
//   ];

//   await db.insert(schema.gsheetSyncQueue).values(
//     Array(5)
//       .fill(0)
//       .map(() => ({
//         id: uuidv4(),
//         action: randomChoice(["CREATE", "UPDATE", "DELETE"] as const),
//         entityId: randomChoice(catIds).id,
//         regionId: randomChoice(regionIds).id,
//         status: randomChoice(["PENDING", "COMPLETED", "FAILED"] as const),
//         payload: mockPayload,
//       }))
//   );

//   console.log("✅ AGILA Database Seeded Successfully!");
//   process.exit(0);
// }

// main().catch((err) => {
//   console.error("❌ Seeding failed:", err);
//   process.exit(1);
// });
