import {
  integer,
  pgTable,
  pgEnum,
  pgSchema,
  text,
  uuid,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { urgencyEnum, authRoleEnum } from "./enums";

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
