# Edit Entry Photo Display + Remove — Design

**Date:** 2026-05-24
**Cluster:** C (of 4 — see `project_session_ui_brainstorm_clusters.md`)
**Scope:** `components/app-pages/shared/cat-entry-form.tsx`, new `removeCatPhoto` server action.

## Problem

Opening the cat entry form in edit mode (`initialCat` provided) does not show the cat's existing photo in the upload area. The photo upload zone always renders the empty "Tap to upload photo" button, leaving the user with no signal that a photo already exists, and no way to remove the existing photo without uploading a replacement.

## Goal

- Show the existing photo in the upload preview area when editing a cat that already has one.
- Allow replacing the existing photo with a new upload (existing flow, just hooked into the new preview).
- Allow removing an existing photo entirely — sets `photo_url = null` and deletes the storage blob.

## Non-goals

- Multi-photo support.
- Photo cropping / editing UI.
- Reusing the upload action for any flow outside the cat entry form.

## Design

### 1. New action: `removeCatPhoto`

Added to [app/actions/cat-photo.ts](app/actions/cat-photo.ts):

```ts
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
```

Auth mirrors `uploadCatPhoto`. DB write is the source of truth — even if storage delete fails, the cat row reflects the user's intent.

### 2. New form state ([cat-entry-form.tsx](components/app-pages/shared/cat-entry-form.tsx))

```ts
const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(
  initialCat?.photo_url ?? null,
);
const [removedExisting, setRemovedExisting] = useState(false);
```

`photoFile` and `photoPreview` already exist and continue to represent a newly-selected file.

### 3. Preview display priority

In the photo section (currently lines 357-405), compute the effective photo to display:

```ts
const showPhoto =
  photoPreview ??
  (existingPhotoUrl && !removedExisting ? existingPhotoUrl : null);
```

Render rules:
- `showPhoto` truthy → render the image + Change/Remove overlay buttons (existing markup at lines 359-383, switch `<img src={photoPreview}>` to `<img src={showPhoto}>`).
- `showPhoto` falsy → render the "Tap to upload photo" button (lines 384-394).

### 4. Button handlers

**Change** — unchanged. Clicking opens the file picker; selecting a file calls `setPhotoFile(file)`.

**Remove** — new handler:

```ts
const handleRemovePhoto = () => {
  if (photoFile) {
    setPhotoFile(null);  // Drop the new upload; revert to existing photo if any
  } else if (existingPhotoUrl) {
    setRemovedExisting(true);  // Hide existing photo
  }
};
```

Wire the existing Remove `<button>` (line 376) to `handleRemovePhoto`.

### 5. Save handling (edit mode)

Inside the `initialCat` branch of `handleSave`, replace the existing `if (photoFile)` block with:

```ts
if (photoFile) {
  try {
    const fd = new FormData();
    fd.append("file", photoFile);
    await uploadCatPhoto(initialCat.id, fd);
  } catch (uploadErr) {
    setPhotoWarning(
      uploadErr instanceof Error
        ? `Cat saved, but photo upload failed: ${uploadErr.message}. Click Save to retry.`
        : "Cat saved, but photo upload failed. Click Save to retry.",
    );
    return;
  }
} else if (removedExisting && existingPhotoUrl) {
  await removeCatPhoto(initialCat.id);
}
```

`uploadCatPhoto` upserts, so it doesn't matter whether `removedExisting` was set when a new file is also queued — the new upload wins.

Removal is treated as best-effort: no retry warning loop. If `removeCatPhoto` throws (e.g. network), it surfaces in the existing outer `try/catch` and the user sees the standard error message. Storage-delete failure inside the action is already swallowed.

### 6. Edge case verification

| Scenario | Outcome |
|---|---|
| Open edit, no changes | Existing photo shown; save fires no photo action. |
| Replace photo (Change → pick) | `photoFile` set; save uploads, upserts blob. |
| Remove existing, no replacement | `removedExisting=true`; save calls `removeCatPhoto`. |
| Remove existing, then upload new | Upload path wins (`photoFile` set); single upload upserts. |
| Upload new, then click Remove | `photoFile` cleared; falls back to existing photo display; save fires no photo action. Net effect: unchanged. |
| Create mode (no `initialCat`) | `existingPhotoUrl=null`; `removedExisting` never set; existing create flow unchanged. |

### 7. Untouched behavior
- The `useEffect` that creates/revokes the `URL.createObjectURL` for `photoFile` stays.
- The photo-upload partial-failure retry flow (`photoWarning`, "Retry Photo" button label, `handleSkipPhoto`) stays. Applies only to the upload path; removal is a single shot.
- `setSavedCatId` and the create-mode photo retry path are unchanged.

## Risks / Open items

- Storage-side blob leak if `removeCatPhoto`'s `storage.remove` silently fails (rare; non-fatal). Could add a server-side log later — not in this pass.
- `existingPhotoUrl` is captured from `initialCat?.photo_url` at mount. If a different flow updates the cat's `photo_url` while this form is open, the form's notion of "existing" goes stale. Acceptable — same property as every other field on the form.
- Action authorization mirrors upload exactly; volunteers can remove photos only for cats linked to their own sessions, same as upload.

## Verification

- `pnpm tsc --noEmit` passes.
- Edit a cat that has a photo → existing photo visible in the preview area.
- Click Change → new file shown; save uploads; reload form → new photo shown.
- Click Remove on existing photo (no replacement) → upload zone reverts to empty button; save → reload shows no photo and `photo_url` is null in DB.
- Click Change then Remove (without saving) → existing photo visible again; save fires no photo action; nothing changed.
- Click Remove then Change → save uploads the new file; DB has new photo_url; old blob overwritten.
- Volunteer attempts to remove a photo on a cat outside their sessions → 403.

## Out of scope

- Clusters A, B, D — separate specs.
- Photo history / restore.
- Multi-photo gallery.
