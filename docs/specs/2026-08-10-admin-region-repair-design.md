# P1 — Admin & Region Repair

**Date:** 2026-08-10
**Status:** Design approved, pending implementation plan
**Scope:** Finalization items 4 (fix admin) and 5 (region adding broken)

## Context

This is the first of four sub-projects in the finalization effort. The full decomposition:

| Phase | Contents |
| ----- | -------- |
| **P1** (this) | Fix Admin screen; repair region adding/deleting |
| P2 | Move hardcoded referral links + bug-report target into admin-editable config |
| P3 | Sync killswitch (deprecation), handoff/decoupling guide, storage gaugeᵃ |
| P4 | Photo rotation, vaccination expiry warning, basic SEO |
| Spike | Stats mismatch/drift — diagnose live before speccing |

ᵃ Storage gauge and GC cadence only. The thumbnail/egress tier is deliberately deferred per
`docs/archive/specs/2026-06-24-cat-photo-storage-analysis.md` §6.

P1 goes first because P2 and P3 both add panels to the Admin screen. Repairing that surface
before extending it avoids doing the work twice.

## Problem

Nine defects were found in the Admin screen and the region subsystem. Four are destructive or
silent; the rest are correctness and UX gaps.

### Destructive

**G1 — An empty region deletes on one click, with no confirmation.**
`region-controls.tsx` `handleDeleteClick` calls `deleteRegion({ id })` *without* `force` as a
probe to discover whether the region is empty. But the server treats an unforced call on an
empty region as a legitimate delete: the region row and its sheet tab are gone before any
dialog is shown. Only *non-empty* regions reach the typed-confirm.

**G2 — The confirm path depends on matching an English error string.**
`res.serverError.includes("not empty")` couples the UI to prose in `regions.service.ts`.
Rewording that message silently disables the typed-confirm, leaving only G1's behaviour.

**G3 — New region tabs are cloned from a live region.**
`NON_REGION_TABS` in `lib/constants.ts` contains `"TEMPLATE"`, and `findTemplateSheetId`
selects the first tab *not* in that set — so it skips the curated `TEMPLATE` tab and duplicates
a real region (whichever sorts first), inheriting its formatting, conditional rules, and
protections.

**G4 — The orphan banner destroys the region title row.**
Region tabs use row 1 as a title, row 2 as headers, data from row 3. `warnOrphanTab` in
`Protection.gs` merges `A1:L1` and writes a red banner there. `createRegionSheetTab` clears only
`A3:Z`, so a banner written into row 1 survives permanently.

### Silent failure

**G5 — Failed user deletes show nothing.**
`handleConfirmDelete` sets `error`, but `error` is only passed to `AddUserDialog`
(`error={showAddUser ? error : null}`). `DeleteUserDialog` has no error prop and neither screen
body renders it.

**G6 — Role changes fail silently and leave the UI wrong.**
`handleRoleChange` updates local state optimistically, then discards the action result — no
`serverError` check, no rollback. A rejected change displays as applied until reload.

### Correctness / UX

**G7 — New region tabs keep the cloned region's title.**
`createRegionSheetTab` never writes row 1, so a new `LIBRARY` tab announces itself as `GATE 3`.

**G8 — Admin mobile nests a scroll container inside the layout's scroller.**
`admin-screen.tsx` is the only screen in the app using `min-h-screen`; every other mobile
branch is `flex flex-1 flex-col`. Combined with its own `overflow-auto` inside the dashboard
layout's `<main className="min-h-0 flex-1 overflow-y-auto">`, this produces the reported
broken mobile scrolling.

**G9 — Regions are not passed from the server.**
`RegionControls` takes no props and fetches via `useEffect` on mount, while users and sync
status are already server-seeded on the same page. Regions visibly populate after hydration.

**G10 — Region colour is write-once dead data.**
`regions.color` can be set when creating a region, but is never displayed in the list and can
never be changed afterwards. The column is written and then unreachable.

## Scope

**In:** G1–G10.

**Out:**

- **Auth de-duplication.** `(protected)/layout.tsx` and `admin/layout.tsx` each resolve user +
  profile independently. This is real redundancy, but it is *not* the cause of the reported
  mobile symptom — that is G8, which is mobile-specific, whereas the layout awaits affect both
  breakpoints equally. React `cache()` would also not help server actions, where
  `requireAuth()`/`requireRole()` performs the bulk of auth resolution. Re-resolving auth per
  boundary is the deliberate app-wide pattern; changing it means touching the highest-blast-
  radius file in the codebase to save roughly one roundtrip on three routes. Recorded as an
  observation, not a task.
- `STATIC_TABS` / `NON_REGION_TABS` duplication between Apps Script and TypeScript. Real, but a
  sync concern; belongs with P3's Apps Script work.
- Splitting the 479-line `admin-screen.tsx` into per-panel components. P2 and P3 both add panels
  here; restructure once, after they land, if it is still warranted.
- Region delete impact statistics (live session/cat counts in the confirm modal). Explicitly
  dropped — the typed-confirm alone is sufficient, and querying for it would reintroduce a
  server round-trip the redesign exists to remove.

## Design

### 1. Region deletion — confirm before calling the server

The root error is using a *mutation* to ask a *question*. The fix removes the question.

```
click trash
  → typed-confirm modal opens immediately   (no server call)
  → on confirm: deleteRegion({ id, force: true })
```

`handleDeleteClick` becomes synchronous — it only sets `confirmDelete` state. The existing
`DeleteRegionConfirm` component is reused unconditionally, for empty and populated regions
alike, carrying static worst-case copy rather than server-supplied prose:

> Deleting **NAME** permanently removes the region, all of its sessions, and any cats that
> exist only in this zone. This cannot be undone.

Server semantics in `regions.service.ts` are **unchanged**: empty deletes freely, non-empty
requires `force`, message untouched. The UI simply stops depending on that behaviour. The guard
remains as defence-in-depth against stale clients and other callers, and
`__tests__/services/regions-delete.test.ts` stays green without modification.

This resolves G1 and G2 together, and removes a server round-trip from the interaction.

### 2. Region tab creation — source, title, clearing

Three independent fixes in `helper.service.ts`:

- Add `TEMPLATE_TAB_NAME = "TEMPLATE"` to `lib/constants.ts`. `findTemplateSheetId` looks the tab
  up **by name** and throws a clear error if it is absent. Cloning a live region is never a
  correct fallback, so failing loudly is preferable to silently producing a wrong tab.
  `NON_REGION_TABS` keeps its current contents — it is accurate about what is not a region; it
  was simply the wrong list from which to choose a template.
- After duplicating, write `A1 = <region name>` so the new tab is titled correctly (G7).
- Continue clearing `A3:Z`, preserving rows 1–2 from the template.

### 3. Orphan banner — structural test, not a timing fix

Apps Script `onChange` timing is not deterministic relative to the app's API calls, so any
sleep or retry is a guess. Instead, narrow the orphan definition in `Protection.gs`.

Current test: *name not present in `_config!B2`*.
New test: *name not in B2* **and** *`A1:V2` is entirely empty*.

A tab cloned from `TEMPLATE` always carries header row 2, so it can never be flagged regardless
of trigger timing or B2 propagation. A tab created by hand with the `+` button is genuinely
blank and is still caught. The check becomes a fact about the tab rather than a race against
the app.

Additionally, `warnOrphanTab` stops calling `merge()` on `A1:L1`, so even a spurious fire cannot
consume a title row (G4).

Banner copy and the `_`-prefix opt-out are unchanged.

### 4. Regions passed from the server (G9)

`admin/page.tsx` adds `findRegions()` to its existing `loadData` fan-out and threads
`initialRegions` down through `AdminScreen` to `RegionControls`, which seeds state from props
and drops its mount effect, refetching only after a mutation.

`useRegions(initial)` additionally skips its fetch when seeded with a non-empty array — it
currently refetches on mount even when given data, so Overview and TNVR pay the same waterfall.

Fetch failures surface through the shared error banner from §6 rather than rendering as an
empty list.

### 5. Admin mobile layout (G8)

`admin-screen.tsx`'s mobile root becomes `flex flex-1 flex-col tablet:hidden`, matching every
other screen, and its inner `overflow-auto` is removed so the dashboard layout's `<main>` owns
scrolling. `admin/loading.tsx` receives the same structural change so the skeleton and the real
screen do not shift on swap.

### 6. Error surfacing and role-change rollback

A single inline error banner renders in both `AdminScreen` bodies, fed by user deletion, role
change, and region actions.

`handleRoleChange` checks `serverError` and reverts the optimistic update on failure:

```
snapshot previous role
  → apply optimistically
  → on serverError: restore snapshot + set error
```

This closes G5 and G6 with one shared surface rather than three separate ones.

### 7. Region colour — make the column live (G10)

`regions.color` is currently written once at creation and never read, displayed, or edited.

The inline rename affordance becomes an **Edit** action opening a modal with name + colour —
the same shape as the existing Add Region modal, one flow instead of two. The region list row
gains a colour swatch.

Server gains `updateRegion({ id, name?, color? })`, replacing `renameRegion`. Two traps this
must avoid:

- `renameRegion` early-returns when the name is unchanged, which would swallow a colour-only
  edit. The new action must branch on each field independently.
- Renaming a region renames its sheet tab. `renameRegionSheetTab` and the subsequent
  `provisionRegionSheets()` must run **only when the name actually changed**, so a colour tweak
  performs no Sheets writes at all.

`renameRegionSchema` is replaced by `updateRegionSchema` with both fields optional and at least
one required.

## Testing

Automated (Jest, existing mocked-seam style):

| Area | Assertion |
| ---- | --------- |
| `regions-delete.test.ts` | Unchanged, must stay green — server semantics are untouched |
| `updateRegion` | Colour-only change performs no sheet-tab rename and no provisioning pass |
| `updateRegion` | Name change renames the tab and re-provisions |
| `updateRegion` | Name clash rejected as `renameRegion` did |
| `createRegionSheetTab` | Sources the tab named `TEMPLATE`; throws when absent |
| `createRegionSheetTab` | Writes `A1` = new region name; clears `A3:Z` |

Manual (Apps Script has no test runner):

1. Create a region via Admin → confirm the new tab is titled correctly, carries template
   headers, has no red banner, and has empty data rows.
2. Create a blank tab by hand via `+` → confirm it *is* bannered and the toast fires.
3. Rename a hand-made tab to `_Notes` → confirm the warning stops.
4. Confirm no existing region tab acquires a banner during either flow.

UI changes are not unit-tested, consistent with the rest of the codebase.

## Risks

- **`TEMPLATE` drift.** Sourcing from a hand-maintained tab means new regions inherit whatever
  state it is in. Mitigated by failing loudly when it is missing, but its upkeep should be noted
  in P3's handoff guide.
- **Apps Script deploy is manual.** The `Protection.gs` change requires pasting into the
  spreadsheet's script editor; it does not ship with the app. The manual verification steps
  above are the only gate.
- **Existing damaged tabs.** Any region tab already carrying a banner or a wrong title from
  previous runs is not repaired by this work. If any exist, they need a one-off manual fix —
  worth checking during implementation.
