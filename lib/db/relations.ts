// lib/db/relations.ts
import { relations } from "drizzle-orm";
import * as schema from "./schema"; // Import your tables

export const sessionsRelations = relations(
  schema.sessions,
  ({ one, many }) => ({
    region: one(schema.regions, {
      fields: [schema.sessions.region_id],
      references: [schema.regions.id],
    }),
    sessionCats: many(schema.sessionCats),
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
}));

export const interventionsRelations = relations(
  schema.cats,
  ({ one, many }) => ({
    cat: one(schema.cats, {
      fields: [schema.cats.merged_into_id],
      references: [schema.cats.id],
    }),
    sessionCats: many(schema.sessionCats),
  }),
);
