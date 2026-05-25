"use server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { cats, sessionCats, sessionUsers } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, hasRole, MANAGER_OR_ADMIN } from "@/lib/auth/rbac";
import { AppError } from "@/lib/error/app-error";
import type { AuthRole } from "@/lib/db/enums";

const BUCKET = "cat-photos";

/**
 * Uploads a cat photo to Supabase storage and updates cats.photo_url.
 * Accepts FormData with field `file` (image).
 *
 * Auth: Manager/Admin can upload for any cat. Volunteers can only upload
 * for cats linked (via session_cats) to a session they belong to (via
 * session_users) — i.e. their own session entries.
 */
export async function uploadCatPhoto(
  catId: string,
  formData: FormData,
): Promise<{ photo_url: string }> {
  const current = await requireAuth();
  if (!hasRole(current.profile.auth_role as AuthRole, ...MANAGER_OR_ADMIN)) {
    const owned = await db
      .select({ id: sessionCats.id })
      .from(sessionCats)
      .innerJoin(sessionUsers, eq(sessionUsers.session_id, sessionCats.session_id))
      .where(
        and(
          eq(sessionCats.cat_id, catId),
          eq(sessionUsers.user_id, current.user.id),
        ),
      )
      .limit(1);
    if (owned.length === 0) {
      throw new AppError("Forbidden: not your cat entry", 403);
    }
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new AppError("No file provided", 400);
  }
  if (!file.type.startsWith("image/")) {
    throw new AppError("File must be an image", 400);
  }

  const raw = Buffer.from(await file.arrayBuffer());
  const compressed = await sharp(raw)
    .rotate()
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  const supabase = await createAdminClient();
  const storagePath = `${catId}/photo.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, compressed, {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (uploadError) {
    throw new AppError(`Upload failed: ${uploadError.message}`, 500);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  // cache-bust since upsert reuses the same path
  const bustedUrl = `${publicUrl}?v=${Date.now()}`;

  await db
    .update(cats)
    .set({ photo_url: bustedUrl, last_updated_at: new Date() })
    .where(eq(cats.id, catId));

  return { photo_url: bustedUrl };
}

export async function removeCatPhoto(catId: string): Promise<void> {
  const current = await requireAuth();
  if (!hasRole(current.profile.auth_role as AuthRole, ...MANAGER_OR_ADMIN)) {
    const owned = await db
      .select({ id: sessionCats.id })
      .from(sessionCats)
      .innerJoin(sessionUsers, eq(sessionUsers.session_id, sessionCats.session_id))
      .where(
        and(
          eq(sessionCats.cat_id, catId),
          eq(sessionUsers.user_id, current.user.id),
        ),
      )
      .limit(1);
    if (owned.length === 0) {
      throw new AppError("Forbidden: not your cat entry", 403);
    }
  }

  const supabase = await createAdminClient();
  // Storage delete is best-effort — orphaned blob is acceptable.
  await supabase.storage.from(BUCKET).remove([`${catId}/photo.jpg`]);

  await db
    .update(cats)
    .set({ photo_url: null, last_updated_at: new Date() })
    .where(eq(cats.id, catId));
}
