import { db } from "../db";
import { profiles } from "../db/schema";
import { eq, and } from "drizzle-orm";
import {
  FindProfilesSchema,
  UpdateProfileSchema,
} from "../validation/profiles";

export async function findProfiles(filters: FindProfilesSchema) {
  const { id, name, auth_role } = filters;
  const conditions = [];

  if (id) conditions.push(eq(profiles.id, id));
  if (name) conditions.push(eq(profiles.name, name));
  if (auth_role) conditions.push(eq(profiles.auth_role, auth_role));

  return await db.query.profiles.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
  });
}

export async function insertProfile(id: string) {
  return await db.insert(profiles).values({ id });
}

export async function updateProfile(id: string, data: UpdateProfileSchema) {
  return await db.update(profiles).set(data).where(eq(profiles.id, id));
}
