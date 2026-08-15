"use server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { cats, sessionCats, sessionUsers } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, hasRole, MANAGER_OR_ADMIN } from "@/lib/auth/rbac";
import { AppError } from "@/lib/error/app-error";
import type { AuthRole } from "@/lib/db/enums";
import { refreshCatInSyncQueue } from "@/lib/services/helper.service";
import { normalizeRotation } from "@/lib/photo-position";
import * as catsRepo from "@/lib/repo/cats.repo";
import {
  photoStoragePath,
  removeCatPhotoObjects,
} from "@/lib/services/cat-photo-storage";

const BUCKET = "cat-photos";

/** Auth gate shared by all photo mutations: Manager/Admin for any cat, or a
 * volunteer who owns a session_cats row joined to a session they belong to. */
async function assertCanEditCatPhoto(catId: string) {
  const current = await requireAuth();
  if (hasRole(current.profile.auth_role as AuthRole, ...MANAGER_OR_ADMIN)) {
    return;
  }
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

/** Parse + clamp a position from FormData (zoom 1..3, offsets ±2000, rotation 0|90|180|270). */
function readPosition(formData: FormData) {
  const num = (v: FormDataEntryValue | null, fallback: number) => {
    const n = typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };
  const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, v));
  // Offsets are percentages of the frame and legitimately exceed 100 for zoomed
  // non-square images (bounds grow with aspect × zoom). The renderer re-clamps to
  // the true per-image bounds, so this is only an abuse guard against absurd values.
  return {
    photo_zoom: clamp(num(formData.get("photo_zoom"), 1), 1, 3),
    photo_offset_x: clamp(num(formData.get("photo_offset_x"), 0), -2000, 2000),
    photo_offset_y: clamp(num(formData.get("photo_offset_y"), 0), -2000, 2000),
    photo_rotation: normalizeRotation(num(formData.get("photo_rotation"), 0)),
  };
}

/**
 * Uploads a cat photo to Supabase storage and updates cats.photo_url. The blob
 * is the full normalized original (NOT cropped) — the crop is stored as the
 * photo_zoom/offset trio applied at render time. Accepts FormData with `file`
 * (image) and optional `photo_zoom`/`photo_offset_x`/`photo_offset_y`.
 *
 * Auth: Manager/Admin for any cat; volunteers only for their own session entries.
 */
export async function uploadCatPhoto(
  catId: string,
  formData: FormData,
): Promise<{ photo_url: string }> {
  await assertCanEditCatPhoto(catId);

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new AppError("No file provided", 400);
  }
  if (!file.type.startsWith("image/")) {
    throw new AppError("File must be an image", 400);
  }

  const position = readPosition(formData);

  const raw = Buffer.from(await file.arrayBuffer());
  // Normalize only — rotate + downscale, never crop. The crop lives in metadata.
  const compressed = await sharp(raw)
    .rotate()
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
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

  await db.transaction(async (tx) => {
    await tx
      .update(cats)
      .set({ photo_url: bustedUrl, ...position })
      .where(eq(cats.id, catId));
    // Queue a forward sync so the new photo reaches the sheet. No last_updated_at
    // bump: photo is app-owned and must not suppress reverse-sync of text edits.
    await refreshCatInSyncQueue(catId, tx);
  });

  return { photo_url: bustedUrl };
}

/**
 * Re-crop an existing photo by updating only the position trio. No storage
 * write, no photo_url change, and no sync queue — position is app-only metadata
 * that never reaches the sheet (which always shows the uncropped original).
 * Lossless and instant.
 */
export async function editCatPhotoPosition(
  catId: string,
  position: {
    zoom: number;
    offsetX: number;
    offsetY: number;
    rotation: number;
  },
): Promise<void> {
  await assertCanEditCatPhoto(catId);

  const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, Number.isFinite(v) ? v : 0));

  // ±2000 is an abuse guard only; offsets legitimately exceed 100 for zoomed
  // non-square images and the renderer re-clamps to true per-image bounds.
  await db
    .update(cats)
    .set({
      photo_zoom: clamp(position.zoom, 1, 3),
      photo_offset_x: clamp(position.offsetX, -2000, 2000),
      photo_offset_y: clamp(position.offsetY, -2000, 2000),
      photo_rotation: normalizeRotation(position.rotation),
    })
    .where(eq(cats.id, catId));
}

export async function removeCatPhoto(catId: string): Promise<void> {
  await assertCanEditCatPhoto(catId);

  const clearedPhotoUrl = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ photo_url: cats.photo_url })
      .from(cats)
      .where(eq(cats.id, catId))
      .limit(1);

    await tx
      .update(cats)
      .set({
        photo_url: null,
        photo_zoom: 1,
        photo_offset_x: 0,
        photo_offset_y: 0,
        photo_rotation: 0,
      })
      .where(eq(cats.id, catId));

    // Queue a forward sync so the cleared photo reaches the sheet. No
    // last_updated_at bump (see uploadCatPhoto).
    await refreshCatInSyncQueue(catId, tx);

    return existing?.photo_url ?? null;
  });

  // Best-effort, reference-aware storage cleanup AFTER commit. The path is
  // derived from photo_url, never from catId: a merge can leave this cat
  // pointing at a duplicate's object. Only remove an object no remaining cat
  // references. Never throws — the GC sweep (reconcileCatPhotos) is the net.
  const path = photoStoragePath(clearedPhotoUrl);
  if (path) {
    const stillReferenced = await catsRepo.findCatsReferencingPhotoPaths([path]);
    if (stillReferenced.length === 0) await removeCatPhotoObjects([path]);
  }
}
