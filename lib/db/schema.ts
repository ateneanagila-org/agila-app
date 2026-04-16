import {
  pgTable,
  pgSchema,
  text,
  uuid,
  timestamp,
  boolean,
  AnyPgColumn,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import {
  authRoleEnum,
  regionColorEnum,
  regionNameEnum,
  catEntryStatusEnum,
  catColorEnum,
  catAgeEnum,
  catSexEnum,
  catSociabilityEnum,
  catStatusEnum,
  interventionTypeEnum,
  interventionStatusEnum,
  catHealthRecordConditionEnum,
  actionStatusEnum,
  actionEnum,
} from "./enums";

const authSchema = pgSchema("auth");

export const supabaseUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => supabaseUsers.id, { onDelete: "cascade" }),
  name: text("name"),
  auth_role: authRoleEnum("auth_role").notNull().default("Volunteer"),
  last_updated_at: timestamp("last_updated_at").defaultNow(),
});

export const allowedEmails = pgTable("allowed_emails", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  email: text("email").notNull(),
  allower_id: uuid("allower_id")
    .notNull()
    .references(() => supabaseUsers.id, {
      onDelete: "set null",
    }),
  allowed_at: timestamp("allowed_at").defaultNow().notNull(),
});

export const regions = pgTable("regions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: regionNameEnum("name").default("UNKNOWN").notNull(),
  color: regionColorEnum("color"),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  region_id: uuid("region_id")
    .notNull()
    .references(() => regions.id, {
      onDelete: "cascade",
    }),
  created_at: timestamp("created_at").defaultNow().notNull(),
  last_updated_at: timestamp("last_updated_at").defaultNow(),
  is_finished: boolean("is_finished").default(false),
});

export const sessionUsers = pgTable("session_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => supabaseUsers.id, {
      onDelete: "cascade",
    }),
  session_id: uuid("session_id")
    .notNull()
    .references(() => sessions.id, {
      onDelete: "cascade",
    }),
});

export const sessionCats = pgTable("session_cats", {
  id: uuid("id").primaryKey().defaultRandom(),
  cat_id: uuid("cat_id")
    .notNull()
    .references(() => cats.id, {
      onDelete: "cascade",
    }),
  session_id: uuid("session_id")
    .notNull()
    .references(() => sessions.id, {
      onDelete: "cascade",
    }),
});

export const cats = pgTable("cats", {
  id: uuid("id").primaryKey().defaultRandom(),
  merged_into_id: uuid("merged_into_id").references(
    (): AnyPgColumn => cats.id,
    {
      onDelete: "set null",
    },
  ),
  last_updated_at: timestamp("last_updated_at").defaultNow(),
  entry_status: catEntryStatusEnum("entry_status")
    .default("Unreviewed")
    .notNull(),
  photo_url: text("photo_url"),
  color: catColorEnum("color"),
  age: catAgeEnum("age"),
  sex: catSexEnum("sex").default("Unknown"),
  name: text("name"),
  sociability: catSociabilityEnum("sociability").default("Unknown"),
  cat_status: catStatusEnum("cat_status"),
  spot_last_seen: text("spot_last_seen"),
  caretaker: text("caretaker"),
  notes: text("notes"),
  is_adoptable: boolean("is_adoptable").default(false),
});

export const interventions = pgTable("interventions", {
  id: uuid("id").primaryKey().defaultRandom(),
  cat_id: uuid("cat_id")
    .notNull()
    .references(() => cats.id, {
      onDelete: "cascade",
    }),
  last_updated_at: timestamp("last_updated_at").defaultNow(),
  requested_at: timestamp("requested_at").defaultNow().notNull(),
  type: interventionTypeEnum("type"),
  status: interventionStatusEnum("status").default("Pending"),
  notes: text("notes"),
});

export const catHealthRecords = pgTable("cat_health_records", {
  // Use .primaryKey() directly on the cat_id column
  cat_id: uuid("cat_id")
    .primaryKey()
    .notNull()
    .references(() => cats.id, {
      onDelete: "cascade",
    }),
  last_updated_at: timestamp("last_updated_at").defaultNow(),
  condition: catHealthRecordConditionEnum("condition"),
  neuter_date: timestamp("neuter_date"),
  vaccination_date: timestamp("vaccination_date"),
});

export const gsheetSyncQueue = pgTable("gsheet_sync_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: actionEnum("action").notNull(),
  entityId: uuid("entity_id").notNull(), // The Cat's UUID
  regionId: uuid("region_id").notNull(), // Target Sheet Tab
  payload: jsonb("payload").$type<string[]>(), // The [A, B, C...] array
  status: actionStatusEnum("status").default("PENDING").notNull(), // PENDING, COMPLETED, FAILED
  createdAt: timestamp("created_at").defaultNow().notNull(),
  retryCount: integer("retry_count").default(0).notNull(),
  lastError: text("last_error"),
});
