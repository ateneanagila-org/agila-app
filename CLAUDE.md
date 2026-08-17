# AGILA CATalog — Agent Guide

Campus cat census for Ateneo de Manila. Next.js 16 (App Router) + React 19 + Drizzle +
Supabase Postgres, with **two-way sync to Google Sheets**.

Two faces: an internal dashboard (sessions, database, TNVR, admin) and a public adoption
catalog. The app is an **overhead layer** over AGILA's existing Sheets — the DB is source of
truth, but the sheets stay live so the org always has a fallback.

## Skills

Load **all three** when working on frontend:

- `frontend-design` — build polished UI
- `vercel-react-best-practices` — performance patterns
- `caveman` — terse responses

## Ground Rules

- **pnpm only.** No npm.
- **Don't run `pnpm dev` to verify.** Trust the code. Type-check with `pnpm tsc --noEmit`
  (or `pnpm build`, which also checks types). Test with `pnpm jest __tests__`.
- **Schema changes: `pnpm drizzle-kit push`** — not generate/migrate.
- Don't write patterns that trigger setState linter errors (synchronous calls that cascade
  renders).

## Architecture: the layering is strict

```
app/actions/*   →  auth gate (requireAuth / requireRole) + zod schema, via next-safe-action
lib/services/*  →  transactions, business rules, sync queueing
lib/repo/*      →  EVERY direct db.* call lives here
```

**Services must never call `db.*` directly — always go through `lib/repo/`.** Add new query
functions to the repo rather than reaching around it. This holds everywhere today; keep it
that way.

`lib/types/` and `lib/validation/` are shapes only, no logic. Zod schemas are largely derived
from the Drizzle table via `drizzle-zod` (`createInsertSchema` / `createSelectSchema`).

## The sync engine — read before touching it

This is the riskiest, least-visible subsystem, and most of the app's non-obvious rules live
here. Full detail: **[docs/architecture/sync-engine.md](docs/architecture/sync-engine.md)**.

The load-bearing facts:

- **Column contract.** `A` = catalog number + status suffix · `B` = `=IMAGE()` photo ·
  `C–V` = data · `W` = edit timestamp · `X` = editor email · `Y` = **UUID (the record key)**.
  W/X are written by Apps Script on human edits; A and Y are service-account-owned.
- **A row with no col-Y UUID is invisible to sync.** Reverse sync skips it entirely.
- **`cats.id` IS the sheet's col-Y UUID.** Rows created in the sheet keep their Apps Script
  UUID as the DB primary key.
- Cron order per tick: read all sheets once (paced) → **reconcile representation** → reverse
  sync → photo import → forward sync → summary regen. There is an idle early-exit when
  nothing is pending — reconciliation runs **before** it, deliberately, because forward sync
  is task-driven and would otherwise never notice a cat whose row went missing.
- **Reconciliation repairs presence, not content.** It evaluates presence **globally** (a cat
  on any tab is present — per-region would double-list), skips the whole tick if any region
  read failed (a failed read is indistinguishable from an empty tab), and bounds itself with a
  wipe guard plus a per-tick repair budget.
- Conflict resolution is **last-edit-wins with a 5s DB-favoring buffer**
  (`CONFLICT_BUFFER_MS`). A reverse import cancels that cat's PENDING forward tasks.
- **Only `Original` cats reach the sheet.** `refreshCatInSyncQueue` gates on this — drafts
  and merged duplicates are never pushed.

Invariants that look like dead code but are not — do not "simplify" these:

- The col-Y write **pads blanks out to the original read length**. Cols A:V get cleared before
  rewrite, but Y is only update-written, so a shrink (delete/merge/compaction) strands orphan
  UUIDs without the padding.
- **Col B is rebuilt from the DB every tick.** A `A3:Y` read returns `""` for `=IMAGE()` cells
  under `FORMATTED_VALUE`, so echoing rows back would blank every photo.
- **Every survivor's col-A suffix is re-stamped**, not just tasked rows. A status changed via a
  sheet edit never queues a forward task, so untouched rows would keep a stale suffix forever.
- A null `date_last_seen` must **not** clobber the sheet's existing col N. The payload carries
  `"N/A"`; the guard keeps whatever the sheet has. DB wins only when it actually holds a date.
- All Sheets calls go through the **paced/retried wrapper** (`sheets-client.service.ts`,
  ~1.2s spacing). Never call `google.sheets()` directly — quota is the binding constraint.

## Effective region

A cat's region is `COALESCE(cats.region_id override, most recent session's region)`. The rule
now lives in **one** SQL expression, with the rest derived from or duplicating it:

- `effectiveRegionIdSubquery` in `lib/repo/cats.repo.ts` — **the** expression of the rule
- `regionSubquery` (same file) — **derived** from it; resolves the id to a name. Do not
  hand-write the COALESCE here again.
- `findOriginalCatIdsByEffectiveRegion` (same file) — reconciliation's routing, also derived
- `resolveCatRegion` in `lib/repo/sessions.repo.ts` (sync routing) — still a separate
  expression that must stay in agreement
- the `exists` clauses in the summary-sheet generators — likewise

**No test can catch a mistake here.** Every suite mocks the DB seam, so a malformed subquery
passes all 348 tests. Verify changes against real data with a throwaway script.

A region move must cancel stale queue tasks **and** queue a `DELETE` to the old tab, or the cat
appears on two sheets.

## Cat + session lifecycles

`Unsubmitted → Unreviewed → Original`, or `Merged` (with `merged_into_id` set).

- A volunteer builds a session; submitting flips its still-`Unsubmitted` cats to `Unreviewed`.
- Managers review: **Info Validation** → **Cross-Reference** (approve as new, or merge).
- **A finished session is immutable.** Enforced by a conditional `UPDATE ... WHERE is_finished
  = false` returning 0 rows — not a read-then-write. Keep it that way; it closes the
  check-then-act race.
- Discarding a session (or removing one cat) hard-deletes only cats it leaves **fully
  orphaned** — still `Unsubmitted` and in no other session. FK cascade alone only drops the
  join row, since `cats` is the parent.

## Photo storage

Supabase `cat-photos` bucket, path `${catId}/photo.jpg` (upsert — re-uploads never orphan).
Blobs are NOT FK-linked to rows, so cleanup is manual.

**Crop-as-metadata:** the stored blob is the full normalized original. The framing is a
`photo_zoom` / `photo_offset_x` / `photo_offset_y` / `photo_rotation` quad applied at render
time. The math lives once in `lib/photo-position.ts` and is shared by the editor preview and
the display, so what you frame is what renders. Identity `(1, 0, 0, 0)` renders as plain
object-cover — indistinguishable from a legacy baked crop. Re-framing touches neither storage
nor the sync queue; the sheet always shows the unframed original.

- `photo_rotation` is one of `0 | 90 | 180 | 270`, normalized by `normalizeRotation`.
- **Offsets are in frame space, not image space** — there is deliberately no axis remapping,
  so a rightward drag is `+offsetX` at every angle. `getOffsetBounds` swaps width/height at
  90/270 instead. At zoom 1 a rotated image still fully covers the square frame.
- When adding a photo field, check every `Pick<SelectCat, …>` prop type. `CatCard` omitted
  `photo_rotation` and silently rendered every photo unrotated in the two highest-traffic
  lists — no type error, no runtime error.

**Never delete a blob by assuming `${catId}/photo.jpg` belongs only to that cat.** A merge can
reassign a duplicate's `photo_url` to the surviving target, so a path may still be referenced
after its owning row is gone. Always derive the path from `photo_url` and **reference-check**
first (`lib/services/cat-photo-storage.ts`, `cats.repo.findCatsReferencingPhotoPaths`).

- `removeCat` cleans its blob inline (reference-aware).
- Merges + region/bulk deletes rely on the GC sweep `reconcileCatPhotos`
  (Admin → GSheet Config → Reclaim orphaned photos).
- `deleteSession` / `removeSessionCat` go through `sessions.service`
  (`discardSession` / `removeSessionCat`), which hard-deletes fully-orphaned cats via
  `removeCat` — blob + sheet row cleaned.

## RBAC

Three roles: **Volunteer < Manager < Administrator**. Use `canManage` (`isAdmin || isManager`)
from `useAuth()` for most client gates; the server re-checks independently with
`requireRole(...)`. Client gating alone is never sufficient.

- **Volunteer**: read-only on database detail screens (General/Medical/Interventions — disable
  inputs, hide save/cancel); full create/edit **inside session forms** (that's their workflow).
- **Manager/Admin**: full CRUD on database; can approve sessions; Census Report + Review
  Sessions buttons.
- **Admin only**: the Admin tab (users, regions, GSheet config).

Sign-in is an **allowlist** (`allowed_emails`), not a domain rule — an email must be added by an
admin before Google OAuth will let it through. A non-allowlisted user is deleted and bounced to
`/login/not-onboarded`.

## Desktop vs Mobile Layout

**Two-screen strategy** (full context: [docs/architecture/frontend.md](docs/architecture/frontend.md)):

Mobile is baseline and stable. In practice both variants live in one file as sibling JSX
branches — `tablet:hidden` for mobile, `hidden tablet:block` for desktop — sharing all hooks,
actions, and services.

Split presentation when structure changes (panels, hierarchy, nav, workflow). Use responsive
Tailwind in one component only for minor tweaks (spacing, sizing, alignment).

**Share:** logic, hooks, validation, actions, services
**Split:** only presentation/layout

Don't refactor mobile just to serve desktop.

## Design Theme

### Fonts

| Role     | Family       | Class          | Source                        |
| -------- | ------------ | -------------- | ----------------------------- |
| Body     | Gantari      | `font-sans`    | Google Fonts (default on body) |
| Headings | Aveton       | `font-heading` | local, `public/fonts/`        |
| Brand    | SFC La Pura  | `font-brand`   | local, wordmark only          |

### Color palette

Defined in `app/globals.css` under `@theme inline`.

| Token             | Tailwind class                 | Value               | Use                            |
| ----------------- | ------------------------------ | ------------------- | ------------------------------ |
| Brand green       | `bg-brand-green`               | `#239547`           | Headers, sidebar, primary      |
| Brand green light | `bg-brand-green-light`         | `#239547`           | Hover/active on green          |
| Green foreground  | `text-brand-green-foreground`  | `oklch(0.99 0 0)`   | Text on green (white)          |
| Brand orange      | `bg-brand-orange`              | `#eb6324`           | CTAs, active indicators        |
| Orange foreground | `text-brand-orange-foreground` | `oklch(0.99 0 0)`   | Text on orange (white)         |
| Brand cream       | `bg-brand-cream`               | `#fff7ea`           | Main content background        |
| Brand cream dark  | `bg-brand-cream-dark`          | `#d8fcf2`           | Subtle surfaces, hover         |
| Brand mint        | `bg-brand-mint`                | `#d8fcf2`           | Muted / secondary surfaces     |
| Brand dark        | `bg-brand-dark`                | `#341111`           | Bottom nav, sidebar, shell     |
| Brand yellow      | `text-brand-yellow`            | `#fff967`           | Heading text on green          |
| Brand pink        | `bg-brand-pink`                | `#ffc2d6`           | Accent, separators             |
| Status adopted    | `bg-status-adopted`            | `#2f7d9c`           | Cat lifecycle chip             |
| Status MIA        | `bg-status-mia`                | `#d98a1f`           | Cat lifecycle chip             |

Semantic mapping: `--primary` → green · `--accent` → orange · `--background` → cream ·
`--sidebar` → green.

### Custom breakpoints

`xs` 375px · `mobile` 480px · `tablet` 768px. **`tablet` is the mobile/desktop split point.**

### Rules

- Never hardcode hex values — use brand tokens or Tailwind semantic classes.
- Desktop: change colors and fonts only — no layout changes.
- Mobile: colors, fonts, and layout (hi-fi implementation).

## File Locations

| Path            | Contents                                                        |
| --------------- | --------------------------------------------------------------- |
| `app/`          | Routes, server actions (`app/actions/`), API routes             |
| `components/`   | `ui/` primitives · `app-pages/` feature screens                 |
| `lib/repo/`     | All direct DB queries — add new ones here                       |
| `lib/services/` | Business logic, transactions, sync                              |
| `lib/validation/` | Zod schemas (mostly drizzle-zod derived)                      |
| `lib/db/`       | Drizzle schema, enums, relations                                |
| `workers/`      | `sync-cron/` Cloudflare Worker · `apps-script/` sheet-side `.gs` |
| `docs/`         | See [docs/README.md](docs/README.md) · human onboarding lives in [docs/development.md](docs/development.md) |

Navigate by reading code structure; no detailed file map needed.

## Testing

35 suites / 348 tests, all mocked — the DB and Google APIs are stubbed per file, so the suite
runs offline.
Coverage is concentrated on the sync system; **UI is not unit-tested** (no component tests,
`testEnvironment: "node"`).

```bash
pnpm jest __tests__     # run suite
pnpm tsc --noEmit       # type-check
```

When touching sync, the existing tests encode the invariants above — if one fails, the
invariant is real; understand it before changing the assertion.
