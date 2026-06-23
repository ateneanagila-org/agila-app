# QA Fixes — Batch 3

Four QA issues: interventions CRUD gaps, desktop Priority Locations design
drift, merge-notes friction, and the overview chart async reorder. Root causes
verified in code before writing.

## Decisions
- **Interventions notes:** editable via a dual-mode dialog (create + edit), not
  inline. Status stays inline (already works). Render notes with preserved
  whitespace.
- **Merge notes:** drop the free-text textarea; notes become a **new/current
  toggle** like the other fields (multi-line card style, not a single-line pill).
  Manager can still edit notes later on the validation/detail screen.
- **Overview chart order:** SSR-seed regions **and** sort the chart output
  deterministically, so bar order never depends on async region load.

---

## 1. Interventions — delete + notes edit + formatting
`components/app-pages/database/database-interventions-screen.tsx`,
`components/app-pages/database/database-dialogs.tsx`

Backend is ready: `removeIntervention` (`app/actions/interventions.ts:39`),
`editIntervention` (accepts `type` + `notes` via `editInterventionSchema`), and
`refresh()` from `useCatDetail` re-fetches after any mutation.

**1a. Notes formatting.** The notes `<p>` (`:292-296`) lacks whitespace
preservation. Add `whitespace-pre-wrap break-words` so newlines/long notes
render correctly.

**1b. Delete.** Each row (`:274-309`) has only a status select. Add a
manager-gated delete button (trash icon, mirrors the session-row delete style)
that opens a confirm dialog.
- Add `DeleteInterventionDialog` to `database-dialogs.tsx`, modeled on
  `RemoveCatDialog`/`DeleteSessionDialog` in `session-dialogs.tsx` ("permanently
  removed … cannot be undone").
- Wire `removeIntervention` in the screen: `pendingDeleteId` state, `handleDelete`
  → action → `refresh()`. Gate the button behind `canManage`.

**1c. Notes edit.** `NewInterventionDialog` is create-only. Generalize it to
dual-mode (or add a sibling `EditInterventionDialog` reusing the same body):
- Accept `mode: "create" | "edit"` + optional initial `type`/`notes` + `id`.
- Title "New Intervention" / "Edit Intervention"; submit label "Apply" / "Save".
- Add a manager-gated "Edit" affordance per row (the type/notes block becomes the
  entry point) that opens the dialog prefilled.
- `handleEdit` → `editIntervention({ id, type, notes })` → `refresh()`.

RBAC: edit + delete buttons gated on `canManage` (volunteers already read-only on
DB detail; status select already `pointer-events-none` for them at `:299`).

## 2. Priority Locations — desktop design parity
`components/app-pages/sessions/sessions-screen.tsx` (desktop block, `:797-846`)

Diverges from the sibling Recent Sessions card on the same screen:
- **Title:** Recent Sessions h2 sits *inside* a `border-b px-5 py-3` header bar
  (`:703-714`); Priority Locations h2 + subtitle sit *outside* the card
  (`:797-802`).
- **Column-header tint:** Priority's header row uses `bg-brand-cream` (`:805`);
  Recent Sessions' header row is untinted (`:716`).

**Fix (desktop only — mobile already matches):**
- Move the "Priority Locations" h2 into an in-card header bar matching Recent
  Sessions (`border-b border-border px-5 py-3`, `font-heading text-lg ...`).
  Keep the "Regions ranked by days since last census" subtitle inside that bar
  (small muted text) or drop it for parity — prefer keeping it as a one-line
  subtitle under the h2.
- Remove `bg-brand-cream` from the column-header row so it matches the untinted
  `uppercase tracking-widest` header style.
- Leave the 2-col grid body + "More"/"Show less" toggle as-is.

## 3. Merge notes — toggle instead of textarea
`components/app-pages/sessions/sessions-approval-crossref-screen.tsx`,
`components/app-pages/sessions/session-dialogs.tsx`

Today notes is `inputType: "textarea"` and force-included in the diff regardless
of equality (`crossref:110-115`, `:133-134`), forcing the manager to manually
copy/retype.

**Fix:**
- In `buildMergeDiff`, change the Notes candidate to a choice field and let it
  flow through the normal `currentValue !== newValue` diff filter (equal notes →
  auto-merged/hidden, like every other field). Remove the special
  `...candidates.filter(f => inputType === "textarea")` append.
- In `MergeDetailsDialogContent`, replace the `textarea` branch + `textValues`
  state with a **two-option card toggle** (new vs current) that shows the full
  note text — reuse the new/current selection mechanics already used for pills,
  but a stacked multi-line card rather than a single-line `rounded-full` pill
  (long notes wrap badly in a pill).
- `handleMerge` already maps the resolved value → `updatePayload.notes`
  (`crossref:306-307`); a new/current choice resolves to the chosen string. No
  service change.
- Decide whether to keep the `"textarea"` member of `MergeFieldDef.inputType`
  for the type union — drop it if no other consumer remains (grep confirms notes
  is the only one).

## 4. Overview chart async reorder
`components/app-pages/overview/overview-screen.tsx`,
`app/(protected)/dashboard/overview/page.tsx`

`populationByLocation` (`:74-87`) seeds its Map from `regionNames`, which comes
from the async `useRegions()` hook — empty on first paint, resolves ~1s later.
First render orders bars by cat insertion order; after regions load it re-seeds
in alphabetical `regionNames` order (`:35`), causing the visible reorder. Zero-
count regions also pop in late.

**Fix (both, complementary):**
- **SSR-seed regions.** Add `initialRegions` prop to `OverviewScreen`; in
  `page.tsx`, fetch via `loadData("Overview regions", () => findRegions(), [])`
  alongside cats/health and pass it down. Seed `useRegions(initialRegions)` (or
  use the prop directly for `regionNames`) so the first paint already has the
  full, sorted region set → no reorder, no pop-in.
- **Deterministic chart order.** Sort the final `populationByLocation` array
  explicitly (alphabetical by label, or by value desc) so order is stable even
  if regions were ever async again. Belt-and-suspenders against regressions.

`useRegions` keeps working as a fallback for any caller that doesn't pass a seed.

---

## Files touched
- `components/app-pages/database/database-interventions-screen.tsx` — delete +
  edit wiring, notes `whitespace-pre-wrap`
- `components/app-pages/database/database-dialogs.tsx` — `DeleteInterventionDialog`;
  dual-mode intervention dialog
- `components/app-pages/sessions/sessions-screen.tsx` — desktop Priority Locations
  card parity
- `components/app-pages/sessions/sessions-approval-crossref-screen.tsx` — notes
  → choice field in `buildMergeDiff`
- `components/app-pages/sessions/session-dialogs.tsx` — notes new/current card
  toggle; remove `textValues`/textarea path
- `components/app-pages/overview/overview-screen.tsx` — `initialRegions` prop,
  deterministic chart sort
- `app/(protected)/dashboard/overview/page.tsx` — fetch + pass regions
- `lib/hooks/use-regions.ts` — accept optional seed (if seeding via hook)

## Verification
- `pnpm tsc --noEmit` clean (no setState-in-render patterns).
- Interventions: create / edit type+notes / delete each refresh the list;
  volunteer sees read-only (no edit/delete buttons).
- Multi-line notes render with line breaks on the interventions list.
- Desktop Priority Locations visually matches Recent Sessions card; mobile
  unchanged.
- Merge dialog: differing notes show a new/current toggle, equal notes auto-merge;
  chosen note persists to the target via `editCat`.
- Overview: bars render in final order on first paint (no ~1s reorder); zero-count
  regions present immediately.
