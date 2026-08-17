# Developer guide

**Read this first if you are new to the codebase.** It gets you running, shows you how the
code is laid out, and walks one change end to end. It deliberately does **not** restate the
reference material — [README.md](README.md) maps that, and the architecture docs go deep.

---

## 1. What this is

A campus cat census for Ateneo de Manila, with two faces:

- an **internal dashboard** — census sessions, the cat database, TNVR tracking, admin
- a **public adoption catalog** — no login, indexed by Google

The load-bearing idea, and the source of most of the system's complexity:

> The database is the source of truth, but the app is an **overhead layer** over AGILA's
> existing Google Sheets. Those sheets stay live and two-way synced, so the org always has
> a fallback it already knows how to use.

Nearly every non-obvious rule in this codebase exists to keep that two-way sync honest. If
something looks redundant, assume it is load-bearing until you have read
[architecture/sync-engine.md](architecture/sync-engine.md).

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 4 ·
Drizzle ORM + Supabase Postgres · Zod 4 · next-safe-action · Jest.

---

## 2. Getting it running

```bash
pnpm install
cp .env.example .env   # then fill it in
pnpm dev
```

`pnpm` only — never npm; the lockfile is pnpm's.

[`.env.example`](../.env.example) lists the **ten** variables the application actually
reads, grouped and annotated. Values come from the Vercel project's environment settings —
ask an admin for access. There is no way around this step: the app cannot start without a
database URL, and sync cannot run without the service-account JSON.

If you inherit an existing `.env`, it may carry several variables the app does **not** read
— `SUPABASEDB_PASS`, `SUPABASE_AUTH_EXTERNAL_*`, `PHOTO_WEBAPP_*`,
`APP_SCRIPT_MODE_PROMPT_SECRET`. The first two are Supabase dashboard config; the rest are
legacy from a deleted Apps Script web app. You need none of them.

### There is no staging environment

**Read this before you run anything.** Local development points at **production**. There
is one Supabase project, one spreadsheet, one bucket. That is a deliberate choice for an
org this size, but it means your laptop is a production client:

| What you do locally | What actually happens |
| --- | --- |
| Edit a cat | Writes to the production database |
| Upload a photo | Writes to the real `cat-photos` bucket |
| Any admin action (provision sheets, seed UUIDs, reclaim photos) | Calls the **live spreadsheet** directly |
| Edit anything that syncs | Enqueues a real sync task — **production cron pushes it to the sheet within 20 minutes** |

That last row is the one that surprises people. The cron tick itself does *not* fire
locally — it is driven by the Cloudflare Worker calling the deployed URL, so `pnpm dev`
never runs a sync tick. But local edits queue tasks in the shared database, and the
production tick drains that queue. **A local experiment reaches AGILA's spreadsheet
asynchronously, after you have closed your laptop.**

Practical consequences:

- Do your experimenting on cats you created, and clean them up.
- Never point a local run at the admin panel's destructive buttons to "see what they do."
- If you need to test sync behaviour, write a test. The suite mocks every external seam
  and runs offline — that is what it is for.

### Verifying without running the app

The project convention is **not** to run `pnpm dev` to check your work:

```bash
pnpm tsc --noEmit     # type-check
pnpm jest __tests__   # 35 suites, fully mocked, ~3s
pnpm lint             # note: 2 errors + 3 warnings are a known pre-existing baseline
pnpm build            # also type-checks
```

---

## 3. How the code is organised

The layering is strict and enforced by convention rather than tooling, so it is on you:

```
app/actions/*    →  auth gate + zod schema, via next-safe-action
lib/services/*   →  transactions, business rules, sync queueing
lib/repo/*       →  EVERY direct db.* call lives here
```

**Services must never call `db.*` directly.** Add a query function to the repo instead.
There are a few pre-existing violations in `cats.service.ts`; they are grandfathered, not
precedent.

Read one real path top to bottom — [`app/actions/cats.ts`](../app/actions/cats.ts):

```ts
export const editCat = actionClient
  .schema(editCatSchema)                          // 1. validate input
  .action(async ({ parsedInput }) => {
    await requireRole(...MANAGER_OR_ADMIN);       // 2. authorise, server-side
    return await service.editCat(parsedInput);    // 3. delegate; no logic here
  });
```

Three lines, three jobs, and no business logic in the action. That shape is the
convention. Client-side gating with `canManage` from `useAuth()` is for *hiding buttons*;
the server re-checks independently every time, and client gating alone is never sufficient.

**Where things live:**

| Path | Contents |
| --- | --- |
| `app/` | routes, server actions, API routes |
| `components/ui/` | primitives |
| `components/app-pages/` | feature screens |
| `lib/repo/` | all database queries |
| `lib/services/` | business logic, transactions, sync |
| `lib/validation/` | Zod schemas, mostly derived via `drizzle-zod` |
| `lib/db/` | Drizzle schema, enums, relations |
| `workers/` | Cloudflare cron Worker · Apps Script `.gs` files |

`lib/types/` and `lib/validation/` are **shapes only, no logic**.

---

## 4. Walkthrough: adding a field to a cat

This is the traversal that makes the codebase learnable, and it is longer than you expect.
Suppose you are adding `microchip_id`.

**1. Schema** — [`lib/db/schema.ts`](../lib/db/schema.ts). Add the column.

**2. Push it.** `pnpm drizzle-kit push` — *not* generate/migrate. Note that
[`drizzle.config.ts`](../drizzle.config.ts) reads `DIRECT_DATABASE_URL`, not
`DATABASE_URL`: push needs a direct connection because it cannot run through Supabase's
transaction pooler.

**3. Make it readable.** [`lib/repo/cats.repo.ts`](../lib/repo/cats.repo.ts) has an
explicit `catReadColumns` list rather than `select()`. **A new column is invisible to
every read until you add it there** — no type error, no runtime error, just `undefined`
everywhere.

**4. Validation** — [`lib/validation/cats.ts`](../lib/validation/cats.ts). Most schemas
are `drizzle-zod`-derived so they follow automatically, but an editable field needs adding
to `editCatSchema`.

**5. Service** — if the field affects what the spreadsheet should show, the service must
call `refreshCatInSyncQueue` so a forward-sync task is queued.

**6. UI** — the form and the display. Watch for `Pick<SelectCat, ...>` prop types in
components: they enumerate fields explicitly, so a new field silently reads as its default.
This bit us for real — `CatCard` omitted `photo_rotation` and every photo in the two
highest-traffic lists rendered unrotated, with no error anywhere.

**7. Sheet mappers** — if it belongs in the spreadsheet,
[`lib/services/helper.service.ts`](../lib/services/helper.service.ts) has **two**:
`mapCatToSheetRow` (region tabs) and `mapUnknownCatToSheetRow` (the UNKNOWN tab). Update
both or the tabs disagree.

**8. Reverse parsers** — [`lib/validation/reverse-sync.ts`](../lib/validation/reverse-sync.ts)
likewise has **two**: `parseSheetRow` and `parseUnknownSheetRow`.

**9. Tests.** See below.

> **A new spreadsheet column is a much bigger change than a new database column.** The
> column contract is fixed: `A` = catalog number + status suffix, `B` = `=IMAGE()` photo,
> `C–V` = data, `W` = edit timestamp, `X` = editor email, `Y` = **UUID (the record key)**.
> Inserting a column shifts every index in both mappers, both parsers, the Apps Script, and
> the live sheet. Read [architecture/sync-engine.md](architecture/sync-engine.md) first and
> budget accordingly.

---

## 5. Testing

35 suites, ~350 tests, all offline. `testEnvironment: "node"` — **there are no component
tests**, and UI is not unit-tested. Coverage is concentrated where the risk is: the sync
engine.

The pattern is *mock the seams, then import the module under test* — and the order
matters, because `jest.mock` calls are hoisted but the module registry is not:

```ts
// Mock the seams BEFORE importing the module under test
jest.mock("@/lib/db", () => ({ db: {}, Transaction: class {} }));
jest.mock("@/lib/repo/cats.repo", () => ({ findCatsByIds: jest.fn() }));
jest.mock("@/lib/services/sheets-client.service", () => ({
  wrapSheetsClient: (raw: unknown) => raw,   // identity — skips the 1.2s pacing
  __resetPacingForTests: () => {},
}));

import { syncAndCompactRegion } from "@/lib/services/helper.service";
```

**The three seams you will mock:**

| Seam | Why |
| --- | --- |
| `@/lib/db` | no database in tests |
| `@/lib/repo/*` | stub the query layer, assert what the service asked for |
| `@/lib/services/sheets-client.service` | bypass the ~1.2s inter-call pacing, or suites take minutes |

Because everything is mocked, **the suite cannot catch a bad SQL fragment.** A malformed
`regionSubquery` passes all 350 tests. Verify database-shaped changes against real data
with a throwaway script (`pnpm tsx scripts/…`), not by trusting green.

**When a sync test fails, the invariant is usually real.** The existing assertions encode
deliberate-looking oddities that fix genuine bugs. Understand why it fails before you
change what it asserts.

---

## 6. Deploying

Vercel builds on push. There is no separate deploy step.

- `dev` is the working branch; `prod` is the deploy branch.
- The Cloudflare Worker is deployed separately, from `workers/sync-cron/`, via
  `wrangler deploy`. Its secrets (`APP_URL`, `CRON_SECRET`, `DISCORD_WEBHOOK_URL`) are set
  with `wrangler secret put` and are **not** in the repo.
- `CRON_SECRET` must match on both sides. Rotate one alone and every tick 401s.

---

## 7. Environment variables

| Var | Issued by | Used for | If wrong |
| --- | --- | --- | --- |
| `DATABASE_URL` | Supabase | app's pooled connection | app fails to start |
| `DIRECT_DATABASE_URL` | Supabase | `drizzle-kit push` only | schema pushes fail |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | client SDK | photo display breaks |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | client SDK | photo display breaks |
| `NEXT_SUPABASE_SERVICE_ROLE_KEY` | Supabase | server-side storage writes | uploads fail |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` | Google Cloud | Google sign-in | **nobody can log in** |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` | Google Cloud | Google sign-in | **nobody can log in** |
| `SERVICE_ACCOUNT_CREDENTIALS` | Google Cloud | Sheets read/write identity | sync dies, app fine |
| `CATALOG_SPREADSHEET_ID` | the spreadsheet | sync target | sync dies, app fine |
| `CRON_SECRET` | you | authenticates `/api/cron/sync` | every tick 401s |
| `NEXT_PUBLIC_SITE_URL` | you | sitemap, robots, canonical URLs | SEO breaks silently |
| `APP_URL` | you | the Worker's target | sync stops |
| `DISCORD_WEBHOOK_URL` | Discord | sync alerts (optional) | failures go unnoticed |

Note the failure modes differ in kind. A bad `DATABASE_URL` is loud — nothing works. A bad
`NEXT_PUBLIC_SITE_URL` is **silent**: the app is fine, and you find out when the catalog
falls out of Google's index weeks later.

`PHOTO_WEBAPP_URL`, `PHOTO_WEBAPP_SECRET`, and `APP_SCRIPT_MODE_PROMPT_SECRET` are legacy
from a deleted Apps Script web app. See `operations/gsheets-sync-setup.md` §8.

---

## 8. Troubleshooting

**Sync stopped.** Check Admin → GSheet Config first. A tick that throws sets the freeze
flag automatically, which is a safety pause, not the killswitch — the button says
Unfreeze. If it is not frozen, check the Worker's logs and that `CRON_SECRET` still
matches.

**A cat is missing from the spreadsheet.** Reconciliation (Phase 0.5) repairs presence on
each tick, so give it 20 minutes. If it persists, run `scripts/reconcile-sheet.ts` — a
read-only report. Note it repairs *presence*, not *cell contents*.

**A cat is on two tabs.** A region move that queued an UPDATE without a DELETE to the old
tab. The effective-region rule is `COALESCE(cats.region_id override, most recent session's
region)`, written once as `effectiveRegionIdSubquery` with two derived consumers and two
hand-maintained duplicates that must agree — see
[architecture/data-model.md](architecture/data-model.md). Nothing tests it; verify against
real data.

**Photos vanished from the sheet.** Column B is rebuilt from the database every tick
precisely because a formatted-value read returns `""` for `=IMAGE()` cells. If you touched
the read path, that is your suspect.

**A sheet row is ignored entirely.** It has no column-Y UUID. Reverse sync skips such rows
by design. Admin → GSheet Config → Seed missing UUIDs.

**Tests pass but production is wrong.** Expected — every external seam is mocked. Verify
against real data with a script.

---

## 9. Going deeper

| Read | For |
| --- | --- |
| [architecture/sync-engine.md](architecture/sync-engine.md) | the column contract, cron phases, conflict rules, and the invariants that look like dead code |
| [architecture/data-model.md](architecture/data-model.md) | schema, cat and session lifecycles, effective region |
| [architecture/frontend.md](architecture/frontend.md) | the mobile/desktop two-screen strategy |
| [operations/gsheets-sync-setup.md](operations/gsheets-sync-setup.md) | provisioning, cutover, production recovery |
| [operations/handoff.md](operations/handoff.md) | transferring account ownership |
| [operations/decommissioning.md](operations/decommissioning.md) | retiring the sync deliberately |
| [/CLAUDE.md](../CLAUDE.md) | the same conventions in imperative form, for AI agents |
| `specs/` | active design specs; `archive/` is historical and not current truth |
