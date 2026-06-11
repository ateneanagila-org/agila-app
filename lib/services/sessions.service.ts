import { db } from "../db";
import { cats, sessionCats, sessions } from "../db/schema";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import * as sessionsRepo from "../repo/sessions.repo";
import * as regionsRepo from "../repo/regions.repo";
import {
  CreateSessionCatSchema,
  CreateSessionSchema,
} from "../validation/sessions";
import { createCat, removeCat } from "./cats.service";
import { AppError } from "../error/app-error";

// A finished session is immutable: its cats have flipped to Unreviewed and sit in
// the manager review queue. Editing it (typically via a stale / back-button form)
// would silently mutate rows under review or strand new Unsubmitted drafts.
const SESSION_LOCKED_MSG =
  "This session was already submitted and can no longer be edited.";


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
 * Single-round-trip loader for the create form: the session, its region's
 * display name, and all its cats (region-resolved) shaped as { cat, sessionCatId }.
 * Returns null when the session is missing. Replaces the client-side
 * getSessionCats + N×getCats waterfall.
 */
export const getSessionWithCats = async (sessionId: string) => {
  const session = await sessionsRepo.findSessionById(sessionId);
  if (!session) return null;

  const region = session.region_id
    ? await regionsRepo.findRegionById(session.region_id)
    : null;

  const rows = await sessionsRepo.findSessionCatsWithCats(sessionId);
  const cats = rows.map(({ session_cat_id, ...cat }) => ({
    cat,
    sessionCatId: session_cat_id,
  }));

  return { session, regionName: region?.name ?? null, cats };
};

/**
 * Marks a session as finished and flips all its still-Unsubmitted cats to
 * Unreviewed so they appear in the manager review queue.
 */
export const finishSession = async (sessionId: string) => {
  return await db.transaction(async (tx) => {
    // Conditional mark-finished: only flips a session that is still open. A 0-row
    // result means it's missing or already submitted — reject instead of silently
    // re-running the cat flip (no extra read; closes the check-then-act race).
    const [updated] = await tx
      .update(sessions)
      .set({ is_finished: true, last_updated_at: new Date() })
      .where(
        and(
          eq(sessions.id, sessionId),
          or(eq(sessions.is_finished, false), isNull(sessions.is_finished)),
        ),
      )
      .returning();

    if (!updated) throw new AppError(SESSION_LOCKED_MSG, 409);

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

    const session = await sessionsRepo.findSessionById(session_id, tx);
    if (!session) throw new AppError("Session not found.", 404);
    if (session.is_finished) throw new AppError(SESSION_LOCKED_MSG, 409);

    const newCat = await createCat(newCatData);

    const [join] = await sessionsRepo.insertSessionCat(
      {
        session_id: session_id,
        cat_id: newCat.id,
      },
      tx,
    );

    return { cat: newCat, sessionCatId: join.id };
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
  const session = await sessionsRepo.findSessionForSessionCat(sessionCatId);
  if (session?.is_finished) throw new AppError(SESSION_LOCKED_MSG, 409);

  const orphans =
    await sessionsRepo.findOrphanCatForSessionCatDelete(sessionCatId);

  if (orphans.length > 0) {
    await removeCat({ id: orphans[0].id });
  } else {
    await sessionsRepo.deleteSessionCat(sessionCatId);
  }

  return { success: true, deletedCats: orphans.length };
};
