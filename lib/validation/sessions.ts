import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { sessionCats, sessions, sessionUsers } from "@/lib/db/schema";
import { z } from "zod";
import { createCatSchema } from "./cats";

// SESSIONS
export const sessionsSchema = createSelectSchema(sessions);
export const createSessionSchema = createInsertSchema(sessions)
  .pick({
    region_id: true,
  })
  .extend({
    user_id: z.string().uuid(),
  });
export const getSessionsSchema = sessionsSchema.partial();
export const editSessionSchema = createInsertSchema(sessions)
  .omit({ created_at: true, last_updated_at: true })
  .partial()
  .required({ id: true });

// SESSION CATS
export const sessionCatsSchema = createSelectSchema(sessionCats);
export const createSessionCatSchema = createCatSchema.extend({
  session_id: z.string().uuid(),
});
export const getSessionCatsSchema = sessionCatsSchema.partial();

// SESSION USERS
export const sessionUsersSchema = createSelectSchema(sessionUsers);
export const getSessionUsersSchema = sessionUsersSchema.partial();
// TYPES
export type InsertSession = typeof sessions.$inferInsert;
export type SelectSession = typeof sessions.$inferSelect;
export type InsertSessionCat = typeof sessionCats.$inferInsert;
export type SelectSessionCat = typeof sessionCats.$inferSelect;
export type InsertSessionUser = typeof sessionUsers.$inferInsert;
export type SelectSessionUser = typeof sessionUsers.$inferSelect;
export type CreateSessionSchema = z.infer<typeof createSessionSchema>;
export type GetSessionsSchema = z.infer<typeof getSessionsSchema>;
export type EditSessionSchema = z.infer<typeof editSessionSchema>;
export type CreateSessionCatSchema = z.infer<typeof createSessionCatSchema>;
