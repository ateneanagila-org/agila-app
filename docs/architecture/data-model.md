# Data Model

Postgres via Supabase, Drizzle ORM. Schema lives in `lib/db/schema.ts`, enums in
`lib/db/enums.ts`, relations in `lib/db/relations.ts`.

Apply changes with **`pnpm drizzle-kit push`** — not generate/migrate. The files in `drizzle/`
are historical snapshots and no longer reflect the live schema (they still contain the dropped
`region_name` enum, a `Stray`/`Missing` cat status, and a surrogate PK on health records).

## Tables

| Table                | Key                | Purpose                                              |
| -------------------- | ------------------ | ---------------------------------------------------- |
| `cats`               | `id` uuid          | Cat records — identity, status, region override, photo |
| `cat_health_records` | `cat_id` (PK = FK) | 1:1 health record; PK *is* the cat id, no surrogate  |
| `regions`            | `id` uuid          | Campus locations; `name` free text, `UNIQUE`         |
| `sessions`           | `id` uuid          | Census session scoped to a region                    |
| `session_users`      | `id` uuid          | Volunteers on a session                              |
| `session_cats`       | `id` uuid          | Cats logged in a session                             |
| `interventions`      | `id` uuid          | Per-cat TNVR / Veterinarian actions                  |
| `profiles`           | `id` = auth user   | User profile, carries `auth_role`                    |
| `allowed_emails`     | `id` uuid          | Sign-in allowlist with pre-assigned role             |
| `gsheet_sync_queue`  | `id` uuid          | Pending forward-sync ops with retry state            |
| `sync_audit_log`     | `id` uuid          | History of sync runs                                 |
| `system_config`      | `key` text         | KV store (`sync_frozen`, `sync_freeze_reason`)       |

`auth.users` is Supabase-owned and declared via `pgSchema("auth")` purely so `profiles` and
`allowed_emails` can FK to it.

## Identity: `cats.id` is the sheet UUID

The cat's primary key is the same UUID that lives in the spreadsheet's column Y. Rows created
in the sheet keep the UUID Apps Script minted for them; rows created in-app generate one and
push it out. There is no mapping table, and no separate catalog ID —

> **The public catalog number is derived, not stored.** It lives only in the sheet's column A
> (number + status suffix). A `catalog_id` column was deliberately dropped; `catReadColumns` in
> `cats.repo.ts` still projects `NULL as catalog_id` so live Supabase instances missing the
> optional sync columns don't break user-facing reads.

## Effective region

A cat has no hard region FK requirement. Its region is:

```sql
COALESCE(
  region named by cats.region_id,              -- manual override, wins
  region of the cat's most recent session      -- fallback
)
```

The rule is written **once** in SQL, with two consumers derived from it and two independent
expressions that must stay in agreement by hand:

| Where                                              | Relationship | Used for                      |
| -------------------------------------------------- | ------------ | ----------------------------- |
| `effectiveRegionIdSubquery` — `lib/repo/cats.repo.ts` | **the rule** | resolves to a region id       |
| `regionSubquery` — same file                        | derived      | list reads, display, filters  |
| `findOriginalCatIdsByEffectiveRegion` — same file    | derived      | reconciliation routing        |
| `resolveCatRegion` — `lib/repo/sessions.repo.ts`     | duplicate    | sync routing, region moves    |
| `exists` clauses in the summary generators           | duplicate    | For RI / For FA grouping      |

`regionSubquery` used to hand-write the same COALESCE a second time. It now selects a name
`WHERE r.id = ${effectiveRegionIdSubquery}`, so a null effective id yields `WHERE r.id = NULL`
— matching no rows and returning `NULL`, exactly as before.

> **Nothing tests this.** Every suite mocks the DB seam, so a malformed subquery here passes
> the whole suite while silently returning the wrong region for every cat in the app. When
> you change it, verify against real data with a throwaway script comparing old and new
> output across all rows.

Consequences worth knowing:

- **A region move is a two-step cleanup.** `editCat` captures the old region *before* the
  update, then cancels stale PENDING tasks for the old region and queues a `DELETE` to it.
  Without that the cat appears on two sheets.
- **Deleting a region is override-aware.** `findCatsOnlyInRegion` deletes (a) cats whose
  override points at it, regardless of sessions elsewhere, and (b) cats with no override whose
  *only* sessions were in it. Cats whose override points at a surviving region are kept.
- **System sessions** (`sessions.is_system = true`) exist purely to anchor a cat→region link for
  cats created outside a census (direct DB adds, reverse-sync creates). They are never closed,
  have no users, and are excluded from session lists and "date last seen" logic.

## Lifecycles

### Cat entry status

```
Unsubmitted  ──submit session──▶  Unreviewed  ──approve──▶  Original
                                       │
                                       └──merge──▶  Merged  (merged_into_id set)
```

- **Only `Original` cats reach the spreadsheet.** `refreshCatInSyncQueue` gates on it.
- Merging cancels pending pushes and queues a `DELETE` for the duplicate's row.
- Census statistics count only `Original` cats (`isActiveCensus`), and treat any non-null
  `cat_status` as off-census.

### Session

```
open (is_finished = false)  ──▶  finished (immutable)
```

Finishing flips every still-`Unsubmitted` cat in the session to `Unreviewed`. It is enforced
with a **conditional update** — `UPDATE … WHERE is_finished = false … RETURNING` — and a
zero-row result is rejected. That closes the check-then-act race without a second read; keep
it that way rather than reverting to read-then-write.

### Orphan reclamation

Deleting a session cascades only the `session_cats` / `session_users` join rows, because `cats`
is their *parent*. Session-scoped drafts would otherwise dangle forever, so
`discardSession` / `removeSessionCat` explicitly hard-delete cats that the removal leaves
**fully orphaned**: still `Unsubmitted` **and** present in no other session.

`Original` / `Merged` / `Unreviewed` cats and cats shared with another session always survive.

## Cat status vs. health

Two independent axes, often confused:

- **`cats.cat_status`** — lifecycle: `Deceased` · `Fostered` · `Adopted` · `MIA`. `null` means
  an active census cat. Drives the col-A suffix and off-census stats.
- **`cat_health_records.condition`** — `Healthy` · `Sick` · `Injured` · `Sick and Injured`.
  `null` means genuinely unknown — from the sheet's `???` **or a blank cell**. A blank col I/J
  used to import as `Healthy`, turning an empty cell into a positive medical claim; it now
  imports as `null`. `Healthy` is therefore a *recorded* answer, never an inferred one.

**`is_neutered` is deliberately separate from `neuter_date`.** Volunteers routinely tick
"neutered" without recording a date, so the boolean is the source of truth for TNVR stats and
the date is optional metadata. `null` = unknown, matching the sheet's `???`. Never infer one
from the other.

## Nullable-by-design fields

`null` carries meaning in this schema, and the UI honours it:

- `date_last_seen` — a **plain stored value**, not derived from sessions. Deriving it would let
  the initial-import session poison every cat's date. `null` = genuinely unknown. Fed by
  session create, merge auto-advance, manual edits, reverse sync col N, and a one-time backfill.
- `photo_zoom` / `photo_offset_x` / `photo_offset_y` / `photo_rotation` — `NOT NULL` with
  identity defaults `(1, 0, 0, 0)`, which render as plain object-cover. See below.
- **`is_adoptable` is the deliberate exception.** The column is nullable, but nothing writes
  `null` and nothing reads it as a third state — sheet `???` and blank both parse to `false`.
  The distinction is *observation vs. decision*: `sex`, `is_neutered`, `sociability` and
  `condition` record facts about the cat that you may simply not have measured, so unknown is
  real. `is_adoptable` records AGILA's decision to offer a cat for adoption, and a decision has
  a safe default (`default(false)`) — "undecided" and "not offered" are the same thing to every
  consumer, all of which gate on `is_adoptable === true`. Do not "fix" col K to match its
  YES/NO/`???` neighbours; that was tried and reverted.
- Selecting "Unknown" in a form **writes null** rather than skipping the field
  (`normalizeCatField`), so clearing a value actually clears it. Drizzle's `.set()` skips
  `undefined` keys, so forms must send `null`, never `undefined`, to clear.

## Photos: crop as metadata

`photo_url` points at the **full normalized original** in the `cat-photos` bucket
(`${catId}/photo.jpg`, upsert). The visible framing is the `photo_zoom` / `photo_offset_x` /
`photo_offset_y` / `photo_rotation` quad, applied at render time by `lib/photo-position.ts` —
the single source of truth shared by the editor preview and the display, so what you frame is
what renders.

- `photo_rotation` ∈ `{0, 90, 180, 270}`, normalized by `normalizeRotation`. **Offsets stay in
  frame space** — there is deliberately no axis remapping, so a rightward drag is `+offsetX` at
  every angle; `getOffsetBounds` swaps width/height at 90/270 instead. At zoom 1 a rotated
  image still fully covers the square frame.
- Identity `(1, 0, 0, 0)` is indistinguishable from a legacy baked crop.
- Re-cropping writes only those three columns — no storage write, no `photo_url` change, no
  sync queue entry. The sheet always shows the uncropped original.
- Offsets legitimately exceed ±100 for zoomed non-square images (bounds scale with aspect ×
  zoom). Server clamps are ±2000 abuse guards only; the renderer re-clamps to true per-image
  bounds.

Blobs are **not** FK-linked to rows, so cleanup is manual and must be **reference-aware** — a
merge can reassign a duplicate's `photo_url` to the surviving cat, so a path may still be live
after its owning row is gone. Always derive the path from `photo_url`, never from a cat id.

## Enums

All in `lib/db/enums.ts`, each exported three ways: the raw `as const` array (for UI option
lists), a `pgEnum` (for the DB), and a Zod enum (for validation).

`REGION_NAME_VALUES` is the exception — regions were migrated from a Postgres enum to free text
so they can be managed self-serve from the Admin tab. That array is now **seed data only, not a
constraint**.

## Validation

Zod schemas in `lib/validation/` are mostly derived from the Drizzle tables via `drizzle-zod`
(`createInsertSchema` / `createSelectSchema`), then narrowed. Server actions attach them
through `next-safe-action`, so an action's input is validated before its body runs.

`lib/validation/reverse-sync.ts` is the exception and the one to read carefully: it hand-parses
raw spreadsheet arrays (`parseSheetRow`, `parseUnknownSheetRow`) into structured objects,
whitelisting enum values and mapping sheet sentinels (`N/A`, `???`, `YES`/`NO`) to real types
before the Zod gate runs.
