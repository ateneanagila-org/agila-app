# Codebase Analysis — Findings & Fix Backlog

> Derived from a full-codebase review on 2026-06-04 (branch `dev`), evaluated against
> the AGILA CATalog proposal (masterfile) and the App DB Sync Architecture doc.
> Intended to be worked in a separate code session. Each item lists **location**,
> **problem**, and **suggested fix**. Severity order: High → Medium → Low.

---

## HIGH — correctness

### H1. Region analytics ignore the data model (free-text substring matching)

- **Where:** [overview-screen.tsx](../components/app-pages/overview/overview-screen.tsx#L43-L102), [tnvr-screen.tsx](../components/app-pages/tnvr/tnvr-screen.tsx#L114), [constants.ts](../components/app-pages/shared/constants.ts)
- **Problem:** Overview and TNVR filter/bucket cats by `spot_last_seen?.toUpperCase().includes(location)` against a **hardcoded `LOCATIONS` array**, while the rest of the app (database, catalog, sessions) uses the `region_id` FK + the `regions` table (the source of truth). Three divergent region sources now exist: `REGION_NAME_VALUES` (enum seed), `LOCATIONS` (UI constant), and the `regions` table.
- **Consequences:**
  - **Substring collisions miscount stats** — a cat in `JSEC` matches `SEC` first (SEC precedes JSEC, loop breaks on first hit); `NEW RIZAL` / `OLD RIZAL` both contain `RIZAL`.
  - **Admin-added regions never appear** in the Overview/TNVR location pickers (list is static).
  - **Spelling drift** — `LOCATIONS` has `EBAI'S`, `DELA COSTA`, `BERCH`, `IRH`, `IGGY'S`, `IRWIN`, `MNL OBS` that aren't in the enum; enum has `EBAIS` / `FAURA` spelled differently.
- **Why it matters:** This is feature #1 of the proposal ("relevant general statistics… filter by location"). The raw records are clean; the rollups feeding the dashboards are suspect.
- **Fix:**
  1. Join `region_name` into the overview/TNVR cat query (database/catalog screens already do this via `CatWithRegion`).
  2. Bucket/filter by `region_id` / `region_name`, not `spot_last_seen` substrings.
  3. Source the location picker from `useRegions()` instead of the `LOCATIONS` constant.
  4. Once nothing references it, delete/retire the `LOCATIONS` constant.

---

## MEDIUM

### M1. Two client components bypass the 4-layer architecture

- **Where:** [cat-entry-form.tsx:184](../components/app-pages/shared/cat-entry-form.tsx#L184), [sessions-create-screen.tsx:81](../components/app-pages/sessions/sessions-create-screen.tsx#L81)
- **Problem:** Both call `supabase.from("regions").select("id,name")` directly from the browser client, bypassing the action → repo layer. A correct `useRegions()` hook (→ `listRegions` action → repo) already exists and is used by other screens.
- **Risk:** Inconsistent with the stated architecture; depends on `regions`-table RLS being correctly configured for anon/auth read.
- **Fix:** Replace both direct queries with `useRegions()`. Confirm RLS on `regions` afterward regardless.

### M2. "Last PAWS update" is a fake metric

- **Where:** [overview-screen.tsx:124-130](../components/app-pages/overview/overview-screen.tsx#L124-L130)
- **Problem:** "Last update" and "Last PAWS update" both bind to the same `formatLatestUpdate(allCats)` value — they always display identical dates, which is misleading.
- **Fix:** Either source a real PAWS-update timestamp, or remove the "Last PAWS update" line until that data exists.

### M3. Cron observability gap

- **Where:** [app/api/cron/sync/route.ts](../app/api/cron/sync/route.ts)
- **Problem:** The route returns `200` immediately via `after()`. Thrown errors auto-freeze + alert (good), but a silent Fluid-instance termination mid-write leaves the Cloudflare worker believing the run succeeded.
- **Severity note:** Acceptable at current scale; log here so it isn't forgotten.
- **Fix (later):** Add a completion heartbeat / "sync finished" audit marker the worker (or a monitor) can verify, so partial/killed runs are detectable.

---

## LOW — polish / cleanup

### L1. Encoding corruption in source strings
- **Where:** [helper.service.ts:279](../lib/services/helper.service.ts#L279) and nearby comments/logs.
- **Problem:** Em-dashes mangled to `â€"` (UTF-8 written as CP1252). Cosmetic, but logs print garbled.
- **Fix:** Re-save affected strings/comments as clean UTF-8; ensure editor encoding is UTF-8.

### L2. Duplicate/stale test file
- **Where:** `tests/services/sheets-client.test.ts` **and** `__tests__/services/sheets-client.test.ts`.
- **Fix:** Confirm which is canonical (`__tests__/` matches the rest of the suite) and delete the stray `tests/` copy.

### L3. Dead "FOR TESTING" enum shipped
- **Where:** [enums.ts:208-217](../lib/db/enums.ts#L208-L217) (`URGENCY_VALUES` / `urgencyEnum`), plus its `pgEnum` in the DB.
- **Fix:** Remove if unused; drop the DB enum via a schema push if it was ever created.

### L4. Modal a11y — no Escape / no focus trap
- **Where:** [cat-entry-form.tsx](../components/app-pages/shared/cat-entry-form.tsx#L381) (and likely other custom modals).
- **Problem:** Closes only on backdrop click; no Escape-to-close, no focus trap, no `role="dialog"`/`aria-modal`.
- **Fix:** Add Escape handler, focus trap, and dialog ARIA. Consider a shared modal primitive so every dialog inherits it.

### L5. Public catalog has no pagination ceiling
- **Where:** [catalog-screen.tsx:65-77](../components/app-pages/catalog/catalog-screen.tsx#L65-L77)
- **Problem:** Fetches **all** adoptable cats, then filters/searches client-side. Fine at current scale (hundreds); no ceiling if the adoptable set grows large.
- **Fix (only if needed):** Add server-side pagination / lazy loading when the adoptable count warrants it. Not urgent.

### L6. Doc drift in context CLAUDE.md
- **Where:** [.claude/context/CLAUDE.md](../.claude/context/CLAUDE.md)
- **Problem:** Commands reference `npm run …`; the project mandates **pnpm** (root CLAUDE.md). Minor stale guidance.
- **Fix:** Update the context copy to pnpm, or note it defers to the root CLAUDE.md.

---

## NOT bugs — deferred / launch-phase work (out of scope for the fix session)

Captured here so nothing is lost; these are sequenced after the issues above.

- **Public-launch metadata + social cards** — near public launch (NOT before the manager adoption test). Add page `<title>`/meta description for `/` and `/catalog`, Open Graph / social-card tags, and per-cat `generateMetadata` on `/catalog/[id]` (OG image = cat photo) so shared links unfurl richly. This amplifies AGILA's primary (social/share) acquisition channel. ~an afternoon in App Router.
- **Local-intent SEO content (phase 2 growth)** — after launch is stable. Real location-relevant content on the **stable catalog index** ("Adoptable Cats in Quezon City & Metro Manila"), good titles, and local structured data (Organization/`areaServed`). NOT a `<meta keywords>` tag (dead) and NOT individual cat pages (they churn). Keep geography truthful (QC / Metro Manila / NCR). Modest, high-intent payoff — keep it to an afternoon of content + a schema block.
- **Sync technical-overview handover doc** — already tracked in project memory. Highest-value sustainability item: converts the bespoke sync engine from a handover liability into an asset. Write after sync quota-hardening settles.
