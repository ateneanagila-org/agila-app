# QA Fixes Batch — Design

**Date:** 2026-06-01
**Scope:** One combined plan covering 17 QA issues from frontend review.

---

## 1. Stats miscount (Overview) — double-counted Overall Total

**Problem.** `computeStats` in [overview-screen.tsx](../../../components/app-pages/overview/overview-screen.tsx) sets `total` = count of all `entry_status === "Original"` cats, which **includes** Fostered/Adopted/MIA/Deceased cats. `offCensusTotal = fostered + adopted + mia + deceased` re-counts those same cats. `overallTotal = total + offCensusTotal` therefore double-counts them (500 active + 172 off-census surfaced as 672 "Untracked"/Overall).

**Decision.** `Total Count` = **active census only**.

**Fix.**
- Define `activeCats` = `entry_status === "Original"` AND `cat_status` ∉ {Fostered, Adopted, MIA, Deceased}.
- `total` = `activeCats.length`.
- Per-cat stat tallies (neutered, sociability, sick, injured, adoptable, unnamed) are computed over `activeCats` (the tracked on-campus population).
- `offCensusTotal` = fostered + adopted + mia + deceased (computed over all Original cats).
- `overallTotal` = `total + offCensusTotal` — now reconciles with no double count.
- Applies to both mobile and desktop stat blocks (they share `computeStats`).

**Files:** `components/app-pages/overview/overview-screen.tsx`

---

## 2. Cat card trash icon placement (Database list)

**Problem.** In [database-list-screen.tsx:199](../../../components/app-pages/database/database-list-screen.tsx#L199) the delete button is `absolute bottom-2 right-2` on the card wrapper, floating over the region/date text row at the bottom of the `default` cat card — visually colliding with content. (Hover class is correct; no logic bug.)

**Fix.** Reposition the delete FAB to the **top-left corner of the photo** (`absolute left-2 top-2`), away from the status chip (which sits `top-3 right-3` on the default variant). Keep hover-reveal behaviour and existing styling. Same change in both grid instances (mobile + the second list at ~L285).

**Files:** `components/app-pages/database/database-list-screen.tsx`

---

## 3. Homepage login / dashboard button

**Problem.** [public/layout.tsx:40](<../../../app/(public)/layout.tsx>) header top-right shows an orange "Apply" button (external link). Requirement: replace with a **green Login** button; if the user is already authenticated, show a **green Dashboard** button instead. Both with appropriate icons.

**Fix.**
- Make `PublicLayout` (or a small extracted server component) check the session via the server Supabase client.
- Logged out → `<Link href="/login">` "Login" button, `bg-brand-green`, with a login/sign-in icon.
- Logged in → `<Link href="/dashboard/overview">` "Dashboard" button, `bg-brand-green`, with a dashboard/grid icon.
- Add the two icons to `components/app-pages/shared/icons.tsx` if not present (e.g. `LogInIcon`, `LayoutDashboardIcon`).
- The "Apply to adopt/foster" CTA still lives inside the catalog hero, so removing it from the header loses nothing.

**Files:** `app/(public)/layout.tsx`, `components/app-pages/shared/icons.tsx`

---

## 4. Public catalog filters — remove staff-only filters

**Problem.** Public catalog reuses `DATABASE_LIST_CONFIG`, exposing Intervention Type/Status, Medical Condition, and Status filters to the public.

**Decision.** Public catalog keeps: **Region, Color, Age, Sex, Sociability**. Removes: Intervention Type, Intervention Status, Medical Condition, Status.

**Fix.**
- Add `PUBLIC_CATALOG_CONFIG` to [filter-sort-configs.ts](../../../lib/hooks/filter-sort-configs.ts) with only the 5 allowed filters; keep sort options (Name, Age, Sex, Color, Last Updated).
- Point `CatalogScreen` at `PUBLIC_CATALOG_CONFIG` instead of `DATABASE_LIST_CONFIG`.

**Files:** `lib/hooks/filter-sort-configs.ts`, `components/app-pages/catalog/catalog-screen.tsx`

---

## 5. AGILA Catalog logo → shared component, always redirects to catalog

**Problem.** Public header logo already links to `/`. But the dashboard logo lockups ([dashboard/layout.tsx:173](<../../../app/(protected)/dashboard/layout.tsx#L173>) mobile header, :233 sidebar) and the login-page logo are plain `<div>`s — not clickable. The paw icon + "AGILA / CATALOG" lockup is also duplicated across four files (public layout, dashboard layout ×2, login page).

**Decision.** Extract a single shared component instead of editing every instance.

**Fix.**
- Create `components/app-pages/shared/brand-logo.tsx` exporting `<BrandLogo>`: the paw icon + "AGILA / CATALOG" lockup, wrapped in `<Link href="/">`.
  - Consolidate the duplicated `PawIcon` into this component (or a shared icon).
  - Props for size/variant differences (e.g. boxed sidebar version vs inline header version) so all current visual variants are covered.
  - Allow the link to be optional/overridable if any placement needs it (default `/`).
- Replace all four instances: public header, dashboard mobile header, dashboard sidebar, login-page brand panel.

**Files:** new `components/app-pages/shared/brand-logo.tsx`; `app/(public)/layout.tsx`, `app/(protected)/dashboard/layout.tsx`, `app/(auth)/login/page.tsx`.

---

## 6. Remove the @ateneo email restriction

**Problem.** [auth/callback/route.ts:26-40](../../../app/auth/callback/route.ts) gates on `@ateneo.edu` / `@student.ateneo.edu` **before** the manual allowlist (`findAllowedEmails`). The allowlist already gates everyone, so the domain check is redundant for security and blocks external collaborators (PAWS staff, vets) who must be added manually.

**Decision.** Remove the domain gate; rely on the allowlist alone. Delete the dead route.

**Fix (4 touches).**
1. [auth/callback/route.ts](../../../app/auth/callback/route.ts) — delete the `isAteneo` block (L26–40). Non-allowlisted users now land on `/login/not-onboarded`.
2. [users/user-dialogs.tsx:187-190](../../../components/app-pages/users/user-dialogs.tsx#L187) — relabel "Ateneo Email Address" → "Email Address", placeholder to a generic email. Confirm no validation hard-rejects non-ateneo addresses; relax if present.
3. Delete `app/(auth)/login/non-ateneo-email-used/page.tsx` (now unreachable).
4. [login/page.tsx:81](<../../../app/(auth)/login/page.tsx#L81>) — copy "Use your Ateneo Google account…" → "Use your Google account…". Brand strips ("Ateneo de Manila") stay.

**Files:** `app/auth/callback/route.ts`, `components/app-pages/users/user-dialogs.tsx`, `app/(auth)/login/non-ateneo-email-used/page.tsx` (delete), `app/(auth)/login/page.tsx`. Possibly `components/app-pages/shared/user-details-dialog.tsx` label.

---

## 7. Service-account bypasses sheet protections (audit)

**Problem.** Per project memory, freeze/unfreeze and `syncSheetEditors` protections are deprecated and calls should be removed. Need to confirm no remaining protection logic blocks the service-account's reverse-sync writes.

**Task.** This is an **investigation**, not a predetermined edit:
- Audit `lib/services/reverse-sync.service.ts`, `lib/services/helper.service.ts`, and the Apps Script (`workers/apps-script/Protection.gs`, `WebApp.gs`, `Code.gs`) for any remaining protection / editor-restriction calls in the write path.
- Confirm the service account is an editor (or protections are fully removed) so writes don't silently fail.
- Cross-check against memory note `project_gsheets_sync_deprecated`.
- Output: a short findings note + removal of any dead protection calls found. No behavioural change beyond removing deprecated guards.

**Files:** TBD by audit (sync services + apps-script).

---

## 8. Remove "Secured access" label, keep separator

**Problem.** [login/page.tsx](<../../../app/(auth)/login/page.tsx>) renders a centered "Secured access" caption between two `h-px` divider lines.

**Fix.** Remove the caption `<span>`; keep a single full-width `h-px` divider (merge the two half-lines into one) for visual separation.

**Files:** `app/(auth)/login/page.tsx`

---

## 9. UI must reflect `is_neutered` flag (not `neuter_date`) — investigative

**Problem.** Schema has an authoritative `is_neutered` boolean ([schema.ts:167](../../../lib/db/schema.ts#L167); `null` = unknown) plus a separate `neuter_date`. Overview stats count neutered via `hr?.neuter_date`, so a cat marked neutered without a date is undercounted. This is likely one of several UI surfaces that drifted from the backend flag model.

**Task (investigative, not a single edit).**
- Sweep all UI surfaces (overview, tnvr, medical, catalog detail, cat entry/edit forms, cat card, any filters/sort) for places that infer neuter status from `neuter_date`, or otherwise diverge from the backend's flag-based model.
- The confirmed instance: change the neutered tally in `computeStats` to `hr?.is_neutered === true`.
- For each surface found: drive *status* off `is_neutered` (true / false / null=unknown), while still displaying `neuter_date` as the date when present.
- Watch for related drift (e.g. `is_adoptable` flag vs derived status, `cat_status` handling) and note any other backend/UI inconsistencies surfaced during the sweep.
- Output: list of inconsistencies found + fixes applied.

**Files:** `components/app-pages/overview/overview-screen.tsx` (confirmed), plus medical / tnvr / catalog-detail / entry-form / cat-card as found.

---

## 10. Status badges — distinct, readable semantic colors

**Problem.** `statusAccent` in [cat-card.tsx:55](../../../components/app-pages/shared/cat-card.tsx#L55): Deceased/MIA use washed-out `bg-brand-dark/10 text-brand-dark/70`; Adopted, Fostered, and Adoptable all share orange and are indistinguishable.

**Decision.** Distinct semantic colors per status, solid-ish fills, higher contrast.

**Proposed mapping (one color per status):**

| Status     | Intent        | Rail            | Chip                                   |
| ---------- | ------------- | --------------- | -------------------------------------- |
| Adoptable  | green         | brand-green     | green fill, white/dark text            |
| Fostered   | orange        | brand-orange    | orange fill                            |
| Adopted    | blue/teal     | status-adopted  | teal fill                              |
| MIA        | amber/warning | status-mia      | amber fill                             |
| Deceased   | dark solid    | brand-dark      | solid dark fill, light text (readable) |

**Token discipline.** CLAUDE.md forbids hardcoded hex. Adopted (teal) and MIA (amber) need colors outside the current brand palette, so we add two semantic status tokens (e.g. `--status-adopted`, `--status-mia`) to the theme/globals and expose `bg-status-adopted` / `bg-status-mia` Tailwind classes, rather than hardcoding. Adoptable/Fostered/Deceased reuse existing brand tokens.

**Fix.** Rewrite `statusAccent` to return distinct, contrast-checked chip classes (solid fill, ~AA contrast) and matching rail per status; add the two new tokens.

**Files:** `components/app-pages/shared/cat-card.tsx`, theme/globals (Tailwind token definitions).

---

## 11. Mobile database view — remove inline Add Entry button, add title

**Problem.** The mobile database view ([database-list-screen.tsx:159-225](../../../components/app-pages/database/database-list-screen.tsx#L159)) has **no title** and opens with a full-width "Add Entry" button (L162-168), plus a floating orange FAB (L213-224). Desktop has a "Database" title + add button; mobile is inconsistent.

**Decision.** Remove the inline full-width "Add Entry" button only. **Keep the floating FAB.** Add a "Database" title (with "N cats on record" subtitle, matching desktop) to the mobile view.

**Fix.**
- Delete the inline `Add Entry` button block (L162-169) in the `tablet:hidden` section.
- Add a mobile header above the filter toolbar: `Database` title + `{cats.length} cats on record` subtitle, styled to match the mobile theme.
- Leave the floating FAB (L213-224) untouched.

**Files:** `components/app-pages/database/database-list-screen.tsx`

---

## 12. Sessions table — status column + row misalignment

**Problem.** Sessions tables (mobile dashboard, mobile all-sessions, desktop dashboard, desktop all-sessions in [sessions-screen.tsx](../../../components/app-pages/sessions/sessions-screen.tsx)) render each row as its **own** grid with `auto`-sized tracks (e.g. `grid-cols-[1fr_1fr_1fr_auto_auto_2rem]`, mobile `[auto_auto_1fr_auto_auto]`). Because `auto` columns size to each row's own content and the Continue/delete cells are empty `<span />` for non-Unfinished rows, columns **don't line up across rows** — long content shifts neighbouring columns. Desktop also shows a redundant Status badge **and** a separate Continue column.

**Decision.** Status column = **Continue button when Unfinished, else the Submitted/Reviewed badge**. Remove the separate Continue column.

**Fix.**
- Collapse the status + continue columns into one: render the Continue link for `Unfinished`, the status badge for `Submitted`/`Reviewed`.
- Give the table fixed/consistent column tracks (replace per-row `auto` with shared fixed widths, or move the column template to the container so header + rows share one grid) so every cell occupies its track even when empty → columns align across rows.
- Apply consistently to all four table instances (mobile + desktop, dashboard + all-sessions). Keep the delete (trash) action as its own fixed-width column.

**Files:** `components/app-pages/sessions/sessions-screen.tsx`

---

## 13. All stats elements reflect the stats considerations (incl. TNVR)

**Problem.** The fixes in #1 (active census) and #9 (`is_neutered`) must propagate to **every** derived stat — counts, charts, and percentages — not just the Overview number cards. The TNVR tab ([tnvr-screen.tsx](../../../components/app-pages/tnvr/tnvr-screen.tsx)) independently computes `isNeutered = !!hr?.neuter_date` and `total = originalCats.length`, so its TNVR %, pie chart, and sex breakdowns are subject to the same two bugs.

**Fix.**
- TNVR: switch `isNeutered` to `hr?.is_neutered === true`; align `total`/denominators with the active-census definition from #1 so percentages and the pie chart are consistent with Overview.
- Audit Overview charts (`HorizontalBarChart`/`VerticalBarChart` population data) and any percentage so they use the same population basis.
- Ensure Overview and TNVR agree on totals/neutered counts for the same location filter.

**Files:** `components/app-pages/tnvr/tnvr-screen.tsx`, `components/app-pages/overview/overview-screen.tsx`, shared chart inputs. (Overlaps #1 and #9 — implement together.)

---

## 14. Stats view responsiveness at `lg` + sociability stat misalignment

**Problem.** Overview desktop ([overview-screen.tsx](../../../components/app-pages/overview/overview-screen.tsx)) uses fixed large type (`text-4xl`) and rigid grids (`grid-cols-4` primary, `grid-cols-6` status strip). At `lg` the columns get too narrow → overflow / cramping. The status-strip cells (`flex items-center justify-between … py-2.5`) let the label wrap when narrow, which pushes the number's baseline up and makes Tame/Feral/Sick/etc. look "upshifted" and misaligned across the row.

**Fix.**
- Responsive type: step down number sizes at `lg` (e.g. `text-2xl lg:text-3xl xl:text-4xl`).
- Responsive grids: fewer columns at `lg` (e.g. status strip `grid-cols-3 lg:grid-cols-3 xl:grid-cols-6`), so cells stay wide enough.
- Stop labels wrapping / fix vertical alignment in stat cells (prevent wrap with smaller text or `whitespace-nowrap` + consistent cell height) so numbers align.

**Files:** `components/app-pages/overview/overview-screen.tsx`

---

## 15. Database view responsiveness — cat card content omitted

**Problem.** The `default` cat card ([cat-card.tsx](../../../components/app-pages/shared/cat-card.tsx)) relies heavily on `truncate`; in the database grid at intermediate widths the card columns get narrow enough that name/color/region/date truncate to nothing — content effectively disappears.

**Fix.**
- Audit the database grid breakpoints ([database-list-screen.tsx](../../../components/app-pages/database/database-list-screen.tsx)) and the `default` card: set sensible min card widths / responsive column counts so cards never get too narrow.
- Reduce reliance on hard truncation where it hides essential info (allow wrap for name, keep single-line truncation only where a tooltip/full value is available elsewhere).
- Verify across `tablet`/`laptop`/`lg` widths.

**Files:** `components/app-pages/database/database-list-screen.tsx`, `components/app-pages/shared/cat-card.tsx`

---

## 16. Mobile user tab — remove inline Add Entry, keep FAB

**Problem.** Mobile users view ([users-screen.tsx](../../../components/app-pages/users/users-screen.tsx)) has a full-width inline "Add Entry" button **and** a floating FAB — duplicate affordance (same pattern as #11). Note: the mobile delete button also uses a raw 🗑️ emoji.

**Decision.** Remove the inline "Add Entry" button; keep the FAB.

**Fix.**
- Delete the inline `Add Entry` button block in the `tablet:hidden` section; leave the FAB.
- While here, replace the 🗑️ emoji delete button with the `TrashIcon` for consistency with the rest of the app.

**Files:** `components/app-pages/users/users-screen.tsx`

---

## 17. User details modal — full visual redesign

**Problem.** [user-details-dialog.tsx](../../../components/app-pages/shared/user-details-dialog.tsx) uses oversized arbitrary-rem typography (`text-[2rem]`, `text-[22px]`), a heavy `border-[4px] border-brand-pink` field style, and a sharp (un-rounded) square close button — inconsistent with the rest of the app's clean rounded brand system. It also has a **wrong** `BUG_REPORT_URL` (`https://github.com/anthropics/claude-code/issues` — a leftover placeholder) and a "Ateneo Student Email Address" label.

**Decision.** Full visual redesign.

**Fix.**
- Restyle to match the app's design system: sane type scale (heading/body tokens, not arbitrary rem), brand tokens, rounded close button consistent with other dialogs, lighter field styling.
- Fix the bug-report link to the real project repo issues (`https://github.com/legnspice/agila-app/issues`).
- Relabel "Ateneo Student Email Address" → "Email Address" (consistent with #6).
- Keep the same data (Name, Email, Role) and the Report-a-Bug action; just redesign presentation.

**Files:** `components/app-pages/shared/user-details-dialog.tsx`

---

## Out of scope / notes

- #7, #9, #13, #14, #15 carry an investigative/audit element; they may surface follow-up work but ship as part of this batch (findings + fixes).
- #1, #9, #13 are tightly coupled (stats basis + neuter flag across Overview, TNVR, charts) — implement together to keep totals consistent.
- #11, #16 share a pattern (remove inline Add Entry, keep FAB); #5 also touches the same dashboard/users mobile chrome.
- No mobile layout refactors beyond the targeted fixes above (per CLAUDE.md two-screen rule). Per CLAUDE.md, avoid setState patterns that trigger cascading-render lint errors.
- Verify types with `pnpm tsc --noEmit` / `pnpm build` after implementation.
