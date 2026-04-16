import { relations } from "drizzle-orm";
import * as schema from "./schema";

export const supabaseUsersRelations = relations(
  schema.supabaseUsers,
  ({ one, many }) => ({
    profile: one(schema.profiles, {
      fields: [schema.supabaseUsers.id],
      references: [schema.profiles.id],
    }),
    allowedEmails: many(schema.allowedEmails),
    sessionUsers: many(schema.sessionUsers),
  }),
);

export const profilesRelations = relations(schema.profiles, ({ one }) => ({
  user: one(schema.supabaseUsers, {
    fields: [schema.profiles.id],
    references: [schema.supabaseUsers.id],
  }),
}));

export const allowedEmailsRelations = relations(
  schema.allowedEmails,
  ({ one }) => ({
    allower: one(schema.supabaseUsers, {
      fields: [schema.allowedEmails.allower_id],
      references: [schema.supabaseUsers.id],
    }),
  }),
);

export const sessionsRelations = relations(
  schema.sessions,
  ({ one, many }) => ({
    region: one(schema.regions, {
      fields: [schema.sessions.region_id],
      references: [schema.regions.id],
    }),
    sessionCats: many(schema.sessionCats),
    sessionUsers: many(schema.sessionUsers),
  }),
);

export const sessionsUsersRelations = relations(
  schema.sessionUsers,
  ({ one }) => ({
    session: one(schema.sessions, {
      fields: [schema.sessionUsers.session_id],
      references: [schema.sessions.id],
    }),
    user: one(schema.supabaseUsers, {
      fields: [schema.sessionUsers.user_id],
      references: [schema.supabaseUsers.id],
    }),
  }),
);

export const sessionCatsRelations = relations(
  schema.sessionCats,
  ({ one }) => ({
    session: one(schema.sessions, {
      fields: [schema.sessionCats.session_id],
      references: [schema.sessions.id],
    }),
    cat: one(schema.cats, {
      fields: [schema.sessionCats.cat_id],
      references: [schema.cats.id],
    }),
  }),
);

export const catsRelations = relations(schema.cats, ({ one, many }) => ({
  cat: one(schema.cats, {
    fields: [schema.cats.merged_into_id],
    references: [schema.cats.id],
  }),
  sessionCats: many(schema.sessionCats),
  interventions: many(schema.interventions),
  catHealthRecords: one(schema.catHealthRecords, {
    fields: [schema.cats.id],
    references: [schema.catHealthRecords.cat_id],
  }),
}));

export const interventionsRelations = relations(
  schema.interventions,
  ({ one }) => ({
    cat: one(schema.cats, {
      fields: [schema.interventions.cat_id],
      references: [schema.cats.id],
    }),
  }),
);

export const catHealthRecordsRelations = relations(
  schema.catHealthRecords,
  ({ one }) => ({
    cat: one(schema.cats, {
      fields: [schema.catHealthRecords.cat_id],
      references: [schema.cats.id],
    }),
  }),
);

export const regionsRelations = relations(schema.regions, ({ many }) => ({
  session: many(schema.sessions),
}));
