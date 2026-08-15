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
  real,
  unique,
} from "drizzle-orm/pg-core";
import {
  authRoleEnum,
  regionColorEnum,
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
  syncDirectionEnum,
  bugReportStatusEnum,
} from "./enums";

const authSchema = pgSchema("auth");

export const supabaseUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
});

/**
 * Supabase-managed storage catalogue. DECLARED FOR READS ONLY — this table
 * belongs to the platform, not to us. Never include it in a drizzle-kit push;
 * only the columns the storage gauge needs are described here.
 */
const storageSchema = pgSchema("storage");

export const storageObjects = storageSchema.table("objects", {
  id: uuid("id").primaryKey(),
  bucket_id: text("bucket_id"),
  name: text("name"),
  metadata: jsonb("metadata"),
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
  email: text("email").notNull().unique(),
  allower_id: uuid("allower_id")
    .notNull()
    .references(() => supabaseUsers.id, {
      onDelete: "set null",
    }),
  allowed_at: timestamp("allowed_at").defaultNow().notNull(),
  auth_role: authRoleEnum("auth_role").notNull().default("Volunteer"),
});

export const regions = pgTable(
  "regions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    color: regionColorEnum("color"),
  },
  (t) => [unique().on(t.name)],
);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  census_no: integer("census_no").generatedByDefaultAsIdentity().notNull().unique(),
  region_id: uuid("region_id")
    .notNull()
    .references(() => regions.id, {
      onDelete: "cascade",
    }),
  created_at: timestamp("created_at").defaultNow().notNull(),
  last_updated_at: timestamp("last_updated_at").defaultNow(),
  is_finished: boolean("is_finished").default(false),
  is_system: boolean("is_system").default(false).notNull(),
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
  region_id: uuid("region_id").references(() => regions.id, {
    onDelete: "set null",
  }),
  last_updated_at: timestamp("last_updated_at").defaultNow(),
  entry_status: catEntryStatusEnum("entry_status")
    .default("Unsubmitted")
    .notNull(),
  photo_url: text("photo_url"),
  // Crop-as-metadata: photo_url stores the full normalized original; the crop is
  // applied at render time via this zoom/offset trio (see lib/photo-position.ts).
  // Identity (1,0,0) = object-cover, which is exactly how legacy baked crops look.
  // App-owned, never synced to the sheet (the sheet shows the uncropped original).
  photo_zoom: real("photo_zoom").default(1).notNull(),
  photo_offset_x: real("photo_offset_x").default(0).notNull(),
  photo_offset_y: real("photo_offset_y").default(0).notNull(),
  // Quarter-turn rotation applied at render time, alongside the crop trio above.
  // App-owned and never synced: the sheet always shows the uncropped, unrotated
  // original. 0 is identity, so every pre-existing row is unaffected.
  photo_rotation: integer("photo_rotation").default(0).notNull(),
  color: catColorEnum("color"),
  age: catAgeEnum("age"),
  sex: catSexEnum("sex"),
  name: text("name"),
  sociability: catSociabilityEnum("sociability"),
  cat_status: catStatusEnum("cat_status"),
  spot_last_seen: text("spot_last_seen"),
  // The date the cat was physically last sighted. Plain stored value — NOT
  // derived from session data (the initial-import session would poison it).
  // null = genuinely unknown. Fed by session-create, merge auto-advance,
  // manual edits, reverse-sync col N, and the one-time backfill.
  date_last_seen: timestamp("date_last_seen"),
  caretaker: text("caretaker"),
  notes: text("notes"),
  is_adoptable: boolean("is_adoptable").default(false),
  paws_id: text("paws_id"),
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
  // Sheet col G ("Neutered" YES/NO) — independent of neuter_date.
  // Volunteers often tick neutered without recording a date, so the two facts
  // must be stored separately. null = unknown.
  is_neutered: boolean("is_neutered"),
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

export const syncAuditLog = pgTable("sync_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  regionId: uuid("region_id"),
  direction: syncDirectionEnum("direction").notNull(),
  tasksProcessed: integer("tasks_processed").default(0).notNull(),
  tasksFailed: integer("tasks_failed").default(0).notNull(),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const systemConfig = pgTable("system_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * User-submitted bug reports.
 *
 * reporter_name / reporter_email are SNAPSHOTS, not derived. profiles.id
 * cascades from supabaseUsers.id and removing someone from the allowlist
 * deletes their auth user — so a cascading FK would delete their reports too.
 * SET NULL plus the snapshot keeps a report readable after its reporter is
 * gone, which is exactly when it still matters.
 */
export const bugReports = pgTable("bug_reports", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  message: text("message").notNull(),
  reporter_id: uuid("reporter_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  reporter_name: text("reporter_name"),
  reporter_email: text("reporter_email").notNull(),
  status: bugReportStatusEnum("status").notNull().default("Open"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  resolved_at: timestamp("resolved_at"),
});
