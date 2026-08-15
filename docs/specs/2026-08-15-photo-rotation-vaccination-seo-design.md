# P4 — Photo Rotation, Vaccination Visibility & Basic SEO

**Date:** 2026-08-15
**Status:** Design approved, pending implementation plan
**Scope:** Finalization items — photo rotation, vaccination expiry warning, basic SEO

## Context

Last of four sub-projects in the finalization effort.

| Phase | Contents |
| ----- | -------- |
| P1 (done) | Fix Admin screen; repair region adding/deleting |
| P2 (done) | Admin-editable referral links; in-app bug reports |
| P3 (done) | Sync killswitch; storage gauge; decommissioning runbook |
| **P4** (this) | Photo rotation; vaccination visibility; basic SEO |
| Spike | Stats mismatch/drift — diagnose live before speccing |

The three items are independent. They share a phase because each is small, not
because they interact.

## Problem

### 1. A sideways photo cannot be corrected in the app

Upload already applies EXIF orientation — `sharp(raw).rotate()` in
`app/actions/cat-photo.ts`. That covers phone photos, which carry an orientation
tag.

It does not cover images with absent or wrong EXIF: screenshots, re-saved files,
and the photos pulled in through the sheet import path. For those the stored blob
is genuinely sideways, and the only remedy today is to rotate the file outside the
app and re-upload it.

### 2. The vaccination data cannot support an expiry warning

The original item was a per-cat "vaccination expired" warning. A spike against the
live database says that feature should not be built. The evidence:

| Fact | Number |
| ---- | ------ |
| Cats with any `vaccination_date` | 71 of 586 (12%) |
| Of those, date identical to the neuter date | 68 of 71 |
| Of those, already older than 12 months | 59 of 71 |
| Live cats (not Adopted/Deceased/MIA) with no date | 293 of 351 (83%) |
| Overdue **and** seen within 6 months | 3 |
| Never recorded **and** seen within 6 months | 71 |

Three independent findings, each sufficient on its own:

**There is no vaccine identity.** One untyped column, `cat_health_records.vaccination_date`,
fed by sheet col Q ("Date of Vaccination"). Rabies and FVRCP carry different
intervals, and a primary dose differs from a booster. Any interval the app picks is
a guess presented as a clinical fact.

**It is a TNVR event date, not a vaccination record.** 68 of 71 rows equal the
neuter date — trap-neuter-vaccinate-return clinic days written into two columns.
"Expiry" is the wrong verb for that value.

**A badge would invert the signal.** It can only render where a date exists, so the
71 best-documented cats would be flagged while the 293 undocumented ones read as
fine. 59 would flag on first load. The feature would punish record-keeping and
manufacture alarm fatigue.

A related defect surfaced during the spike: the public catalog renders
`Vaccinated: Yes/No` from `!!vaccination_date`
(`components/app-pages/catalog/catalog-detail-screen.tsx:129`). Absence therefore
already displays to adopters as a definite "No" for ~83% of live cats. That is an
outward-facing claim derived from missing data, and it is the higher-stakes half of
this item.

### 3. The public catalog is invisible to search engines

The adoption catalog is the app's only public surface, and it has no SEO
foundation:

- Both public screens are `"use client"` with `useEffect` fetches, so a crawler
  receives an empty body — no cat names, no descriptions.
- A missing or non-adoptable cat renders **HTTP 200 with an empty page**: a
  soft-404, which search engines penalise more than a real 404.
- No `sitemap.ts`, no `robots.ts`. Nothing prevents `/dashboard`, `/login`, or
  `/api` from being crawled.
- No `metadataBase`, no OpenGraph or Twitter tags, so shared links render bare.
- `app/(public)/catalog/[id]/page.tsx` has no `generateMetadata`, so every cat page
  shares the site-wide default title.

### 4. The health endpoint is an unauthenticated database call

An audit of the public attack surface, run while scoping the SEO work, found the
server actions sound and one API route not.

**The actions are correctly gated.** There is a single `actionClient` with no auth
middleware, so every action must gate itself in its body — and every one does.
All 40 actions across the eight files in `app/actions/` open with `requireAuth()`
or `requireRole(...)`. The only two exceptions are deliberate and documented:
`getAdoptableCats` and `getAdoptableCatHealthRecord`, which force
`is_adoptable: true` server-side, and the latter confirms the parent cat is
adoptable before exposing any health data.

**`/api/cron/sync` is gated** by a `CRON_SECRET` bearer token and fails closed when
the variable is unset. It compares with `!==`, which is not constant-time.

**`/api/health` is the actual gap.** It is unauthenticated and:

- **executes `SELECT 1` on the shared pool for every caller.** P3 raised
  `max` to 12 to stop the Admin page exhausting it during builds; an unauthenticated
  endpoint that consumes a connection per request can exhaust that same pool from
  outside, taking the app down without any credential.
- **returns the raw database error message** on failure. Postgres connection errors
  routinely carry the host, port, and database name, so a caller can induce and read
  infrastructure detail from an endpoint that requires nothing.

## Scope

**In:** a rotation control on the photo editor; three read-only vaccination
surfaces; metadata, sitemap, robots, a real 404 page, a server-rendered catalog
detail page; and hardening the health endpoint.

**Out:**

- **A per-cat vaccination expiry badge or chip.** Rejected on the evidence above.
- **Auto-creating interventions from vaccination dates.** A `Pending` intervention
  is not an app-local flag: `getInterventionDisplayStatus` writes it into sheet col
  U, and it places the cat on the "For RI" summary sheet, which is the rescue
  worklist volunteers work from. The feature would add 59 cats to AGILA's
  operational queue overnight on data the spike found unreliable. It also has no
  provenance column to separate machine inference from human intent, needs
  idempotency state to survive cron ticks, and would write during sync, colliding
  with P3's freeze and retirement gates.
- **Adding a vaccine-type or `is_vaccinated` column.** Sheet cols A–V are fully
  occupied (`S` separator, `T/U/V` auto-written, `W/X` Apps Script, `Y` UUID), so
  this means shifting the column contract through the sync engine, the Apps Script,
  and the parsers. Noted for the handoff guide, not built here.
- **Server-rendering the catalog listing grid.** Search, filter, and sort make it
  interactive throughout. Its SEO value is as a link index, which the sitemap
  already supplies directly.
- **JSON-LD / structured data, and generated OG images.**
- **Migrating the nine local `formatDate` copies.** Carried over from P3's
  out-of-scope note.
- **Fixing the pre-existing `db.*` layering violations.** `app/actions/cat-photo.ts`
  already calls `db.*` directly. Rotation extends that file in place rather than
  adding a new violation or refactoring it. Consistent with P2's ruling.

## Design

### 1. Photo rotation

Rotation follows the crop-as-metadata precedent exactly: a fourth stored field,
with all geometry in `lib/photo-position.ts`, shared by the editor preview and the
display so what you frame is what renders. The stored blob is never re-encoded, and
rotation never reaches the sheet — the sheet keeps showing the uncropped, unrotated
original, consistent with the existing invariant.

**Schema.** `cats.photo_rotation`, `integer`, `notNull`, `default 0`, constrained by
the app to `0 | 90 | 180 | 270`. Existing rows take `0`, which is identity, so no
rendering changes for any current photo. Applied with `pnpm drizzle-kit push`.

**Geometry.** `PhotoPosition` gains `rotation`. The affected functions:

| Function | Change |
| -------- | ------ |
| `DEFAULT_PHOTO_POSITION` | gains `rotation: 0` |
| `isIdentityPosition` | also requires `rotation === 0` |
| `positionFromCat` | reads `cat.photo_rotation ?? 0` |
| `getOffsetBounds` | computes against the **effective** image size |
| `getPhotoTransformStyle` | sizes from the effective size; appends `rotate(...)` |

**Effective size** is the post-rotation footprint: for `90` and `270` the image's
width and height swap; for `0` and `180` they do not. Bounds and the
landscape/portrait fill decision both use the effective size, while the CSS
`width`/`height` are assigned to the element's own pre-rotation axes. Transform
order is `translate(-50%, -50%) scale(z) rotate(r)` — CSS applies these
right-to-left, so the image rotates about its centre, then scales, then centres.

The invariant the tests pin, rather than the intermediate arithmetic: **at zoom 1,
a rotated image still fully covers the square frame with no letterboxing**, for all
four rotations and for both landscape and portrait sources.

**Drag axes need no remapping.** An earlier draft of this spec called for a
`rotateDelta` helper on the assumption that a rightward drag stops mapping to
`+offsetX` once rotated. Working the geometry through shows it does not:
`offsetX`/`offsetY` drive the element's `left`/`top` **within the frame**, while
rotation is a `transform` about the element's own centre. Moving `left` moves the
whole rotated element in frame space, so a rightward drag still means `+offsetX` at
every angle. The helper would have introduced a bug, not fixed one. Only the
**bounds** need the effective size, because the overflow available to pan through
does change with rotation.

**Persistence.** `app/actions/cat-photo.ts` carries position as FormData. Rotation
joins as a `photo_rotation` field, parsed and normalised alongside the existing
`photo_zoom` / `photo_offset_x` / `photo_offset_y` trio: any value not in the four
allowed angles falls back to `0`. The position-update path and the `catSelect`
projection in `lib/repo/cats.repo.ts` both gain the column.

**One easy-to-miss case:** clearing a photo resets `photo_zoom`, `photo_offset_x`,
and `photo_offset_y` to identity (`app/actions/cat-photo.ts:157`). It must reset
`photo_rotation` too, or a new photo inherits the old one's rotation.

**UI.** Two buttons — rotate left, rotate right — beside the Zoom slider in
`PhotoPositionEditor`, each stepping 90° and wrapping. Because `isIdentityPosition`
now accounts for rotation, unrotated photos keep the `next/image` fast path in
`CatPhoto` and only rotated ones take the positioned-`<img>` path.

### 2. Vaccination visibility

No schema change. Every surface reads; nothing writes, nothing syncs, no cron.

A new pure module, `lib/vaccination.ts`, holds the threshold in exactly one place:

```ts
export const VACCINATION_EXPIRY_MONTHS = 12;
export type VaccinationState = "unknown" | "vaccinated" | "expired";
export function getVaccinationState(date: Date | null, now?: Date): VaccinationState;
export function formatMonthsAgo(date: Date, now?: Date): string; // "14 months ago"
```

`now` is an injected parameter so the tests are deterministic.

**State naming.** `unknown` / `vaccinated` / `expired` — the domain's own vocabulary,
and `unknown` matches `displayCatField` and the `[...CAT_*_VALUES, "Unknown"]`
pattern every other filter already follows. The naming is deliberate on both ends:
`unknown` never implies "not vaccinated" for the 83% of live cats with no date, and
`expired` describes a record that has passed AGILA's own 12-month TNVR convention.

Three consumers:

| Surface | Change |
| ------- | ------ |
| `database-medical-screen.tsx` | a muted relative-age line under the existing Vaccination Date field — "recorded 14 months ago" |
| `lib/hooks/filter-sort-configs.ts` | a `Vaccination` filter on `DATABASE_LIST_CONFIG`: `Vaccinated` / `Expired` / `Unknown` |
| `catalog-detail-screen.tsx:129` | the `Vaccinated` row becomes tri-state |

The filter needs one derived field added to `addMedicalAndInterventionInfo` in
`database-list-screen.tsx`. No new query: `loadFilterData` already fetches every
health record and merges it into the cat rows.

**The rule this item is built on:** `expired` is a state label in a data row and a
filter option — never a red alarm chip, never a per-cat clinical verdict rendered
over the cat's photo. That distinction is what the spike rejected, and it survives
the rename. The medical screen states elapsed time as fact and draws no conclusion.
The 12-month convention lives in `VACCINATION_EXPIRY_MONTHS` alone.

### 3. Basic SEO

**Root layout** (`app/layout.tsx`) gains `metadataBase` from `NEXT_PUBLIC_SITE_URL`
— already defined and used by `app/auth/callback/route.ts` — plus default
`openGraph` and `twitter` blocks. The existing title template and description stay.

**The catalog detail page becomes a server component.** This is the item's core, and
it is mostly deletion: the only interactive element in the 287-line screen is
`CatPhotoButton`, which is already an independent client component in
`photo-lightbox`. The three `useState` calls, the `useCallback`, and the `useEffect`
exist solely to fetch and track loading.

```
app/(public)/catalog/[id]/page.tsx
  getCat(id)  ← cache()-wrapped repo.findAdoptableCats({ id, is_adoptable: true })
     ├── generateMetadata()   title, description, cat photo as OG image
     └── page component       → <CatalogDetailScreen cat={…} healthRecord={…} />
                                 (no "use client", no fetch, no loading branch)
```

`cache()` dedupes the fetch between `generateMetadata` and the page body, so the
data is read once per request. A missing or non-adoptable cat calls `notFound()`,
replacing the current soft-404 with a real 404. The loading-spinner flash
disappears as a side effect.

The listing page is untouched and stays client-rendered.

**`app/sitemap.ts`** returns `MetadataRoute.Sitemap` — the home page plus one entry
per adoptable cat, each carrying `lastModified` from `cats.last_updated_at`.
Non-adoptable cats are excluded — they are not adoption content and their detail
pages `notFound()` anyway.

**`app/robots.ts`** returns `MetadataRoute.Robots`, allowing the public catalog and
disallowing `/dashboard`, `/login`, and `/api`, with `sitemap` pointing at the
generated sitemap.

**API verification (Next 16.1.1 / React 19.2.3, checked against the installed
packages rather than documentation):** `MetadataRoute.Sitemap` and
`MetadataRoute.Robots` both exist in
`next/dist/lib/metadata/types/metadata-interface.d.ts`; `metadataBase` is a current
`Metadata` field; `params` is already `Promise`-wrapped in this codebase, matching
Next 15+; and `cache` is exported by React 19. No deprecated API is used.

### A real 404 page

`app/not-found.tsx` does not exist, so an unmatched route currently renders Next's
default unstyled page. The `notFound()` call added above makes this reachable far
more often, so the page is part of this item rather than a nicety.

It mirrors `app/error.tsx` closely — same centred card, same logo treatment, same
brand tokens, same typographic rhythm — with three deliberate differences:

- the eyebrow reads `404` rather than `Error`, and the heading `Page not found`
- **no "Try again" button.** `reset()` exists because an error boundary can retry;
  a 404 has nothing to retry, and a dead button on a dead page is worse than none.
- **no Supabase session check and no "Sheets (Backup)" link.** That check is what
  makes `error.tsx` a client component. A 404 is not a crash — the app is healthy —
  so the page stays a static server component with no client JS and no database
  read. Crawlers and scanners hit 404s constantly; this path must stay cheap.

`Back home` is the single action.

### 4. Health endpoint hardening

Two changes, both small, neither altering the endpoint's contract with the
Cloudflare Worker that calls it before each cron tick.

**Stop leaking the error.** On failure the route returns `{ status: "unhealthy" }`
with `503` and logs the underlying message server-side. The worker only branches on
the status code, so nothing downstream needs the string.

**Stop the unauthenticated pool consumption.** The route keeps its `SELECT 1` — a
health check that does not touch the database is not a health check — but the
result is cached briefly (10 seconds) so a flood of requests collapses to at most
one query per window. The worker polls once per tick and is unaffected.

`/api/cron/sync` moves to a constant-time comparison via `crypto.timingSafeEqual`,
guarding the length check first since `timingSafeEqual` throws on mismatched
buffers. This is defence-in-depth rather than a live vulnerability — remote timing
attacks against a hosted endpoint are impractical — but it is a few lines and
removes the question permanently.

**Not changed:** the middleware still only refreshes the Supabase session and does
not gate routes. Route protection lives in `(protected)/layout.tsx` and the
per-action `requireRole` calls, which the audit confirms are applied consistently.
Adding a second enforcement point would duplicate a boundary that is already
correct.

### Error handling

Each item degrades rather than failing loudly:

- A rotation value outside the four allowed angles normalises to `0`.
- `getPhotoTransformStyle` keeps its existing behaviour of falling back to plain
  centred cover until the natural image size is known.
- A null `vaccination_date` is the `none` state, not an error.
- `generateMetadata` falls back to the site-wide default title if the cat read
  fails, so a database blip degrades the page's title rather than 500-ing it.
- `sitemap.ts` returns the static entries alone if the cat query fails.

## Testing

Automated (Jest, `testEnvironment: "node"`, mocked seams):

| Area | Assertion |
| ---- | --------- |
| `photo-position` | At zoom 1, all four rotations fully cover the square frame — landscape and portrait sources |
| `photo-position` | `isIdentityPosition` is false when rotation is non-zero and zoom/offsets are identity |
| `photo-position` | `getOffsetBounds` swaps width and height at 90° and 270°, and does not at 0° and 180° |
| `clampPosition` | Preserves `rotation` — it is not part of the clamp, and dropping it would silently reset the angle on every drag |
| `positionFromCat` | A null `photo_rotation` reads as `0` |
| `getVaccinationState` | A date inside 12 months is `vaccinated`; outside is `expired`; null is `unknown` |
| `getVaccinationState` | Exactly 12 months is `vaccinated`, not `expired` — the boundary is closed |
| `formatMonthsAgo` | Singular at one month; plural otherwise |
| `/api/health` | A failing database read returns 503 without the underlying error string in the body |
| `/api/health` | A second call inside the cache window does not issue a second query |
| `/api/cron/sync` | A wrong, absent, or malformed token returns 401; a correct one proceeds |

UI is not unit-tested, matching the rest of the codebase. UI verification is
`pnpm tsc --noEmit`, `pnpm lint`, and the manual checks below.

Manual:

1. Rotate a landscape photo through all four angles — confirm it covers the frame
   at every step and that dragging moves it the direction pushed.
2. Repeat with a portrait photo.
3. Rotate, save, reload — confirm the rotation persists and the display matches the
   editor preview exactly.
4. Delete a rotated photo, upload a new one — confirm the new photo is unrotated.
5. Confirm the sheet's col B photo is unchanged after a rotation.
6. Filter the database list by each of the three vaccination states — confirm the
   counts are plausible against the spike numbers.
7. Open a cat with no vaccination date in the public catalog — confirm it reads
   `Unknown`, not `No`.
8. Request a non-adoptable cat's catalog URL — confirm a real 404 status, not a
   200, and that the styled 404 page renders.
9. Request a nonsense route — confirm the same page appears rather than Next's
   default.
10. Check a cat page's rendered `<title>` and OG tags in view-source.
11. Fetch `/sitemap.xml` and `/robots.txt` — confirm adoptable cats are listed and
    `/dashboard` is disallowed.
12. Confirm the Cloudflare Worker's health poll and cron tick still succeed
    end-to-end after the endpoint changes.

## Risks

- **Rotation geometry is the one genuinely tricky part of this phase.** Getting the
  effective-size swap wrong produces letterboxing or overflow that looks correct at
  0° and 180° and breaks only at 90° and 270°. The cover invariant is tested for all
  four angles precisely because the failure is orientation-specific.
- **The editor preview and the display can drift.** They share
  `getPhotoTransformStyle`, so they stay in agreement only as long as neither grows
  its own geometry. Any future change belongs in `lib/photo-position.ts`.
- **The vaccination threshold is a convention, not a clinical fact.** 12 months is a
  worklist heuristic reflecting AGILA's annual TNVR cadence, not a titre. It is
  confined to `VACCINATION_EXPIRY_MONTHS`. The word `expired` is load-bearing in the
  UI, so the constraint that keeps it honest is presentational: it appears as a
  neutral state label and a filter option, never as an alarm styling that implies
  the app has assessed the animal. If a vaccine-type field ever arrives, this is the
  single place to revisit.
- **Server-rendering only the detail page leaves the catalog half-indexed.**
  Deliberate: content ranking happens on detail pages and the sitemap supplies
  discovery. If the listing's own ranking ever matters, it needs the
  `initialCats`-prop treatment the Admin page already demonstrates.
- **`NEXT_PUBLIC_SITE_URL` must be correct in production.** A wrong value yields a
  sitemap and canonical URLs pointing at the wrong host — worse than having none.
  Verify it at deploy time.
