"use server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { cats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, MANAGER_OR_ADMIN } from "@/lib/auth/rbac";
import { AppError } from "@/lib/error/app-error";

const BUCKET = "cat-photos";

/**
 * Uploads a cat photo to Supabase storage and updates cats.photo_url.
 * Accepts FormData with field `file` (image). Requires Manager or Admin role.
 */
export async function uploadCatPhoto(
  catId: string,
  formData: FormData,
): Promise<{ photo_url: string }> {
  await requireRole(...MANAGER_OR_ADMIN);

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
