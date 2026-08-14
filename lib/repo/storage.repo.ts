import { eq, sql } from "drizzle-orm";
import { db, type Transaction } from "@/lib/db";
import { storageObjects } from "@/lib/db/schema";
import { CAT_PHOTOS_BUCKET } from "@/lib/services/cat-photo-storage";

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
