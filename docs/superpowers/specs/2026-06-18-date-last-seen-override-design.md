# Date-Last-Seen — Design (override-only model)

**Date:** 2026-06-18 (revised 2026-06-23)
**Status:** Approved (brainstorm) → ready to execute

## Problem

App and GSheet disagree on "date last seen":

- The `cats` table has **no** date-last-seen column. It only has `spot_last_seen` (text *place*, col O).
- Sheet **col N** ("date last seen") holds legacy, hand-maintained dates — the true historical sighting dates.
- The app derived a sighting date from session data (`findLatestSessionDateForCat`). Most legacy cats are anchored
  only to a **system session** (excluded from that query), so the app effectively had no real sighting date and
  the "Last seen" UI block mislabeled `last_updated_at` as one (`database-general-screen.tsx:360-371`).

## Decision: make `date_last_seen` a plain column, fed directly (no session fallback)

The session-date fallback was the source of the complexity (and the original bug: the initial-import session
polluting the derived date). Dropping it removes the poison by construction. A "sighting" in this app is a cat
being recorded in a session, so the date is **written** on those events instead of derived:

```
effective date = cats.date_last_seen        (no COALESCE, no ?? )
```

`null` = genuinely unknown (honest — better than a fabricated import date).

`session.created_at` / `last_updated_at` keep their roles (session ordering; reverse-sync LWW clock + sort key)
— they are simply **not** the last-seen metric.

## Verified sync facts (basis for this design)

- Sheet col ownership: A–V = DB/forward-sync (col N idx 13 = date last seen); **W (22)=`last_edited_at`,
  X (23)=`edited_by`** owned by Apps Script `onEdit`; Y (24)=UUID.
- Forward sync writes **A3:V + Y only, never W/X** (`helper.service.ts:457`). API writes don't fire `onEdit`.
- Reverse sync only processes rows with a fresh `lastEditedAt` (`reverse-sync.service.ts:80`), DB-wins within 5s
  (`:193`), clears W:X after import. ⇒ **no forward→reverse loop.**
- **Col N is currently safe:** legacy cats have only a *system* session → `findLatestSessionDateForCat` returns
  null → forward payload col N = `"N/A"` → the guard at `helper.service.ts:386-399` preserves the sheet value.
  This stays true for a null `date_last_seen` column, so deploying this change opens **no clobber window**.

## Design

### 1. Schema
Add `date_last_seen: timestamp("date_last_seen")` (nullable) to `cats`. `pnpm drizzle-kit push`. Zod schemas
auto-derive.

### 2. Read path
Add `date_last_seen: cats.date_last_seen` to `catReadColumns` (`cats.repo.ts`). Plain column — **no subquery,
no resolver.**

### 3. Forward sync
At `helper.service.ts:255` and `:360`, the date for col N becomes `cat.date_last_seen` (formatted) — drop
`findLatestSessionDateForCat` from the date path. **Keep the N/A guard** (`:386`) — it protects col N while a
cat's column is still null (pre-backfill / genuinely unknown). UNKNOWN tab unchanged (no col N).

### 4. Reverse sync — plain col-N import (no guard needed)
`parseSheetRow` surfaces col N (idx 13); import writes it to `date_last_seen` (parse `"M/D/YYYY"`,
blank/`N/A`→null) under the normal last-write-wins flow. No differs-from-derived guard: there is no derived
value, so re-importing the cat's own stored value is a no-op; a genuine human col-N edit imports normally.
Touches UPDATE (`importSheetRowToDB`) + CREATE (sheet-added cat) paths. UNKNOWN unchanged.

### 5. Write paths (how the date advances)
- **`createSessionCat`** stamps the new entry's `date_last_seen` (form default = today; volunteer can backdate).
  Always written.
- **Merge** (recurrence choke point — `crossref handleMerge` step 1 `editCat` on the survivor): set survivor
  `date_last_seen` to the **newer** of {survivor, incoming entry} (null-safe). Shown read-only in the merge
  confirm dialog. This replaces "auto-advance via latest session."
- **Manual edits** — all edit surfaces below.
- **Backfill** — §7.

### 6. UI — plain date field (shared `DateInputRow`)
Lift `DateInputRow` + `parseDateParts`/`buildDate` out of `database-medical-screen.tsx` into a shared module;
widen `YEARS` to reach older legacy dates. All-blank dropdowns = unknown (null).

| Surface | Mode | Action | Prefill | Edit rights |
|---|---|---|---|---|
| cat-entry-form | session create | `createSessionCat` | **today** | Volunteer + mgr |
| cat-entry-form | session edit | `editSessionCat` | stored (blank if null) | Volunteer + mgr |
| cat-entry-form | DB add | `createCat` | blank | Manager/admin |
| cat-entry-form | DB edit | `editCat` | stored | Manager/admin |
| database-general-screen | inline edit | `editCat` | stored | Mgr/admin; volunteer read-only |
| sessions-approval-crossref | review entry | `editCat` | stored | Manager/admin |

Write: complete date → `date_last_seen = Date`; blank → `null`. Session-create always sends (no dirty-track).

**Read display:** general-screen shows `date_last_seen` (or "Unknown") as the sighting date next to the place,
replacing the mislabeled `last_updated_at`; catalog-detail shows it next to the place.

### 7. Backfill — one-time script
`scripts/backfill-date-last-seen.ts`: read each region tab `A3:Y`, parse col N (`"M/D/YYYY"`), set
`cats.date_last_seen` **only where currently null** and col N is a valid non-`N/A` date (matched by col-Y UUID).
Null-gated, idempotent, skips UNKNOWN, never clobbers app/test data. Owner runs once.

### 8. Testing
- Forward sync: col N = column when set; `"N/A"` + guard preserves sheet when column null; UNKNOWN → null.
- Reverse sync: col N imports to column (parse + blank→null); UNKNOWN unchanged.
- Merge: survivor advances to newer date; null-safe.
- Backfill: null-gated, skips UNKNOWN + blank/`N/A`, parses `"M/D/YYYY"`, matches by UUID.

## Files touched
- `lib/db/schema.ts` — column
- `lib/repo/cats.repo.ts` — `date_last_seen` in `catReadColumns`
- `lib/services/helper.service.ts` — forward-sync date = column (keep N/A guard)
- `lib/validation/reverse-sync.ts` + `lib/services/reverse-sync.service.ts` — col-N import
- `lib/services/sessions.service.ts` — `createSessionCat` stamps date (via payload)
- `components/.../shared/date-input-row.tsx` (new shared) + `database-medical-screen.tsx` (use it)
- `components/app-pages/shared/cat-entry-form.tsx` — date field (+ today default on session create)
- `components/app-pages/database/database-general-screen.tsx` — field + read-display fix
- `components/app-pages/sessions/sessions-approval-crossref-screen.tsx` — field + merge auto-advance
- `components/app-pages/catalog/catalog-detail-screen.tsx` — show date
- `scripts/backfill-date-last-seen.ts`
- `__tests__/…`
