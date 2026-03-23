import { db } from "./index";
import * as schema from "./schema";
import * as enums from "./enums";
import { seed } from "drizzle-seed";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Emptying existing data...");

  // 1. Manually clear tables to avoid "Duplicate Key" errors
  // We use CASCADE to handle foreign key dependencies
  await db.execute(sql`TRUNCATE TABLE ${schema.profiles} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${schema.allowedEmails} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${schema.cats} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${schema.regions} CASCADE`);
  // Note: TRUNCATE on auth.users might require superuser perms.
  // If it fails, use: DELETE FROM auth.users;
  await db.execute(sql`DELETE FROM auth.users`);

  console.log("Seeding fresh data...");

  // Pass the entire schema object so it recognizes the 'auth' schema too
  await seed(db, schema).refine((f) => ({
    // 1. We MUST seed users first because profiles and allowed_emails depend on them
    supabaseUsers: {
      count: 10,
      columns: {
        email: f.email(),
      },
    },

    // 2. Profiles depend on supabaseUsers
    profiles: {
      count: 10,
      columns: {
        name: f.firstName(),
        auth_role: f.valuesFromArray({ values: [...enums.AUTH_ROLE_VALUES] }),
      },
    },

    // 3. FIX: Seed allowed_emails and link it to the users we just made
    allowedEmails: {
      count: 5,
      columns: {
        email: f.email(),
      },
    },

    regions: {
      count: 15,
      columns: {
        name: f.valuesFromArray({ values: [...enums.REGION_NAME_VALUES] }),
        color: f.valuesFromArray({ values: [...enums.REGION_COLOR_VALUES] }),
      },
    },

    cats: {
      count: 30,
      columns: {
        name: f.firstName(),
        photo_url: f.valuesFromArray({
          values: [
            "https://placekitten.com/400/400",
            "https://placekitten.com/401/401",
          ],
        }),
        color: f.valuesFromArray({ values: [...enums.CAT_COLOR_VALUES] }),
        age: f.valuesFromArray({ values: [...enums.CAT_AGE_VALUES] }),
        sex: f.valuesFromArray({ values: [...enums.CAT_SEX_VALUES] }),
        sociability: f.valuesFromArray({
          values: [...enums.CAT_SOCIABILITY_VALUES],
        }),
        cat_status: f.valuesFromArray({ values: [...enums.CAT_STATUS_VALUES] }),
        entry_status: f.valuesFromArray({
          values: [...enums.CAT_ENTRY_STATUS_VALUES],
        }),
        notes: f.loremIpsum({ sentencesCount: 2 }),
      },
    },

    catHealthRecords: {
      count: 30,
      columns: {
        condition: f.valuesFromArray({
          values: [...enums.CATHEALTHRECORD_CONDITION_VALUES],
        }),
      },
    },

    sessions: {
      count: 10,
      columns: {
        is_finished: f.boolean(),
      },
    },

    interventions: {
      count: 10,
      columns: {
        type: f.valuesFromArray({
          values: [...enums.INTERVENTION_TYPE_VALUES],
        }),
        status: f.valuesFromArray({
          values: [...enums.INTERVENTION_STATUS_VALUES],
        }),
      },
    },
  }));

  console.log("✅ AGILA Database Seeded Successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
