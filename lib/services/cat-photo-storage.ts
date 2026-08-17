import { createAdminClient } from "@/lib/supabase/admin";
import { CAT_PHOTOS_BUCKET } from "@/lib/constants";
import { findAllPhotoObjectPaths } from "@/lib/repo/storage.repo";

export { CAT_PHOTOS_BUCKET };

/**
 * Bucket-relative object path from a public photo URL (strips the cache-bust
 * `?v=` suffix). photo_url looks like:
 *   https://<proj>.supabase.co/storage/v1/object/public/cat-photos/<id>/photo.jpg?v=123
 * Returns `<id>/photo.jpg`, or null if the URL isn't a bucket object.
 *
 * NOTE: the path is NOT always `${catId}/photo.jpg` for the owning cat — a merge
 * can reassign a duplicate's photo_url to the surviving target, so the path may
 * point at a different cat's prefix. Always derive it from photo_url, never from
 * the cat id.
 */
export function photoStoragePath(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const marker = `/object/public/${CAT_PHOTOS_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = url.slice(i + marker.length).split("?")[0];
  return path || null;
}

/**
 * Every object path in the bucket (`<catId>/photo.jpg`).
 *
 * Reads `storage.objects` in one query rather than walking the Storage API.
 * The API cannot list recursively, so the previous implementation issued one
 * call per prefix — one per cat. At 502 cats that measured ~81 seconds of
 * sequential round-trips: slow but harmless locally, and fatal on Vercel,
 * where the serverless function is killed first. That is why "Reclaim orphaned
 * photos" worked in development and silently failed in production.
 *
 * Cost is now independent of colony size. See __tests__/services/photo-gc.test.ts,
 * which pins that property.
 */
export async function listAllPhotoPaths(): Promise<string[]> {
  return await findAllPhotoObjectPaths();
}

/**
 * Best-effort, batched removal of storage objects. Never throws — a leaked blob
 * is preferable to a failed delete that aborts the surrounding flow. De-dupes
 * input and returns the number of objects successfully removed.
 */
export async function removeCatPhotoObjects(paths: string[]): Promise<number> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return 0;

  const REMOVE_BATCH = 1000;
  let removed = 0;
  try {
    const supabase = await createAdminClient();
    for (let i = 0; i < unique.length; i += REMOVE_BATCH) {
      const slice = unique.slice(i, i + REMOVE_BATCH);
      const { error } = await supabase.storage
        .from(CAT_PHOTOS_BUCKET)
        .remove(slice);
      if (error) {
        console.error("[CatPhotoStorage] remove batch failed (non-fatal):", error.message);
        continue;
      }
      removed += slice.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[CatPhotoStorage] cleanup threw (non-fatal):", msg);
  }
  return removed;
}
