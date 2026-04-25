import { db } from "../db";
import { cats, sessionCats, sessions } from "../db/schema";
import { and, eq, inArray } from "drizzle-orm";
import * as sessionsRepo from "../repo/sessions.repo";
import * as catsRepo from "../repo/cats.repo";
import {
  CreateSessionCatSchema,
  CreateSessionSchema,
} from "../validation/sessions";
import { createCat } from "./cats.service";
import { refreshCatInSyncQueue } from "./helper.service";

// Logic mainly for handling consecutive table queries
export const createSession = async (data: CreateSessionSchema) => {
  return await db.transaction(async (tx) => {
    const [newSession] = await sessionsRepo.insertSession(
      {
        region_id: data.region_id,
      },
      tx,
    );

    await sessionsRepo.insertSessionUser(
      {
        session_id: newSession.id,
        user_id: data.user_id,
      },
      tx,
    );

    return newSession;
  });
};

/**
 * Marks a session as finished and flips all its still-Unsubmitted cats to
 * Unreviewed so they appear in the manager review queue.
 */
export const finishSession = async (sessionId: string) => {
  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(sessions)
      .set({ is_finished: true, last_updated_at: new Date() })
      .where(eq(sessions.id, sessionId))
      .returning();

    const linkedCatIds = (
      await tx
        .select({ cat_id: sessionCats.cat_id })
        .from(sessionCats)
        .where(eq(sessionCats.session_id, sessionId))
    ).map((r) => r.cat_id);

    if (linkedCatIds.length > 0) {
      await tx
        .update(cats)
        .set({ entry_status: "Unreviewed", last_updated_at: new Date() })
        .where(
          and(
            inArray(cats.id, linkedCatIds),
            eq(cats.entry_status, "Unsubmitted"),
          ),
        );
    }

    return updated;
  });
};

export const createSessionCat = async (data: CreateSessionCatSchema) => {
  return await db.transaction(async (tx) => {
    const { session_id, ...newCatData } = data;
    const newCat = await createCat(newCatData);

    await sessionsRepo.insertSessionCat(
      {
        session_id: session_id,
        cat_id: newCat.id,
      },
      tx,
    );

    // Refresh sync queue AFTER session link exists so findCatRegionByLatestSession succeeds
    await refreshCatInSyncQueue(newCat.id, tx);

    return newCat;
  });
};
