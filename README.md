# AGILA — Campus Cat Management System

**AGILA** is a TNvR (Trap-Neuter-Vaccinate-Release) and community cat management system built for the Ateneo de Manila University campus. It gives campus caretakers, student volunteers, and administrators a unified platform to track cats, manage TNVR sessions, record health interventions, and coordinate data entry through a bidirectional Google Sheets integration.

---

## Background

Ateneo de Manila University maintains a campus-wide cat welfare program. Volunteers and caretakers track hundreds of cats across 36 campus locations — recording their health status, neutering history, vaccination records, and adoption eligibility. Historically, this data lived in a shared Google Sheets workbook (the "CATalog"), edited directly by volunteers.

AGILA formalizes this workflow. It treats the CATalog spreadsheet as the primary volunteer-facing data entry surface while maintaining a proper database backend for querying, reporting, and long-term records. A bidirectional sync engine keeps both in sync automatically. Volunteers never have to touch the app; managers and admins use it to oversee data quality, run TNVR sessions, and manage system health.

---

## Tech Stack

| Layer            | Technology                                         |
| ---------------- | -------------------------------------------------- |
| Framework        | Next.js 16 (App Router, React 19)                  |
| Language         | TypeScript (strict)                                |
| Styling          | Tailwind CSS 4                                     |
| UI Primitives    | Radix UI + custom components                       |
| Data Fetching    | TanStack Query 4                                   |
| Server Actions   | `next-safe-action` 8                               |
| Validation       | Zod 4                                              |
| ORM              | Drizzle ORM + Drizzle Kit                          |
| Database         | PostgreSQL (via Supabase)                          |
| Auth             | Supabase Auth (SSR)                                |
| Storage          | Supabase Storage (photos)                          |
| Google APIs      | Sheets API, Drive API                              |
| Image Processing | Sharp (server), browser-image-compression (client) |
| Scheduled Jobs   | Cloudflare Workers (sync cron)                     |
| Alerts           | Discord Webhooks                                   |
| Charts           | Recharts                                           |

---

## Architecture

### Data Flow

The CATalog Google Sheet is the volunteer-facing source of truth for data entry. The database is the authoritative store for querying and application logic. A sync engine bridges them in both directions:

```
Volunteers → Google Sheets (CATalog)
                   ↕ bidirectional sync
             PostgreSQL (Supabase)
                   ↕
            AGILA Web App (managers/admins)
```

**Forward sync** (DB → Sheet): reads cat records per region from the database and writes them to the corresponding sheet tab via the Sheets API. Runs on schedule and on demand.

**Reverse sync** (Sheet → DB): reads each region's sheet tab via the Sheets API, parses rows with Zod schemas, and upserts changes into the database. Rows without a recent edit timestamp (column W) are skipped. Conflict resolution: if a DB record was updated within a 5-second window before a sheet edit, the DB wins.

**Photo import**: runs before each sync cycle. Downloads the full spreadsheet as an xlsx export, parses it as OOXML to locate embedded cell images by their row anchor position, matches them to cat UUIDs in column Y, processes the image bytes with Sharp, and uploads to Supabase Storage. The resulting public URL is written back to the cat record.

**Sync scheduling**: a Cloudflare Worker fires on a cron schedule, health-checks the app, and hits the `/api/cron/sync` endpoint to trigger forward + reverse sync across all regions. Failures post alerts to Discord.

### Google Apps Script

A script installed as an installable trigger on the CATalog spreadsheet handles the sheet-side bookkeeping:

- Auto-timestamps edits in column W
- Records the editor's email in column X
- Auto-generates a UUID in column Y on first data entry (used as the stable record key across sync)
- Skips writes made by the service account to prevent sync loops

### Sync Queue & Audit Log

Forward sync writes are queued in a `gsheet_sync_queue` table and processed with retry logic. Every sync run (forward or reverse) is recorded in `sync_audit_log` with region, direction, task counts, and error details.

Admins can freeze syncs via a `system_config` flag (`sync_frozen`). A Google Apps Script web app endpoint also exposes emergency freeze/unfreeze via a secret-protected URL — useful when the main app is unreachable.

---

## Features

### Cat Database

The core of the app. Each cat record includes:

- **Identity**: name, color, age, sex, sociability, caretaker, notes
- **Status**: active, deceased, fostered, adopted, MIA, unknown
- **Location**: one of 36 campus regions
- **Health record**: vaccination date, neuter date, health condition
- **Photo**: uploaded directly or imported from the spreadsheet
- **Catalog fields**: `catalog_id` (public-facing ID), `paws_id` (university registry ID)
- **Merge tracking**: cats can be merged; `merged_into_id` tracks deduplication

Cat entry goes through an explicit status workflow (`Unsubmitted → Unreviewed → Merged → Original`) that reflects the data review pipeline.

### TNVR Sessions

Managers create sessions scoped to a campus region. A session groups cats and volunteers for a single TNVR or vet intervention event.

- Volunteers are added to the session roster
- Cats are assigned to the session (drag-and-drop interface)
- Interventions are logged per cat (type: TNVR or Veterinarian; status: Pending, Finished, Cancelled)
- Sessions go through a two-step approval workflow: **Validation** (reviewing session data) → **Cross-Reference** (comparing DB state against sheet edits made during the session)

### User Management

Administrators manage user accounts and roles through an allowlist system. Only pre-approved emails can register. Three roles exist:

| Role          | Capabilities                                    |
| ------------- | ----------------------------------------------- |
| Volunteer     | Read-only access to cat data and sessions       |
| Manager       | Create/edit cats, run sessions, trigger syncs   |
| Administrator | All of the above + user management, admin panel |

Access is enforced at the server action level via RBAC middleware (`requireRole(...)`).

### Public Catalog

A public-facing directory of cats marked as `is_adoptable = true`. No authentication required. Accessible at the app root. Includes search and individual cat detail pages.

### Overview & TNVR Dashboards

- **Overview**: population statistics, sync health, regional breakdowns
- **TNVR**: intervention progress by region, charts showing neutering coverage

### Admin Panel

System-level tools for administrators: photo import utilities, sync freeze controls, and debug tooling.

---

## Database Schema

Core tables:

| Table                | Purpose                                                           |
| -------------------- | ----------------------------------------------------------------- |
| `cats`               | Cat records (identity, status, location, catalog/paws IDs)        |
| `cat_health_records` | One-to-one health record per cat (vaccination, neuter, condition) |
| `regions`            | 36 campus locations (enum-backed)                                 |
| `sessions`           | TNVR/vet sessions scoped to a region                              |
| `session_users`      | Volunteers assigned to a session                                  |
| `session_cats`       | Cats assigned to a session                                        |
| `interventions`      | Individual interventions per cat (type, status, notes)            |
| `profiles`           | User profiles linked to Supabase auth                             |
| `allowed_emails`     | Registration allowlist with role assignment                       |
| `gsheet_sync_queue`  | Pending forward-sync operations with retry state                  |
| `sync_audit_log`     | History of sync runs (direction, tasks, errors, timing)           |
| `system_config`      | Key-value config store (e.g. `sync_frozen`)                       |

Schema is managed with Drizzle ORM. To apply schema changes:

```bash
pnpm drizzle-kit push
```

---

## Project Structure

```
agila-app/
├── app/
│   ├── (auth)/login/             # Email login (Ateneo domain restricted)
│   ├── (public)/                 # Public home + adoptable cat catalog
│   ├── (protected)/
│   │   ├── (app)/
│   │   │   ├── database/         # Cat database management
│   │   │   ├── sessions/         # TNVR session management
│   │   │   ├── tnvr/             # TNVR dashboard
│   │   │   ├── overview/         # Stats dashboard
│   │   │   └── users/            # User management (admin)
│   │   └── admin/                # Admin panel
│   ├── api/
│   │   ├── cron/sync/            # Sync endpoint (called by Cloudflare Worker)
│   │   └── health/               # Health check
│   └── actions/                  # Server actions (type-safe via next-safe-action)
├── components/
│   ├── ui/                       # Base components (Button, Input, CustomSelect, …)
│   └── app-pages/                # Feature screens (database/, sessions/, users/, …)
├── lib/
│   ├── auth/                     # RBAC middleware and permission constants
│   ├── db/                       # Drizzle schema, enums, relations, seed
│   ├── repo/                     # Data access layer (cats, sessions, interventions, …)
│   ├── services/                 # Business logic (sync, photo import, catalog, …)
│   ├── validation/               # Zod schemas for all inputs and GSheet row parsing
│   ├── supabase/                 # Supabase client/admin configs
│   └── hooks/                    # Custom React hooks
├── workers/
│   ├── sync-cron/                # Cloudflare Worker — scheduled sync trigger
│   └── apps-script/              # Google Apps Script — sheet triggers + web app
├── scripts/                      # One-off data import and maintenance scripts
├── drizzle/                      # Generated migrations
├── drizzle.config.ts
├── next.config.ts
└── CLAUDE.md                     # Frontend development guide
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- A Supabase project (PostgreSQL + Storage + Auth)
- A Google Cloud project with Sheets API and Drive API enabled
- A service account with access to the CATalog spreadsheet

### Environment Variables

Contact @legnspice (Niles Cabrera) for access to the following env variables:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google (full service account JSON as a single env var)
SERVICE_ACCOUNT_CREDENTIALS=
CATALOG_SPREADSHEET_ID=

# Discord alerts
DISCORD_WEBHOOK_URL=

# Sync cron (Cloudflare Worker)
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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the Git workflow (feature → dev → prod).
