# QA Fixes Plan

Batch of QA issues across overview, TNVR, review/validation, cat-detail, and the
shared filter system. Decisions locked with the owner are noted inline.

## Decisions
- **#34 Discard buttons:** unify to **solid orange pill, `rounded-full`, label "Discard", `✕` icon**. Align each paired Approve button to `rounded-full` so siblings match.
- **#40 Filter "Unknown":** keep the option, fix matching so it reliably selects null/empty records everywhere.
- **#37 Chart headers:** relabel, do not delete. TNVR chart header → **"Stats Breakdown"**; overview chart header → **"Population by Location"**.

## Tasks

### 1. Overview — `components/app-pages/overview/overview-screen.tsx`
- Remove non-functional **"Sort By"** buttons (mobile + desktop).
- Remove non-functional **"..." period menu** (button + dropdown, both layouts) and dead state: `showPeriodMenu`, `activePeriods`, `OVERALL_PERIODS`, `LOCATION_PERIODS`.
- **Hide population chart when a specific location is selected** (mobile gate on `location === "Overall"`, desktop on `dashboardMode === "Overall"`).
- Rename chart header **"Population" → "Population by Location"**.

### 2. TNVR — `components/app-pages/tnvr/tnvr-screen.tsx`
- **#38** Remove mobile **Category dropdown** (no onChange, no desktop equivalent).
- **#37** Rename chart header **"TNVR Statistics" → "Stats Breakdown"** (mobile + desktop).

### 3. Review / Validation — `components/app-pages/sessions/sessions-approval-validation-screen.tsx`
- **#32** Desktop image: replace static `<CatIcon>` with `<CatPhoto photoUrl={cat?.photo_url} …>`.
- **#34** Discard buttons → solid orange, `rounded-full`, "Discard", `✕` (mobile + desktop; desktop currently says "Cancel").

### 4. Cross-Reference — `components/app-pages/sessions/sessions-approval-crossref-screen.tsx`
- **#33** Add desktop **"Previous"** link → validation screen (beside "Back").
- **#34** Bring mobile Discard button to canonical solid-orange style (desktop already canonical).
- **#41** Surface **`is_neutered`** in the merge diff: add a "Neutered" field (Yes/No/Unknown) from the already-fetched health records, write resolved value to target via `editCat`.

### 5. Interventions — `components/app-pages/database/database-interventions-screen.tsx`
- **#36** Remove mobile **FAB** (overlaps Done; toolbar already has "New Intervention").
- **#43** Fix `StatusPill` enum mismatch: `"Completed"` → `"Finished"`. Live-verify desktop select interaction; patch `CustomSelect` only if a real bug surfaces.

### 6. #35 Cat-detail tab/separator spacing
Add top padding to the TopTabs wrapper across general/medical/interventions identity cards.

### 7. #40 Filter "Unknown" matching
Audit `getFilterValue` ↔ option-list symmetry in `cat-filter-toolbar.tsx` + `filter-sort-configs.ts`. Ensure "Unknown" selects null/empty records consistently, including screens passing un-enriched cats (crossref, sessions-manager).

### 8. #42 Filter modal slow
`database-list-screen.tsx`: stop blocking modal open behind `loadFilterData`. Open immediately, enrich (health + interventions) in background, merge when ready.

### 9. Verify-only
- **#45** Search debounce (250ms) present + correct — confirm, no change.
- **#44** Cat-detail Cancel/Discard resets form from context — looks functional; verify live, add dirty-detection only if warranted.
