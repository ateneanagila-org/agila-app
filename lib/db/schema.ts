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
  index,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
}).enableRLS();

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
}).enableRLS();

export const regions = pgTable(
  "regions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    color: regionColorEnum("color"),
  },
  (t) => [
    unique().on(t.name),
    // Declared so `drizzle-kit push` leaves it alone. This policy exists in the
    // database; drizzle-kit diffs policies, and anything it cannot see in this
    // file it proposes to DROP — a bare push previously wanted to run
    // `ALTER TABLE regions DISABLE ROW LEVEL SECURITY` plus
    // `DROP POLICY "enabled-rls-bypass" ... CASCADE` as incidental drift.
    //
    // regions is the only table granting SELECT to anon/authenticated (it is
    // read through PostgREST), and the only one with RLS on. The policy is
    // allow-all, so it does not currently restrict anything — the app connects
    // as `postgres`, the table owner, which bypasses RLS either way. It is
    // declared here so that if the policy is ever tightened, a routine push
    // does not silently delete the tightened version.
    pgPolicy("enabled-rls-bypass", {
      as: "permissive",
      for: "all",
      to: "public",
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
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
}, (t) => [
  // The effective-region rule resolves a cat's region through its most recent
  // session: session_cats -> sessions, ordered by created_at. Postgres does not
  // index foreign keys on its own, so without these the lookup was a seq scan.
  index("sessions_region_id_idx").on(t.region_id),
  index("sessions_created_at_idx").on(t.created_at),
]).enableRLS();

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
}).enableRLS();

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
}, (t) => [
  // cat_id is the innermost probe of the effective-region subquery, which runs
  // once per row of the catalog read — by far the hottest lookup in the app.
  index("session_cats_cat_id_idx").on(t.cat_id),
  index("session_cats_session_id_idx").on(t.session_id),
]).enableRLS();

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
  // Identity (1,0,0,0) = object-cover, which is exactly how legacy baked crops look.
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
}, (t) => [
  // entry_status is the only filter on the catalog read ("Original") and on the
  // review queue ("Unreviewed"); region_id is the COALESCE fast path of the
  // effective-region rule.
  index("cats_entry_status_idx").on(t.entry_status),
  index("cats_region_id_idx").on(t.region_id),
]).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

export const syncAuditLog = pgTable("sync_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  regionId: uuid("region_id"),
  direction: syncDirectionEnum("direction").notNull(),
  tasksProcessed: integer("tasks_processed").default(0).notNull(),
  tasksFailed: integer("tasks_failed").default(0).notNull(),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}).enableRLS();

export const systemConfig = pgTable("system_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

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
}).enableRLS();
