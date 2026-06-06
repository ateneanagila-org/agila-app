# AGILA CATalog

The **AGILA CATalog** is a campus cat census and management web app built for **AGILA**
(*Ateneans Guided and Inspired by their Love for Animals*) — the Ateneo de Manila University
student organization that runs the cat Census (CATalog) project alongside the TNVR
(Trap-Neuter-Vaccinate-Return) program.

It has two connected sides:

- **Internal** — a dashboard for AGILA members to run census sessions, manage the cat
  database, log health interventions, and oversee data quality.
- **External** — a public catalog of adoptable/fosterable cats with photos and details.

The app is designed as a non-disruptive **overhead layer** over AGILA's existing Google
Workspace tools: the regional Google Sheets stay in **two-way sync** with the app's database,
so members keep a familiar, always-current fallback if the app is ever unavailable.

> **Using the app (non-technical guide):** see the
> [User Manual](docs/handbook/AGILA-User-Manual.md) — split by role (Volunteer / Manager /
> Administrator).
>
> **Operating the sync system (technical):** see the
> [GSheets Sync Setup & Operations Guide](docs/gsheets-sync-setup-guide.md).

---

## Background

AGILA tracks hundreds of cats across the Ateneo campus — recording health status, neutering
history, vaccination records, and adoption eligibility. Historically this lived in a set of
fragmented Google Workspace tools (the shared "CATalog" spreadsheet, Google Forms, a Facebook
page), which made data entry error-prone, onboarding labor-intensive, and adoptable cats hard
for the public to browse.

The AGILA CATalog app addresses this without throwing the old system away. The **app is the
primary, validated place to manage cats**: volunteers run census sessions in the app, and
managers review and approve what they submit. The regional Google Sheets are kept in two-way
sync so external stakeholders keep their familiar view — and so AGILA can always fall back to
the spreadsheet if needed. The database is the source of truth; volunteers get **view-only**
access to the sheets, while managers/admins retain edit access as an emergency fallback.

---

## Tech Stack

| Layer            | Technology                                          |
| ---------------- | --------------------------------------------------- |
| Framework        | Next.js 16 (App Router, React 19)                   |
| Language         | TypeScript (strict)                                 |
| Styling          | Tailwind CSS 4                                       |
| UI Primitives    | Radix UI + custom components                        |
| Data Fetching    | TanStack Query 4                                     |
| Server Actions   | `next-safe-action` 8                                |
| Validation       | Zod 4                                               |
| ORM              | Drizzle ORM + Drizzle Kit                           |
| Database         | PostgreSQL (via Supabase)                           |
| Auth             | Supabase Auth + Google OAuth (SSR)                  |
| Storage          | Supabase Storage (photos)                           |
| Google APIs      | Sheets API, Drive API                               |
| Image Processing | Sharp (server), browser-image-compression (client) |
| Scheduled Jobs   | Cloudflare Workers (sync cron)                      |
| Alerts           | Discord Webhooks                                    |
| Charts           | Recharts                                            |
| Testing          | Jest + Testing Library                              |

---

## Architecture

### Data Flow

The database is the authoritative store; the app is the primary, validated entry point. A
sync engine mirrors data to the regional Google Sheets and pulls human sheet edits back:

```
Volunteers / Managers / Admins → AGILA CATalog Web App
                                      ↕
                              PostgreSQL (Supabase)   ← source of truth
                                      ↕ two-way sync
                            Google Sheets (CATalog, per region)
```

**Forward sync** (DB → Sheet): drains the `gsheet_sync_queue`, writes each cat to its region
tab via the Sheets API, and regenerates the `For RI` / `For FA` summary sheets.

**Reverse sync** (Sheet → DB): reads each region's sheet tab, parses rows with Zod schemas,
and upserts changes into the database. Rows without a recent edit timestamp (column W) are
skipped; a blank UUID (column Y) is also skipped. Conflict resolution is **last-edited-wins**
— if the DB record was updated within a 5-second window of the sheet edit, the DB wins.

**Photo import** (runs before each sync cycle): downloads the full spreadsheet as an xlsx
export, parses it as OOXML to locate embedded cell images by their row-anchor position,
matches them to cat UUIDs in column Y, processes the bytes with Sharp, uploads to Supabase
Storage, and writes the public URL back to the cat record.

**Photo storage cleanup**: photos live at `${catId}/photo.jpg` in the `cat-photos` bucket.
Deletions are **reference-aware** — a blob is only removed if no surviving `cats.photo_url`
points at it (a merge can reassign a duplicate's photo to the surviving cat). Deleting a cat
cleans its blob inline; merges and bulk/region deletes are swept up by the **Reclaim orphaned
photos** admin action (`reconcileCatPhotos`), which diffs the bucket against live references.

**Effective region** routing: a cat's sheet tab is its `COALESCE(cats.region_id override,
most-recent session's region)`. The same rule drives the app display, sync routing, and
summary sheets.

**Sync scheduling**: a Cloudflare Worker (`workers/sync-cron/`) fires every 20 minutes
(`*/20 * * * *`), health-checks the app via `/api/health`, then POSTs `/api/cron/sync` with a
shared `CRON_SECRET` to run photo-import → reverse → forward → summary-regen across all
regions. If a tick fails, the app **auto-freezes** the sync and posts a Discord alert.

### Google Apps Script

A script installed as an installable trigger on the CATalog spreadsheet handles sheet-side
bookkeeping on human edits:

- Auto-timestamps edits in column W and records the editor's email in column X
- Generates a UUID in column Y on first data entry (the stable record key across sync)
- Flags region tabs created by hand (which sync cannot see) with a warning banner

> One-time structural setup (headers, protected columns, UUID seeding) is done **server-side
> from the Admin tab** as the service account — not from Apps Script. The legacy Apps Script
> setup/freeze functions are deprecated; see the
> [sync setup guide](docs/gsheets-sync-setup-guide.md).

### Sync Queue, Audit Log & Freeze

Forward-sync writes are queued in `gsheet_sync_queue` and processed with retry state. Every
sync run is recorded in `sync_audit_log` (region, direction, task counts, error details).
Sync can be **frozen** via a `system_config` flag (`sync_frozen`): it freezes automatically
on failure, and an administrator clears it from **Admin → GSheet Config → Unfreeze** (which
runs a full reverse sync, then resumes). Freeze is entirely app-side.

---

## Features

### Census Sessions (the volunteer workflow)

A **session** is one trip out to count cats in one campus region. It has a `census_no` and a
roster of the cats logged.

- A volunteer creates a session scoped to a region, then adds each cat via the entry form
  (photo, identity, health, location).
- A session is **Unfinished** until submitted; submitting sends it for manager review.
- Managers review via a two-step pipeline: **Info Validation** (correct the entry's details)
  → **Cross-Reference** (compare against existing cats and **merge duplicates**, or approve
  as new). Approving sets the entry's status to `Original`; merging marks it `Merged` and
  records `merged_into_id`.

Cat entry status: `Unsubmitted → Unreviewed → Original` (or `Merged` into another cat).

### Cat Database

Each cat record includes:

- **Identity**: name, color, age, sex, sociability, caretaker, spot last seen, notes
- **Status**: deceased, fostered, adopted, MIA (or none)
- **Location**: a `region_id` override that, with session history, resolves the effective region
- **Health record**: condition, neutered (yes/no/unknown), neuter date, vaccination date
- **Photo**: uploaded in-app or imported from the spreadsheet
- **IDs**: `paws_id` (university registry ID); the public catalog ID is **derived** (sheet
  column A, with a status suffix), not stored on the row
- **Merge tracking**: `merged_into_id` links a deduplicated entry to its canonical cat

Managers have full create/edit/delete across the **General**, **Medical**, and
**Interventions** tabs. Volunteers see these detail screens **read-only**.

### Interventions

Per-cat actions — type **TNVR** or **Veterinarian**, status **Pending → Finished** (or
**Cancelled**). Managers add and update them from a cat's Interventions tab.

### User Management

Administrators manage accounts through an **allowlist** (`allowed_emails`): only pre-approved
emails can sign in with Google. Roles are assignable before signup and carried onto the
profile at signup.

| Role          | Capabilities                                                                          |
| ------------- | ------------------------------------------------------------------------------------- |
| Volunteer     | Run census sessions (full create/edit inside session forms); view-only elsewhere      |
| Manager       | All of the above + review/approve sessions, full cat-database CRUD, Census Report      |
| Administrator | All of the above + the Admin tab (users & roles, regions, GSheet config)               |

Access is enforced at the server-action level via RBAC helpers (`requireRole(...)`).

### Public Catalog

A public, no-login directory of cats marked `is_adoptable = true`, with search and per-cat
detail pages — the external half of the app that makes adoptable/fosterable cats easy to
browse.

### Overview & TNVR Dashboards

- **Overview**: population stats, regional breakdowns, and **Priority Locations** (regions
  ranked by days since their last census).
- **TNVR**: neutering-coverage statistics (the TNVR Score) with a sex/neuter pie breakdown,
  filterable by location.

### Admin Tab

Administrator-only, organized like a settings page with three sections:

- **Users & Access** — invite/remove people and change roles
- **Regions** — add / rename / delete campus locations (also provisions each region's sheet)
- **GSheet Config** — sync status + **Unfreeze**, **Provision Sheets** (structural repair),
  **Seed UUIDs** (one-time cutover), **Reclaim orphaned photos** (storage GC — deletes photo
  files no cat record references)

---

## Database Schema

Core tables:

| Table                | Purpose                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `cats`               | Cat records (identity, status, region override, photo, `paws_id`)      |
| `cat_health_records` | One-to-one health record per cat (condition, neuter, vaccination)      |
| `regions`            | Campus locations — `name` is free text (`NOT NULL UNIQUE`), managed in-app |
| `sessions`           | Census sessions scoped to a region (`census_no`, finished flag)        |
| `session_users`      | Volunteers assigned to a session                                       |
| `session_cats`       | Cats logged in a session                                               |
| `interventions`      | Per-cat interventions (type, status, notes)                            |
| `profiles`           | User profiles linked to Supabase auth (carries `auth_role`)            |
| `allowed_emails`     | Registration allowlist with role assignment                           |
| `gsheet_sync_queue`  | Pending forward-sync operations with retry state                       |
| `sync_audit_log`     | History of sync runs (direction, tasks, errors, timing)                |
| `system_config`      | Key-value config store (e.g. `sync_frozen`)                            |

> Regions were migrated from a Postgres enum to a free-text column so they can be managed
> self-serve from the Admin tab. `REGION_NAME_VALUES` in `lib/db/enums.ts` is now only seed
> data, not a DB constraint.

Schema is managed with Drizzle. To apply changes, push directly (not generate/migrate):

```bash
pnpm drizzle-kit push
```

---

## Project Structure

```
agila-app/
├── app/
│   ├── (auth)/login/                 # Google sign-in (allowlist-gated) + not-onboarded
│   ├── (public)/                     # Public home + adoptable cat catalog
│   ├── (protected)/
│   │   └── dashboard/
│   │       ├── overview/             # Stats dashboard + priority locations
│   │       ├── tnvr/                 # TNVR coverage statistics
│   │       ├── database/             # Cat DB — general / medical / interventions tabs
│   │       ├── sessions/             # Census sessions + create + manager review/approval
│   │       └── admin/                # Admin tab (users, regions, GSheet config)
│   ├── api/
│   │   ├── cron/sync/                # Sync endpoint (called by the Cloudflare Worker)
│   │   └── health/                   # Health check
│   ├── actions/                      # Server actions (type-safe via next-safe-action)
│   └── auth/                         # OAuth callback / confirm / signout routes
├── components/
│   ├── ui/                           # Base components (Button, Input, CustomSelect, …)
│   └── app-pages/                    # Feature screens (admin/, database/, sessions/, …)
├── lib/
│   ├── auth/                         # RBAC helpers and permission constants
│   ├── db/                           # Drizzle schema, enums, relations, seed
│   ├── repo/                         # Data access layer (all direct DB queries live here)
│   ├── services/                     # Business logic (sync, photo import, catalog, …)
│   ├── validation/                   # Zod schemas for inputs and GSheet row parsing
│   ├── stats/                        # Census/TNVR statistics
│   ├── supabase/                     # Supabase client/admin/server configs
│   └── hooks/                        # Custom React hooks
├── workers/
│   ├── sync-cron/                    # Cloudflare Worker — scheduled sync trigger
│   └── apps-script/                  # Google Apps Script — sheet edit triggers
├── docs/
│   ├── handbook/AGILA-User-Manual.md # Non-technical user manual (by role)
│   └── gsheets-sync-setup-guide.md   # Sync setup & operations (technical)
├── __tests__/                        # Jest suites (sync-focused)
├── scripts/                          # One-off data import and maintenance scripts
├── drizzle.config.ts
├── next.config.ts
└── CLAUDE.md                         # Frontend development guide
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (this project uses pnpm exclusively — no npm)
- A Supabase project (PostgreSQL + Storage + Auth)
- A Google Cloud project with the Sheets API and Drive API enabled
- A service account with access to the CATalog spreadsheet

### Environment Variables

Contact @legnspice (Niles Cabrera) for access to the following:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google (full service account JSON as a single env var)
SERVICE_ACCOUNT_CREDENTIALS=
CATALOG_SPREADSHEET_ID=

# Discord alerts (optional)
DISCORD_WEBHOOK_URL=

# Sync cron (shared with the Cloudflare Worker)
CRON_SECRET=
```

### Install & Run

```bash
pnpm install
pnpm dev
```

### Apply Schema

```bash
pnpm drizzle-kit push
```

---

## Testing

Tests live in `__tests__/` and run with Jest — **11 suites, 104 tests** at last run, all
green. Coverage is concentrated on the **sync system and its supporting logic** (the riskiest,
least-visible part of the app); UI is not unit-tested.

```bash
pnpm jest __tests__     # run the suite
pnpm tsc --noEmit       # type-check (or `pnpm build`, which also checks types)
```

| Area covered                                       | Suite                                       |
| -------------------------------------------------- | ------------------------------------------- |
| Catalog ID parsing / next-ID / status suffix       | `services/catalog.service.test.ts`          |
| Reverse-sync row parsing & validation              | `validation/reverse-sync.test.ts`           |
| Cat → sheet-row mapping                             | `services/helper-mappers.test.ts`           |
| Sheets API client (retry / pacing)                 | `services/sheets-client.test.ts`            |
| Forward sync + compaction + ID backfill            | `services/forward-sync.test.ts`             |
| Region delete (empty / non-empty / force)          | `services/regions-delete.test.ts`           |
| Effective-region resolution (override vs session)  | `repo/resolve-cat-region.test.ts`           |
| Region-move routing & queue cleanup                | `services/cats-region-routing.test.ts`      |
| Census / TNVR statistics                           | `stats/census-stats.test.ts`                |
| Cat & session actions                              | `actions/cats.test.ts`, `actions/sessions.test.ts` |

The database and Google APIs are mocked per file, so the suite runs offline — no live
spreadsheet or database required.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the Git workflow (feature → dev → prod).
