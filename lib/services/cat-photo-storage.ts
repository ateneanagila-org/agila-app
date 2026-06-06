import { createAdminClient } from "@/lib/supabase/admin";

export const CAT_PHOTOS_BUCKET = "cat-photos";

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
 * Lists every object path in the bucket. Files live one level deep under
 * per-id prefixes (`<id>/photo.jpg`), so this lists root prefixes then each
 * prefix's objects.
 */
export async function listAllPhotoPaths(): Promise<string[]> {
  const supabase = await createAdminClient();
  const LIST_LIMIT = 100_000;

  const { data: prefixes, error: listErr } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .list("", { limit: LIST_LIMIT });
  if (listErr) throw new Error(`bucket list failed: ${listErr.message}`);
  if (!prefixes || prefixes.length === 0) return [];

  const paths: string[] = [];
  for (const prefix of prefixes) {
    const { data: files, error: subErr } = await supabase.storage
      .from(CAT_PHOTOS_BUCKET)
      .list(prefix.name, { limit: LIST_LIMIT });
    if (subErr) throw new Error(`list '${prefix.name}' failed: ${subErr.message}`);
    for (const f of files ?? []) paths.push(`${prefix.name}/${f.name}`);
  }
  return paths;
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
