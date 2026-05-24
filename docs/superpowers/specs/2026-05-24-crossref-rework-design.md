# Cross-Ref Rework — Design

**Date:** 2026-05-24
**Cluster:** D (of 4 — see `project_session_ui_brainstorm_clusters.md`)
**Scope:** `components/app-pages/sessions/sessions-approval-crossref-screen.tsx` + shared toolbar extraction

## Problem

Current cross-ref screen auto-curates "similar cats" with a name-only search toggle. Managers want to look up *any* cat in the database using the same filter/sort/search UX as the database list screen, and decide for themselves which (if any) to merge with. The auto-matching system is unhelpful and is being dropped.

## Goal

- Reuse the database list screen's filter/sort/search machinery on the cross-ref candidate list.
- Extract a shared toolbar component so both screens stay in sync going forward.
- Keep cross-ref's bespoke green merge-card rendering and the merge flow as-is.

## Non-goals

- Visual redesign of the cross-ref screen (deferred to a later pass).
- Changes to the originating-cat header section, Approve/Discard actions, or `MergeDetailsDialog`.
- Changes to the merge data flow (`buildMergeDiff`, `editCat` calls).

## Design

### New shared component: `<CatFilterToolbar>`

Location: `components/app-pages/shared/cat-filter-toolbar.tsx`

Responsibility: render Filter button + Sort button + Search input, own the Filter/Sort dialog state, and run `useFilterSort` on the input cats. Yield the filtered+searched list to the parent via a render-prop child so each screen owns its own list rendering.

Props:

```ts
type CatFilterToolbarProps = {
  cats: CatWithRegion[];
  config: typeof DATABASE_LIST_CONFIG; // FilterSortConfig<CatWithRegion>
  searchFields?: (keyof SelectCat)[];  // defaults to ["name", "color", "spot_last_seen"]
  children: (filteredCats: CatWithRegion[]) => ReactNode;
};
```

Internals:

- Calls `useFilterSort<CatWithRegion>(cats, config, getFilterValue, getSortValue)` with the same accessor logic currently in `database-list-screen.tsx` (handles `region_name` + `last_updated_at` specially, falls back to `cat[key as keyof SelectCat]`).
- Applies the search filter (substring, lowercase) across `searchFields`.
- Renders `<DatabaseFiltersDialog>` and `<DatabaseSortByDialog>` (already in `components/app-pages/database/database-dialogs.tsx`). Keeps the dialog imports there to avoid moving files in this change.

### `database-list-screen.tsx` refactor

Replace the inline toolbar markup + `useFilterSort` call with `<CatFilterToolbar cats={cats} config={DATABASE_LIST_CONFIG}>{(filteredCats) => …}</CatFilterToolbar>`. Existing list rendering inside the render prop is unchanged. Verify no visual regression.

### `sessions-approval-crossref-screen.tsx` refactor

- Keep `getCats({ entry_status: "Original" })` as the data fetch — Merge targets must be Originals; broadening to all entry statuses is a separate concern.
- State type changes: `cat` and `allCats` typed as `CatWithRegion | null` / `CatWithRegion[]` (currently typed `SelectCat`, but the action already returns `CatWithRegion[]`).
- Delete:
  - `similarCats` memo
  - `filteredCandidates` memo
  - `showSearch` boolean state + the "Search 🔍" toggle button
  - Mobile-only inline `<input>` for `searchQuery`
  - Desktop-only `<section>` search bar
- Wrap both mobile and desktop candidate-list blocks in `<CatFilterToolbar cats={allCats} config={DATABASE_LIST_CONFIG}>`. Inside the render prop, render the existing green merge cards (mobile) / desktop merge rows over the yielded `filteredCats`.
- Empty-state copy changes from "No similar cats found. This is likely a new entry." → "No matches." (search/filter is now user-driven; the screen no longer claims to know whether something is "new").
- `searchQuery` local state is removed (toolbar owns it).

### What stays untouched

- `DetailHeader`, Approve/Discard buttons, `MergeDetailsDialog`, `ApproveSessionDialog`, `DeleteSessionDialog`, `buildMergeDiff`, `handleSelectTarget`, `handleMerge`, `handleApprove`, `handleDiscard`.

## Risks / Open items

- `DATABASE_LIST_CONFIG` filters are Region, Color, Age, Sex, Sociability, and Status (`cat_status`: Deceased, MIA, etc.). None touch `entry_status`, so all filters are meaningful on the Original-only result set.
- Render-prop pattern means the toolbar can't memoize the list rendering. Should be fine at current DB sizes; revisit if perf becomes an issue.
- `useFilterSort` accessor logic is duplicated from `database-list-screen.tsx` into the toolbar. Acceptable: the toolbar is now the single owner; the database screen no longer holds its own copy.

## Verification

- `pnpm tsc --noEmit` passes.
- Database list screen renders identically (manual eyeball check — same filter/sort/search behavior, same cards).
- Cross-ref screen:
  - Filter dialog opens, applies, clears.
  - Sort dialog opens, changes order.
  - Search input filters by name/color/spot.
  - Merge button on a row opens `MergeDetailsDialog` with correct diff.
  - Approve/Discard still work.
  - Empty state shows "No matches." when filters/search exclude everything.

## Out of scope (separate clusters)

- A: Sessions screen census number / icons / stats clarification.
- B: Create entry modal (remove status, Unknown→null, spot input).
- C: Edit entry modal pre-uploaded photo display.
