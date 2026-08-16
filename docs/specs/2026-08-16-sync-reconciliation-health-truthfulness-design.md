# P5 — Sync Reconciliation & Health-Field Truthfulness

**Date:** 2026-08-16
**Status:** Design approved, pending implementation plan
**Scope:** Root-cause fix for DB/sheet drift; correcting four health fields that misreport on the public catalog

## Context

Follows the four finalization phases. Originated as the "stats mismatch/drift" spike,
which was diagnosed live before speccing and turned up a second, larger problem on the
way.

| Phase | Contents |
| ----- | -------- |
| P1–P4 (done) | Admin/region repair; links & bug reports; killswitch & storage; rotation, vaccination, SEO |
| **P5** (this) | Sync reconciliation; health-field truthfulness |

Two independent strands. Strand A touches the sync engine; Strand B touches display
only. They share a phase because both came out of the same investigation.

## Problem

### 1. The app and the sheet disagree, silently

The sheet's `HOME` tab and the app's Overview compute the same census from different
sources and reach different answers:

| | Sheet `HOME` | App census | Δ |
| --- | --- | --- | --- |
| Active cats | **340** | **346** | **6** |
| Neutered | **231** | **232** | 1 |
| % TNVR | 67.94% | 67% | rounding only |

The gap is exact: six `Original`, active cats exist in the database and appear on **no
region tab**. `340 + 6 = 346`.

| Cat | Effective region | Pending tasks | Failed tasks |
| --- | --- | --- | --- |
| `b8edb736` | BEL | 0 | 0 |
| `9951e99c` | XAVIER | 0 | 0 |
| `e172dd76` | FAURA | 0 | 0 |
| `cbfd5ffe` | MORO | 0 | 0 |
| `953855ca` | MORO | 0 | 0 |
| `6af7adc8` | JSEC | 0 | 0 |

**Root cause: forward sync is task-driven and never reconciles.** A cat reaches the
sheet only when something queues a task, and `refreshCatInSyncQueue` runs solely when
the *app* creates or edits that cat. Nothing ever asks whether every `Original` cat has
a row. So when a row disappears sheet-side — deleted by hand, or lost in a restructure —
the database row survives (correctly; reverse sync deliberately never infers deletion
from absence), no task is queued because nothing changed in the app, and the cat is
absent indefinitely.

Two details make it worse:

- **The system can only notice drift while doing something else.** `syncAllPendingRegions`
  early-exits when there are no pending tasks and no sheet edits. A drifted cat generates
  neither, so every tick goes idle and nothing looks.
- **The repair already exists but is unreachable.** `syncAndCompactRegion`'s `idx === -1`
  branch appends a missing row with a fresh catalog number. A single app-side edit to any
  of those six would silently fix it. That is also why drift stays small and accumulates
  slowly.

Ruled out by live measurement, not assumption:

| Hypothesis | Result |
| --- | --- |
| Suffix drift (col A vs col L) | 0 — `find-suffix-drift` net overcount 0 |
| Rows invisible to sync (blank col Y) | 0 |
| Malformed or duplicated UUIDs | 0 |
| Stuck or failed queue tasks | 0 PENDING, 0 FAILED |
| Orphan sheet rows with no DB cat | 0 |
| Cats double-listed across regions | 0 |

The two failure modes the existing `scripts/find-*.ts` diagnostics were written for are
genuinely fixed. This is a third, distinct one.

### 2. A failed sheet read is indistinguishable from an empty tab

`readAllRegionSheetStates` swallows a per-region read failure and stores `[]`:

```ts
} catch (error) {
  console.error(`[ReadAllRegionSheetStates] region ${region.name} failed:`, …);
  result.set(region.id, []);
}
```

Harmless for today's callers, which simply do less work. It becomes dangerous the moment
anything treats "no rows" as "no cats on the sheet" — a transient API error would make an
entire region look empty. This must be fixed *before* reconciliation exists, not after.

### 3. `Fostered` is classified inconsistently in three places

| Site | Excludes |
| --- | --- |
| `lib/stats/census-stats.ts` | all four `cat_status` values |
| `findAdoptableCats` | all four |
| For RI summary query | `Adopted`, `Deceased`, `MIA` — **not `Fostered`** |
| `getInterventionDisplayStatus` | same three — **not `Fostered`** |

Five live cats are off-census in the app yet still appear on the "For RI" rescue
worklist volunteers work from. A cat in a foster home should not be on a rescue list.

### 4. The public catalog misreports neutering for 46% of the catalog

`catalog-detail-screen.tsx:65` derives neutering from `neuter_date`. It is the **only**
place in the codebase that does; stats, sheet mapping, forms, sessions, and reverse sync
all use `is_neutered`. The schema comment on `is_neutered` says exactly why the two
differ: *"Volunteers often tick neutered without recording a date, so the two facts must
be stored separately."*

| Public catalog — 63 adoptable cats | |
| --- | --- |
| Actually neutered (`is_neutered = true`) | **51** |
| Displayed as neutered (has `neuter_date`) | **22** |
| **Displayed "No" but genuinely neutered** | **29 (46%)** |
| `is_neutered = null` | **0** |

This is an outward-facing factual misstatement about an animal's medical status, and it
is the most consequential defect in this spec. That no adoptable cat has a null flag
makes the correction unambiguous.

### 5. `Sick` and `Injured` assert health from absent data

```ts
const isSick = !!healthRecord?.condition?.includes("Sick");
```

Two issues, one small and one structural.

`condition` is a single enum — `Healthy | Sick | Injured | Sick and Injured` — whose four
values exhaustively cover both booleans. `Healthy` is therefore a *positively recorded*
"not sick, not injured", not an inference from absence. Only `null` is genuinely unknown,
and that is **1 of 63** catalog cats (4 of 346 census cats). Real, but roughly one
twenty-ninth the magnitude of the neutering defect.

The structural issue is `.includes()`. Substring matching couples display logic to exact
enum spelling; a renamed value, or any future value containing the word, breaks it
silently with no type error.

### 6. Vaccination wording and inconsistent badge treatment

The catalog's `Vaccinated` row renders `unknown` and the other states as bare `<span>`s
while `Neutered`, `Sick`, and `Injured` use `YesNoBadge`. The row visually drops out of
its pill depending on its value. Separately, `Vaccinated` as a *value* under a
`Vaccinated` *label* reads awkwardly next to `Neutered: Yes`.

## Scope

**In:** automatic reconciliation of `Original` cats against region tabs; failure
reporting in the shared read pass; one shared `cat_status` exclusion set; correcting the
four health fields on the public catalog; one shared tri-state badge; a read-only
verification script.

**Out:**

- **Deleting cats from the database when a sheet row is missing.** Rejected on safety.
  Absence has too many innocent causes — the failed-read-becomes-`[]` path above, an
  accidental deletion, a botched sort, a filter-then-delete. Making census records
  destructible by a spreadsheet mishap risks the product itself, and reverse sync was
  deliberately built never to infer deletion from absence.
- **Fixing the effective-region divergence.** `regionSubquery` resolves to the *most
  recent* session's region; the For RI query uses `exists(any session in this region)`,
  so a cat in sessions across two regions would appear in both sections. Zero cats are
  affected today. Correcting it means replicating "most recent" inside a `where` clause
  in the highest-risk code in the app. Covered instead by a test that fails if a
  multi-region cat ever appears.
- **An admin-panel drift indicator.** Reconciliation needs one Sheets read per region
  (~30 regions at ~1.2s pacing); it cannot sit on a page load.
- **Rebuilding region tabs from the database each tick.** Would clobber sheet-side edits
  between ticks and contradicts the two-way design.
- **Migrating the nine local `formatDate` copies.** Carried over from P3 and P4.

## Design

### Strand A — reconciliation

#### A1. Report which region reads failed

`readAllRegionSheetStates` gains a second return value naming the regions whose read
threw. Additive: the existing `Map` keeps its current shape and semantics, so
photo-import and reverse-sync are untouched.

```ts
export async function readAllRegionSheetStates(
  regionList: { id: string; name: string }[],
): Promise<{ states: Map<string, SheetRow[]>; failed: Set<string> }>;
```

**If `failed` is non-empty, reconciliation skips the entire tick** — not merely the
failed regions. Presence is a global property (see A2), so a single failed read makes it
untrustworthy everywhere: a cat living on the failed region's tab looks absent from all
of them, and would be appended to a second tab. Skipping costs nothing — drift
accumulates over weeks and the next tick is twenty minutes away.

#### A2. Phase 0.5 — reconcile representation

A new phase in `syncAllPendingRegions`, placed **after** the shared read and **before**
the pending-task query, so a repair makes the tick non-idle and is pushed the same cycle:

```
Phase 0    read all region sheets (already happens on every tick, idle or not)
Phase 0.5  reconcile: enqueue UPDATE for every Original cat with no row   ← new
           query pending tasks                                            ← moved below 0.5
           idle early-exit
Phase 1    reverse sync
Phase 2    photo import
Phase 3    forward sync — the existing idx === -1 branch appends the row
Phase 4    summary regen
```

**No additional Sheets API calls.** Phase 0 already reads every region on every tick,
including idle ones — the information needed to detect drift was already in memory and
unused.

**Presence is evaluated globally, across every region's snapshot — never per region.**
A per-region check would reintroduce a bug this codebase already guards against: if a
region move ever occurred without going through `editCat`, the cat still sits on its old
tab, and checking only the new region would find nothing and append — producing the "cat
appears on two sheets" failure `CLAUDE.md` warns about. Global presence is also what makes
the whole-tick skip in A1 necessary rather than optional.

Global presence yields an invariant that removes a second, subtler hazard. Phase 0.5
necessarily runs *before* reverse sync, because reconciliation must beat the idle
early-exit while reverse sync sits after it — and reverse sync marks a cat's pending
forward tasks `COMPLETED` with *"Superseded by reverse sync"*
(`reverse-sync.service.ts:487-495`). A reconciliation task could therefore be silently
cancelled. It cannot happen here: **reconciliation only ever acts on cats absent from
every tab, and reverse sync only processes rows that exist, so the two sets are disjoint
by construction.**

Two repairs, both requiring that the cat has **no `PENDING` task**. A cat with one needs
no reconciliation regardless: Phase 3 will process that task, hit `idx === -1`, and append
the row as part of the same operation.

| Situation | Repair |
| --- | --- |
| Absent from every tab | `refreshCatInSyncQueue` — queues an `UPDATE`; Phase 3 appends. Purely additive. |
| Present on a tab that is not its effective region | Region move whose `DELETE` was missed. Supersede that cat's pending tasks for the old region, queue a `DELETE` to the old tab, then `refreshCatInSyncQueue` for the new — the exact sequence `editCat` already uses (`cats.service.ts:112-130`). |

Both reuse existing, proven code paths; neither introduces a new payload builder or write
path. The effective region must be resolved through the **same expression** the rest of
the app uses, or the wrong-tab repair could delete a correct row.

The two differ in reversibility, which is worth recording: the first is additive, while
the second deletes a row. Nothing irreplaceable is lost — cols A–V are DB projections and
are rewritten at the destination — but cols **W/X** (`last_edited_at`, `edited_by`,
written by Apps Script and never by the app) are sheet-only and do not survive the move.

Per region, once the whole-tick precondition in A1 has passed:

1. Expected = `Original` cats whose **effective region** is this region.
2. Present = col-Y UUIDs across **all** region snapshots.
3. Classify each expected cat as satisfied, absent-everywhere, or on-the-wrong-tab;
   discard any with a `PENDING` task.
4. Apply the safety guard (A3), counting both repair kinds. If it trips, skip the region
   and alert.
5. Otherwise apply the repairs above, and report both counts separately in the tick's
   alert.

Step 5 matters: reusing `refreshCatInSyncQueue` means **no new payload construction and
no new write path**. It already gates on `entry_status === "Original"`, resolves the
region, and builds the row exactly as every other queue entry does.

Expected-set computation adds one repo function,
`findOriginalCatIdsByEffectiveRegion()`, returning `{ cat_id, region_id }` pairs. It must
use the same COALESCE expression as `regionSubquery` — this becomes a fourth site
expressing the effective-region rule that `CLAUDE.md` already flags as needing to stay in
agreement, so it reuses the exported expression rather than restating it.

Reconciliation is gated by `getSyncHalt()` alongside every other write, and records its
outcome in `sync_audit_log`.

#### A3. Safety guard against a bogus-empty read

Two independent conditions, either of which skips the region without writing:

- The snapshot has **zero rows while the region expects more than zero cats**. That is the
  exact signature of a failed read, and A1 should already have caught it — this is the
  backstop for any other route to an empty snapshot.
- Missing count exceeds **the greater of 5 and 25% of the region's expected cats**. Region
  sizes vary widely (FAURA 42, XAVIER 3), so a flat threshold is wrong in both
  directions. Genuine drift is a slow trickle; anything larger is a systems problem, not
  a repair job.

A skipped region raises a Discord alert naming the region and the counts. Skipping is
always safe — the next tick tries again.

#### A4. Deliberate sheet-side row deletion

Restore the row and report it. Never delete from the database.

The key point is that **the sheet already has a sanctioned way to take a cat off the
census, and it is not row deletion.** Setting a status in **column L** (`Adopted`, `MIA`,
`Deceased`, `Fostered`) is read by reverse sync and moves the cat off the active census
while the row remains as a record. That is what someone deleting a row is almost always
trying to achieve, and it works today. The gap was never a missing capability — it was
that nobody documented it.

| Intent | Correct action |
| --- | --- |
| Take the cat off the active census | Set column L status — already supported |
| Remove the record entirely | Delete or merge **in the app** — the only path that removes data |
| (Row deleted anyway) | Restored next tick, included in the summary alert |

One alert per tick, not per cat, naming the cats and regions restored. That makes each
occurrence legible instead of mysterious. The decommissioning runbook and handoff guide
gain a plain line: *deleting a row does not delete a cat.*

#### A5. One shared off-census set

`Fostered` is added to the For RI query and to `getInterventionDisplayStatus` by
extracting the exclusion list into a single exported constant used by all four sites.
Fixing the value without fixing the duplication would leave the same trap armed.

#### A6. Read-only verification script

`scripts/reconcile-sheet.ts` reports drift in both directions and writes nothing. It is
**not** the fix — it is how the fix is verified, and what the handoff guide points at
when someone asks whether the two sources agree. It follows the existing
`find-skipped-rows` / `find-suffix-drift` pattern.

### Strand B — health-field truthfulness

#### B1. One display module

`lib/health-display.ts` holds how health facts become display states, so the four fields
stop each inventing their own rule:

```ts
export type TriState = "yes" | "no" | "unknown";
export function neuteredState(value: boolean | null | undefined): TriState;
export function conditionFlags(
  condition: string | null | undefined,
): { sick: TriState; injured: TriState };
export function triStateLabel(state: TriState): string; // "Yes" | "No" | "Unknown"
export function triStateToValue(label: string): boolean | null;
```

`neuteredToLabel` / `neuteredToValue` currently exist as **three separate copies** in
`database-medical-screen.tsx`, `cat-entry-form.tsx`, and
`sessions-approval-validation-screen.tsx`; the catalog would have been a fourth. They
migrate here — the same consolidation `formatDate` and `monthsSince` already received.

`conditionFlags` compares against the enum values explicitly instead of substring-matching
`.includes()`, and returns `unknown` for both flags when `condition` is null.

#### B2. Correct the catalog's four rows

| Row | Was | Becomes |
| --- | --- | --- |
| Neutered | `!!neuter_date` — Yes/No | `neuteredState(is_neutered)` — Yes / No / Unknown |
| Vaccinated | `Vaccinated` / `Expired` / `Unknown` | **`Yes`** / `Expired` / `Unknown` |
| Sick | `condition?.includes("Sick")` — Yes/No | `conditionFlags(...).sick` — Yes / No / Unknown |
| Injured | `condition?.includes("Injured")` — Yes/No | `conditionFlags(...).injured` — Yes / No / Unknown |

`VACCINATION_LABELS.vaccinated` changes from `"Vaccinated"` to `"Yes"`, which also
changes the database-list filter option. That is intended: as an answer to the row label
it reads correctly, and it lines up with Neutered's `Yes`.

#### B3. One tri-state badge

`components/app-pages/shared/health-badge.tsx` replaces the local `YesNoBadge`, so no
state ever drops out of its pill.

The badge takes a **label and a tone**, not a state type. This matters because the four
rows do not share one vocabulary: Neutered/Sick/Injured are `TriState`
(`yes | no | unknown`) while Vaccinated is `VaccinationState`
(`unknown | vaccinated | expired`). Forcing them into a single enum would mean inventing
a union that fits neither. The badge renders; the callers decide what a state means.

```ts
export type BadgeTone = "affirmative" | "muted" | "unknown";
export function HealthBadge(props: { label: string; tone: BadgeTone }): JSX.Element;
```

| Tone | Used by | Classes | Rationale |
| --- | --- | --- | --- |
| `affirmative` | `Yes` (all four rows) | `bg-brand-green/12 text-brand-green` | affirmative and backed by data |
| `muted` | `No`, `Expired` | `bg-brand-dark/8 text-brand-dark/50` | factual negative — **never red**, which would assert a clinical alarm the data cannot support |
| `unknown` | `Unknown` | `bg-brand-dark/5 text-brand-dark/40` | absence of data, visually distinct from a recorded "No" |

Each domain module owns its own state-to-tone mapping — `lib/health-display.ts` for
`TriState`, `lib/vaccination.ts` for `VaccinationState`. `Expired` sharing the muted tone
rather than gaining its own colour is deliberate and carries P4's constraint forward: the
word is permitted, alarm styling is not.

### Error handling

- A failed region read is now named, and reconciliation skips that region entirely.
- A tripped safety guard skips the region and alerts; the next tick retries.
- Reconciliation failure must not fail the tick — it runs in its own try/catch, like the
  photo GC, so a reconciliation problem cannot auto-freeze sync on the wrong subsystem.
- A null `condition` or `is_neutered` yields `unknown`, never a defaulted `no`.

## Testing

Automated (Jest, `testEnvironment: "node"`, mocked seams):

| Area | Assertion |
| --- | --- |
| `readAllRegionSheetStates` | A throwing region appears in `failed` and still maps to `[]` for existing callers |
| Reconciliation | An `Original` cat absent from its region's snapshot gets exactly one queued `UPDATE` |
| Reconciliation | A cat that already has a `PENDING` task is not queued twice |
| Reconciliation | A single failed region read skips the **whole tick** — no repairs anywhere |
| Reconciliation | A cat absent from every tab is repaired additively (`UPDATE` only, no `DELETE`) |
| Reconciliation | A cat present on a non-effective tab gets `DELETE` to the old tab **and** `UPDATE` to the new |
| Reconciliation | A reconciliation task is never cancelled by reverse sync — the disjointness invariant |
| Reconciliation | Zero rows with non-zero expected cats skips the region and does not enqueue |
| Reconciliation | Missing count above the cap skips and alerts rather than repairing |
| Reconciliation | A frozen or retired system enqueues nothing |
| Reconciliation | Repairs run before the pending-task query, so a repaired tick is not idle |
| Off-census set | The For RI query and `getInterventionDisplayStatus` exclude `Fostered` |
| Effective region | A cat in sessions across two regions is reported once, not twice — the guard for the deferred divergence |
| `neuteredState` | `true → yes`, `false → no`, `null → unknown` |
| `conditionFlags` | `Sick and Injured` sets both; `Healthy` sets neither; `null` yields `unknown` for both |
| `conditionFlags` | Matches enum values exactly — a value merely containing "Sick" as a substring does not set the flag |
| `triStateToValue` | Round-trips with `triStateLabel` for all three states |

UI is not unit-tested, matching the rest of the codebase. Verification is
`pnpm tsc --noEmit`, `pnpm lint`, and the manual checks below.

Manual:

1. Run `scripts/reconcile-sheet.ts` — confirm it reports the six known cats.
2. Run one cron tick; re-run the script — confirm zero drift and that the six rows now
   exist on their region tabs with fresh catalog numbers.
3. Compare the sheet's `HOME` total against the app's Overview — confirm they agree.
4. Delete a row by hand; run a tick — confirm it is restored and an alert names it.
5. Set a cat's column L status instead — confirm it leaves the active census with no
   restoration and no alert.
6. Freeze sync, delete a row, run a tick — confirm nothing is restored.
7. Open a cat that is neutered without a `neuter_date` in the public catalog — confirm it
   reads `Yes`.
8. Open the one cat with a null `condition` — confirm Sick and Injured both read
   `Unknown`, not `No`.
9. Confirm every health row keeps its badge in all states, including `Expired`.

## Risks

- **Reconciliation writes to the sheet automatically, including one destructive path.**
  It is the first mechanism that adds — and, in the wrong-tab case, removes — rows without
  a human or an app edit initiating it. The wrong-tab repair is the sharper edge: it
  deletes a row, and cols W/X (`last_edited_at`, `edited_by`) do not survive the move. The guards — failure reporting,
  the empty-snapshot check, the proportional cap, the halt gate, per-tick alerting — exist
  because the blast radius of getting it wrong is an entire region tab. This is the
  riskiest change in the spec and warrants the most review attention.
- **Restoring rows will surprise someone at least once.** A volunteer who deletes a row
  will see it come back. The alert and the runbook line are the mitigation; the column-L
  path is the answer they actually want.
- **The effective-region rule now has four expressions.** Adding a consumer to a rule
  `CLAUDE.md` already flags as fragile increases the chance of future divergence. Reusing
  the exported expression rather than restating it is what keeps that manageable.
- **Changing `VACCINATION_LABELS.vaccinated` changes a filter option** that a manager may
  already have muscle memory for. Small, and the consistency gain is worth it.
- **`Fostered` leaving the For RI sheet changes an operational worklist.** Five cats
  disappear from a list volunteers use. Correct, but it is a visible change to someone's
  workflow and should be mentioned rather than shipped silently.
