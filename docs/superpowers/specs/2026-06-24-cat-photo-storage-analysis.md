# Cat Photo Storage — Long-Term Analysis

**Date:** 2026-06-24
**Companion to:** [2026-06-24-cat-photo-lightbox-crop-design.md](./2026-06-24-cat-photo-lightbox-crop-design.md)

## Grounded current state (measured)

- `cat-photos` bucket: **495 files, 116 MB** → **~240 KB average** per photo.
- Single bucket; all project storage is cat photos.
- 377 were the original import; ~118 added since (much of it dev/QA noise).
- **11% of the 1 GB free-tier cap used.**

## 1. What consumes storage — and what doesn't

- **Net-new photographed cats are the only thing that grows storage.** One blob
  per cat, one path (`${catId}/photo.jpg`), upsert.
- **Re-crops cost zero bytes** — editing is three DB numbers, no upload. This is
  the core value of the crop-as-metadata design.
- **Re-uploads cost zero net bytes** — upsert overwrites the same path.

Storage growth is driven by a single variable: the rate of new cats that get a
photo. Edits, re-frames, and replacements are all flat.

## 2. Runway model

Headroom: 1024 − 116 = **908 MB**. New-model blob ≈ 240–300 KB (normalized
1280px original, comparable to today's baked crop).

| New photographed cats / yr | @240 KB | @300 KB |
|---|---|---|
| 150 (low) | ~25 yr | ~20 yr |
| 400 (medium) | ~9.5 yr | ~7.5 yr |
| 800 (high) | ~4.7 yr | ~3.8 yr |

**Storage is not an imminent threat.** Even aggressive intake buys ~4 years;
realistic regional-TNR intake buys 8–25.

## 3. What the design choice bought

The rejected two-blob approach (original + baked, ~540 KB/cat) would have **halved**
every figure above — medium intake from ~9.5 yr to ~4.5 yr. Crop-as-metadata
roughly **doubles the runway** at no quality cost. This decision matters more to
longevity than any compression tuning.

## 4. The constraint that likely bites first: egress, not storage

Supabase free tier also caps **bandwidth (~5 GB/mo)**, and the app serves images
via `unoptimized` Next `<Image>` — the **full 240 KB original ships even for an
80px thumbnail**. A 50-cat list view ≈ 12 MB. Heavy daily multi-user list loads
can approach the egress cap well before storage fills (browser/CDN caching
softens but doesn't remove the structural waste).

- The metadata model is **neutral** here — thumbnails fetch the same full blob
  they do today (crop is CSS, not a smaller file). No regression, no improvement.
- This is the more probable near-term wall and is invisible until hit.

## 5. Slow leaks over years

- **Orphaned blobs.** Merges reassign paths; merge-losers and region/bulk deletes
  leave blobs only `reconcileCatPhotos` (Admin → Reclaim orphaned photos)
  reclaims. If never run, orphans silently eat headroom.
- **Dead-cat retention.** Deceased/Adopted/MIA cats keep photos forever — no
  pruning policy. A growing share of bytes will be inactive cats. Slow but
  monotonic.

## 6. Mitigation levers (ranked by effort-to-impact)

1. **Lower quality / max dimension** — 1280→1024 px, q80→q72 cuts ~35–40% per
   blob. One-line change in `uploadCatPhoto`; can batch-recompress the existing
   495. Cheapest, biggest lever.
2. **Run the orphan GC on a cadence** — reclaims merge/delete leaks. Already
   built; just needs to actually run.
3. **Thumbnail tier for lists** (egress lever) — derive a ~15 KB thumb, serve it
   in lists, full original only in lightbox/detail. ~+8 MB total, slashes egress.
   The metadata model makes this easy to add later. Defer until egress bites.
4. **Prune long-deceased cats' photos** — policy decision, modest recovery.
5. **Upgrade to Supabase Pro (100 GB)** — ultimate backstop, but conflicts with
   the non-technical-handoff reality (stewards can't manage billing). Engineering
   levers 1–3 matter far more.

## 7. Recommendations (handoff-aware)

- **Add a storage gauge to the Admin tab** — "X MB / 1024 MB used" from
  `storage.objects`. Stewards can't run SQL; if it's operationally necessary to
  see, it must be self-serve. Warn at 80% (819 MB), critical at 92%.
- **Tune compression deliberately now** — recommend 1280px / q80 as specced;
  revisit to 1024/q72 only if the gauge climbs. Picking once avoids a painful
  batch-recompress later.
- **Make the GC sweep a habit** — note it in the Admin GSheet Config section.
- **Watch egress as the real near-term ceiling.** If hit, lever #3 (thumbnails)
  is the fix and the metadata model sets you up for it.

## Bottom line

The metadata design keeps storage on a flat, single-blob curve with a
multi-year-to-decade runway, and doubles what the naive approach would give.
Storage won't be the thing that breaks — egress might, and orphan-GC neglect is
the silent creeper. An Admin storage gauge + a deliberate compression setting are
the two cheap moves that de-risk the long term.
