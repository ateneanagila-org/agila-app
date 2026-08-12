# P2 — Configurable Links & In-App Bug Reports

**Date:** 2026-08-12
**Status:** Design approved, pending implementation plan
**Scope:** Finalization items 8 (admin-editable referral links) and 3 (proper bug report referral)

## Context

Second of four sub-projects in the finalization effort. P1 repaired the Admin screen and the
region subsystem; this extends that surface, which is why it ran second.

| Phase | Contents |
| ----- | -------- |
| P1 (done) | Fix Admin screen; repair region adding/deleting |
| **P2** (this) | Admin-editable referral links; in-app bug reports |
| P3 | Sync killswitch (deprecation), handoff/decoupling guide, storage gauge |
| P4 | Photo rotation, vaccination expiry warning, basic SEO |
| Spike | Stats mismatch/drift — diagnose live before speccing |

## Problem

### Links are compiled in

Four URLs are hardcoded. Changing any of them requires a developer and a redeploy — a
non-starter once the app is handed to AGILA.

| Constant | Usages | Files | Rendered on |
| -------- | ------ | ----- | ----------- |
| `CENSUS_REPORT_URL` | 5 | 2 | `sessions-screen`, `sessions-manager-screen` |
| `REFERRAL_SHEET_URL` | 3 | 2 | `database-list-screen` (2), `app/error.tsx` (1) |
| `ADOPT_FOSTER_APPLICATION_URL` | 2 | 2 | `catalog-screen`, `catalog-detail-screen` — public, unauthenticated |
| `BUG_REPORT_URL` | 1 | 1 | `user-details-dialog.tsx` (inlined, not even in `constants.ts`) |

Eleven usages across six files. Seven of them, in three dashboard files, migrate to
`useLinks()`; the rest are the two deliberate exceptions below (`app/error.tsx`, public
catalog) plus the bug-report link, which is deleted outright.

The three in `lib/constants.ts` carry `// TODO: replace with the real ... URL` comments, but
all currently point at correct documents. The TODOs mean "these may change", not "these are
broken" — so this is a feature, not a bug fix.

### The bug report goes nowhere useful

`BUG_REPORT_URL` points at `https://github.com/legnspice/agila-app/issues` — a **personal**
repository, reached from a dialog every signed-in user can open. Filing an issue requires a
GitHub account, so the volunteers and managers who actually encounter bugs cannot use it. On
handoff the link also stops belonging to the org that owns the app.

## Scope

**In:** admin-editable values for the three referral links; an in-app bug report form with an
Administrator triage view.

**Out:**

- **Fixing the pre-existing `db.*` layering violations.** `system.service.ts`,
  `photo-import.service.ts`, `sync-cron.service.ts`, `reverse-sync.service.ts` and
  `helper.service.ts` all call `db.*` directly, contradicting the rule in `CLAUDE.md`
  ("services must never call `db.*` directly … this holds everywhere today"). That claim is
  inaccurate and the doc needs correcting, but the cleanup is deferred. **New** code in this
  project follows the rule.
- Notifying admins when a report arrives (email, push, or in-app toast).
- Reporter-visible status — a reporter cannot see what happened to their report.
- Attachments or screenshots on a report.
- Rate limiting or spam protection. Sign-in is an admin-managed allowlist of ~40 people.
- Capturing the page a reporter was on. Considered and rejected: identity and timestamp are
  enough, and it keeps the form to a single field.
- Making `BUG_REPORT_URL` configurable. It is deleted, not moved — the in-app form replaces it.

## Design

### 1. Data model

**Links reuse `system_config` unchanged.** It is already a `key` / `value` / `updated_at`
table serving `sync_frozen` and `sync_freeze_reason`. Three new rows:

| Key | Replaces |
| --- | -------- |
| `link_census_report` | `CENSUS_REPORT_URL` |
| `link_referral_sheet` | `REFERRAL_SHEET_URL` |
| `link_adopt_foster` | `ADOPT_FOSTER_APPLICATION_URL` |

Writes go through the same `onConflictDoUpdate` upsert `setSyncFrozen` uses. **A missing row
means "not configured" and the compiled-in constant wins** — so the feature ships with no
migration step and no window where links are blank.

**Bug reports need one new table** and one new enum (`bug_report_status`: `Open` | `Resolved`).

```
bug_reports
  id              uuid pk default random
  message         text notnull
  reporter_id     uuid → profiles.id  ON DELETE SET NULL
  reporter_name   text                     -- snapshot
  reporter_email  text notnull             -- snapshot
  status          bug_report_status notnull default 'Open'
  created_at      timestamp notnull default now()
  resolved_at     timestamp nullable
```

The snapshot columns are load-bearing, not redundancy. `profiles.id` cascades from
`supabaseUsers.id`, and removing someone from the allowlist deletes their auth user — so a
plain FK would delete that person's bug reports along with them. `SET NULL` plus a
name/email snapshot keeps the report readable after the reporter is gone, which is precisely
when it still matters.

`resolved_at` is stored because "when was this dealt with" costs nothing to record and cannot
be reconstructed later.

Schema changes apply with `pnpm drizzle-kit push`.

### 2. Links — `LinksProvider`

```
(protected)/layout.tsx        already reads user + profile for AuthProvider
  + findSystemConfig()        one query returns every key
        │
  <LinksProvider links={…}>   mounted beside AuthProvider, same file
        │
  useLinks()  →  { censusReport, referralSheet, adoptFoster }
```

This is not a new pattern — it is the one `AuthProvider` already establishes in this exact
file: a server layout reads, a client provider distributes. Because `system_config` is
key/value, **all links arrive in one query** regardless of how many exist, and the layout
awaits before rendering children, so the values are present on first paint. That satisfies the
project rule that async loads gate the route's Suspense boundary rather than streaming in and
producing partially-populated UI.

`useLinks()` resolves each value as `dbValue ?? CONSTANT_DEFAULT`. Consumers cannot observe
whether a link is configured or falling back — they receive a URL either way. Three dashboard
files (`sessions-screen`, `sessions-manager-screen`, `database-list-screen`, seven usages
between them) replace their `lib/constants` import with `useLinks()`.

Two deliberate exceptions:

- **`app/error.tsx` keeps importing the constant.** It is the global error boundary, sits
  outside every provider, and renders exactly when something has crashed — possibly the
  database. A DB-sourced link there is unreliable by construction.
- **The public catalog reads for itself.** It lives outside `(protected)/layout.tsx`, so each
  of its two server pages — `app/(public)/(home)/page.tsx` (renders `CatalogScreen`) and
  `app/(public)/catalog/[id]/page.tsx` (renders `CatalogDetailScreen`) — loads
  `link_adopt_foster` and passes it down as a prop. One extra read on pages already querying
  the DB for cats. `app/(public)/catalog/page.tsx` only redirects to `/` and needs nothing.

Admin edits follow the mandated layering:
`app/actions/system.ts` → `lib/services/system.service.ts` → **`lib/repo/system.repo.ts` (new)**.
The repo file is new because `system.service.ts` currently calls `db.*` directly. New code
follows the rule rather than copying the violation; the existing calls are left alone (see
Scope → Out).

Validation: each link is a required, well-formed `https://` URL when present. Clearing a field
deletes the row, restoring the constant.

### 3. Submitting a report

The "Report a Bug" section in `UserDetailsDialog` keeps its heading and position, but its
button stops being an external link. Clicking it expands the section **in place** into a
textarea plus a **Send report** button — deliberately not a second modal stacked on the
dialog, which is the failure mode P1 spent a fix wave correcting.

- Success swaps the section to a brief confirmation ("Thanks — your report was sent") rather
  than closing the dialog, so the user gets feedback without losing their place.
- Failure renders the error inside the section, beside the button that caused it.
- `message` is required, trimmed, and capped at 2000 characters by zod.
- **Identity is never client-supplied.** The action reads name and email from the session, so
  a reporter cannot attribute a report to someone else.

`BUG_REPORT_URL` and its `ExternalLinkIcon` usage are deleted.

**RBAC.** Submitting requires `requireAuth()` only, so Volunteers can report. Reading,
resolving and deleting require `requireRole("Administrator")`. The `admin/layout.tsx` gate
covers navigation; every action re-checks server-side, since client gating is never
sufficient.

### 4. Admin surface

**A card on the Admin screen**, rendered in both the mobile and desktop branches:

```
┌──────────────────────────────────┐
│ Bug Reports                      │
│ 3 open                           │
│                [ View reports › ] │
└──────────────────────────────────┘
```

The open count is its only state, server-read through the same blocking `Promise.all` that
already seeds users, sync status and regions.

**The subroute** `/dashboard/admin/bug-reports` follows the established pattern: its own
`page.tsx` and `loading.tsx`, a screen component with `tablet:hidden` / `hidden tablet:block`
branches, and the `Back ‹` pill returning to `/dashboard/admin`. It is Administrator-only for
free via the existing layout gate.

The list is newest-first with an **Open / Resolved / All** filter. Each row shows the
reporter's name and email, the date, the full message, and:

- **Resolve** (or **Reopen** when already resolved)
- **Delete**, behind a typed-confirm. P1 established that reflex for destructive actions, and
  a deleted report cannot be recovered.

### 5. Error handling

Admin-side failures reuse P1's `AdminError` banner. The modal-error rule from P1's final
review also holds: any error raised while a modal is open renders **inside** that modal, never
in a surface the modal's scrim covers.

A failed `system_config` read degrades to the constants rather than blanking the links.

## Testing

Automated (Jest, mocked seams, matching the existing service-test style):

| Area | Assertion |
| ---- | --------- |
| `createBugReport` | Snapshots reporter name/email from the session; ignores client-supplied identity |
| `resolveBugReport` | Sets `status = Resolved` and stamps `resolved_at` |
| `resolveBugReport` | Reopening restores `status = Open` and clears `resolved_at` |
| Reporter deletion | Report survives with `reporter_id = null`, snapshot intact |
| `getLinks` | A DB value overrides the constant |
| `getLinks` | A missing row falls back to the constant |
| `updateLinks` | Rejects a non-URL value; clearing a field deletes the row |

UI is not unit-tested, consistent with the rest of the codebase (`testEnvironment: "node"`,
no component tests). UI verification is `pnpm tsc --noEmit`, `pnpm lint`, and manual checks.

Manual:

1. Edit each link in Admin → confirm every consumer screen picks up the new value.
2. Clear a link → confirm it falls back to the constant rather than rendering empty.
3. Submit a report as a Volunteer → confirm it appears in the Admin list with the right
   identity.
4. Resolve, reopen, then delete a report → confirm the filter and open count track each.
5. Delete a user who filed a report → confirm the report survives and still shows their email.

## Risks

- **`system_config` is untyped key/value.** A typo in a key name silently yields the fallback
  rather than an error. Mitigated by defining the keys as exported constants used by both
  reader and writer, so there is one spelling.
- **`LinksProvider` couples consumers to the protected layout.** Any future consumer rendered
  outside it needs its own read — the seam the public catalog already demonstrates. Documented
  here so the next person hits it knowingly.
- **No notification on new reports.** An admin only learns of a report by visiting the screen.
  Acceptable at this scale; revisit if volume grows.
