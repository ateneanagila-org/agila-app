# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AGILA CATalog** — a cat census and management platform for Ateneo de Manila University. Tracks cats across campus regions, field sessions, health records, and TNVR (Trap-Neuter-Vaccinate-Return) interventions. Data syncs to regional Google Sheets for external stakeholders.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run all Jest tests
npm run test:watch   # Jest in watch mode
npm run test:cat     # Run only cat action tests (__tests__/actions/cats.test.ts)
```

Database (Drizzle Kit):
```bash
npx drizzle-kit generate   # Generate migrations from schema changes
npx drizzle-kit migrate    # Apply migrations
npx drizzle-kit studio     # Open Drizzle Studio
```

## Architecture

### Layer Stack

All data flows through a strict 4-layer architecture:

```
Client Component
    ↓ awaits the action directly, reads { data?, serverError? }
Server Action (/app/actions/)       ← validates with Zod + actionClient (next-safe-action)
    ↓
Service Layer (/lib/services/)      ← business logic, transactions, Google Sheets sync
    ↓
Repository Layer (/lib/repo/)       ← Drizzle ORM queries
    ↓
PostgreSQL (Supabase)
```

- **Server Actions** use `actionClient` from `next-safe-action`. Always chain `.schema(zodSchema)` for input validation. Returns `{ data?, serverError?, validationErrors? }`.
- **Services** own transactions (`db.transaction()`). If an operation touches multiple tables (e.g., creating a cat also inserts a health record and syncs to Sheets), that logic lives in a service.
- **Repos** are thin — only Drizzle queries, no business logic.

### Type Safety Pipeline

`/lib/db/schema.ts` → `drizzle-zod` auto-generates base Zod schemas → manually extended in `/lib/validation/` → TypeScript types inferred from Zod. Always extend auto-generated schemas rather than duplicating them.

### Authentication & Authorization

- Auth: Supabase Auth + Google OAuth. Two Supabase clients exist: browser client (`lib/supabase/client.ts`) and server client (`lib/supabase/server.ts`) — use the correct one for context.
- Protected routes live under `/(protected)/(app)/`. The layout checks auth and redirects to `/login` if unauthenticated, then wraps children in `AuthProvider`.
- Use `useCurrentUser()` hook (from `lib/hooks/`) in client components to access the current user's profile.

### Route Groups

```
app/
  (auth)/login/         # Login page + Supabase OAuth callback
  (public)/             # Catalog + home (no auth required)
  (protected)/(app)/    # All app features (auth required)
    database/           # Cat management (CRUD, health records)
    sessions/           # Field session management
    overview/           # Dashboard
  actions/              # All Server Actions
  api/                  # API routes (minimal — prefer server actions)
```

### Google Sheets Integration

Cat create/update operations in the service layer call `connectToSheets()` to sync data to regional spreadsheets. Credentials come from `SERVICE_ACCOUNT_CREDENTIALS` (JSON string env var) and `CATALOG_SPREADSHEET_ID`. When modifying cat-related services, be mindful that Sheets sync is part of the transaction.

### Error Handling

- `AppError` (from `lib/error/`) for domain/business exceptions — throw these in services.
- `actionClient` in server actions catches `AppError` and serializes it as `serverError`.
- Client-side: components `await` the action and read `result.data` / `result.serverError` (managing their own loading state). For new mutation UIs prefer `next-safe-action`'s own `useAction` hook or React's `useActionState`/`useTransition`.

## Key Environment Variables

```
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET
CATALOG_SPREADSHEET_ID
SERVICE_ACCOUNT_CREDENTIALS   # JSON string of Google service account
NEXT_PUBLIC_SITE_URL
CRON_SECRET                   # Bearer token for /api/cron/sync endpoint
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), React 19 |
| Styling | Tailwind CSS 4, CVA, Radix UI |
| Database | PostgreSQL via Supabase, Drizzle ORM |
| Auth | Supabase Auth, Google OAuth |
| Validation | Zod, drizzle-zod, next-safe-action |
| Data Fetching | TanStack Query v4 |
| External APIs | Google Sheets (googleapis) |
| Testing | Jest 30, Testing Library |
