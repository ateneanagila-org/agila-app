import { and, eq, lte, ilike, gte, desc } from "drizzle-orm";
import { db } from "../db";
import { requests } from "../db/schema";
import { getDayRange } from "./helper.repo";
import {
  FindRequestsSchema,
  InsertRequestSchema,
  UpdateRequestSchema,
} from "@/lib/validation/requests";

export async function findRequests(filters: FindRequestsSchema) {
  const { id, user_id, fee, title, urgency, created_at } = filters;
  const conditions = [];

  // If the filter exists, use the filter for the query.
  if (id) conditions.push(eq(requests.id, id));
  if (user_id) conditions.push(eq(requests.user_id, user_id));
  if (fee) conditions.push(lte(requests.fee, fee));
  if (urgency) conditions.push(eq(requests.urgency, urgency));
  if (title) conditions.push(ilike(requests.title, `%${title}%`));
  if (created_at) {
    const { startOfDay, endOfDay } = getDayRange(created_at);
    conditions.push(gte(requests.created_at, startOfDay));
    conditions.push(lte(requests.created_at, endOfDay));
  }

  return await db.query.requests.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(requests.created_at)],
  });
}

export async function insertRequest(data: InsertRequestSchema) {
  return await db.insert(requests).values(data);
}

export async function deleteRequest(id: string) {
  return await db.delete(requests).where(eq(requests.id, id));
}

export async function updateRequest(id: string, data: UpdateRequestSchema) {
  return await db.update(requests).set(data).where(eq(requests.id, id));
}
