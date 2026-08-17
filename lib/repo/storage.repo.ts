import { eq, sql } from "drizzle-orm";
import { db, type Transaction } from "@/lib/db";
import { storageObjects } from "@/lib/db/schema";
import { CAT_PHOTOS_BUCKET } from "@/lib/constants";

type DB = typeof db | Transaction;

/**
 * Total bytes stored in the cat-photos bucket.
 *
 * Supabase records object size in metadata->>'size'. coalesce covers an empty
 * bucket, where sum() returns NULL rather than 0.
 */
export const sumPhotoStorageBytes = async (client: DB = db): Promise<number> => {
  const [row] = await client
    .select({
      bytes: sql<string>`coalesce(sum((${storageObjects.metadata}->>'size')::bigint), 0)::text`,
    })
    .from(storageObjects)
    .where(eq(storageObjects.bucket_id, CAT_PHOTOS_BUCKET));

  return Number(row?.bytes ?? 0);
};

/**
 * Every object path in the cat-photos bucket, e.g. `<catId>/photo.jpg`.
 *
 * One query regardless of bucket size. The Storage API alternative cannot list
 * recursively — it needs one call per prefix, which is one call per cat — so
 * the GC scan used to cost 500+ sequential round-trips (~81s measured) and was
 * killed by the serverless execution limit in production while completing
 * happily on a developer machine.
 *
 * Reads the same `storage.objects` table `sumPhotoStorageBytes` above already
 * depends on, so this adds no coupling that was not already load-bearing.
 * Verified against live data: identical to the API listing, 502/502 paths, no
 * placeholder rows.
 */
export const findAllPhotoObjectPaths = async (
  client: DB = db,
): Promise<string[]> => {
  const rows = await client
    .select({ name: storageObjects.name })
    .from(storageObjects)
    .where(eq(storageObjects.bucket_id, CAT_PHOTOS_BUCKET));

  return rows
    .map((r) => r.name)
    .filter((n): n is string => n !== null && n.length > 0);
};
