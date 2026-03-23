import { db } from "../db";
import * as sessionsRepo from "../repo/sessions.repo";
import * as catsRepo from "../repo/cats.repo";
import {
  CreateSessionCatSchema,
  CreateSessionSchema,
} from "../validation/sessions";
import { createCat } from "./cats.service";

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
