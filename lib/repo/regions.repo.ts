import { db } from "../db";
import { regions } from "../db/schema";
import { eq } from "drizzle-orm";

export const findRegions = () =>
  db.select({ id: regions.id, name: regions.name }).from(regions);

export const findRegionById = (id: string) =>
  db.query.regions.findFirst({ where: (r, { eq }) => eq(r.id, id) });

export type RegionOption = Awaited<ReturnType<typeof findRegions>>[number];
