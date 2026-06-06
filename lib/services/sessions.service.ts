import { db } from "../db";
import { cats, sessionCats, sessions } from "../db/schema";
import { and, eq, inArray } from "drizzle-orm";
import * as sessionsRepo from "../repo/sessions.repo";
import {
  CreateSessionCatSchema,
  CreateSessionSchema,
} from "../validation/sessions";
import { createCat, removeCat } from "./cats.service";


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

    return newCat;
  });
};

/**
 * Discards a session and reclaims its abandoned drafts. Session delete only
 * cascades the session_cats/session_users join rows (cats is their parent), so
 * session-scoped Unsubmitted cats would otherwise dangle forever. We hard-delete
 * the ones this leaves fully orphaned (Unsubmitted, in no other session) via
 * removeCat — which also clears their photo blob and any sheet row.
 * Original/Merged/Unreviewed and shared cats are left intact.
 */
export const discardSession = async (sessionId: string) => {
  const orphans =
    await sessionsRepo.findOrphanCatsForSessionDelete(sessionId);

  // removeCat cascades each cat's join row; drop the (then cat-less) session after.
  for (const { id } of orphans) {
    await removeCat({ id });
  }
  await sessionsRepo.deleteSession(sessionId);

  return { success: true, deletedCats: orphans.length };
};

/**
 * Removes a cat from a session. If that fully orphans the cat (Unsubmitted, in no
 * other session) it is hard-deleted via removeCat (which cascades this join row);
 * otherwise only the join row is dropped. The single-cat analogue of discardSession.
 */
export const removeSessionCat = async (sessionCatId: string) => {
  const orphans =
    await sessionsRepo.findOrphanCatForSessionCatDelete(sessionCatId);

  if (orphans.length > 0) {
    await removeCat({ id: orphans[0].id });
  } else {
    await sessionsRepo.deleteSessionCat(sessionCatId);
  }

  return { success: true, deletedCats: orphans.length };
};
