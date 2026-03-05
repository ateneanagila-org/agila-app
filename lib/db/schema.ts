import {
  integer,
  pgTable,
  pgSchema,
  text,
  uuid,
  timestamp,
  boolean,
  AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  urgencyEnum,
  authRoleEnum,
  regionStatusEnum,
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
} from "./enums";

const authSchema = pgSchema("auth");

const supabaseUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => supabaseUsers.id, { onDelete: "cascade" }),
  name: text("name"),
  auth_role: authRoleEnum("auth_role").notNull().default("Volunteer"),
});

export const allowedEmails = pgTable("allowed_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email"),
  allower_id: uuid("allower_id").references(() => supabaseUsers.id, {
    onDelete: "set null",
  }),
  allowed_at: timestamp("allowed_at").defaultNow().notNull(),
});

export const regions = pgTable("regions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: regionNameEnum("name").default("UNKNOWN").notNull(),
  status: regionStatusEnum("status"),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  region_id: uuid("region_id")
    .notNull()
    .references(() => regions.id, {
      onDelete: "cascade",
    }),
  created_at: timestamp("created_at").defaultNow().notNull(),
  last_updated_at: timestamp("last_updated_at"),
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
  last_updated_at: timestamp("last_updated_at"),
  entry_status: catEntryStatusEnum("entry_status")
    .default("Unreviewed")
    .notNull(),
  photo_url: text("photo_url"),
  color: catColorEnum("color").default("Unknown"),
  age: catAgeEnum("age").default("Unknown"),
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
  last_updated_at: timestamp("last_updated_at"),
  requested_at: timestamp("requested_at").defaultNow().notNull(),
  type: interventionTypeEnum("type"),
  status: interventionStatusEnum("status").default("Pending"),
  notes: text("notes"),
});

export const catHealthRecord = pgTable("cat_health_record", {
  id: uuid("id").primaryKey().defaultRandom(),
  cat_id: uuid("cat_id")
    .notNull()
    .references(() => cats.id, {
      onDelete: "cascade",
    }),
  last_updated_at: timestamp("last_updated_at"),
  condition: catHealthRecordConditionEnum("condition"),
  neuter_date: timestamp("neuter_date"),
  vaccination_date: timestamp("vaccination_date"),
});

// TEMPLATE
export const requests = pgTable("requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => profiles.id, {
    onDelete: "cascade",
  }),
  // For currency we use the smallest unit: Php in cents
  fee: integer("fee"),
  title: text("title").notNull(),
  description: text("description"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  completed_at: timestamp("completed_at"),
  urgency: urgencyEnum("urgency").notNull().default("Now"),
  type: text(),
});

export type InsertProfile = typeof profiles.$inferInsert;
export type SelectProfile = typeof profiles.$inferSelect;
