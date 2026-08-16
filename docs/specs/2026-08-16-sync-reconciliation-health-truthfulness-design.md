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

### 3. `Fostered` is classified inconsistently, and the two summary sheets disagree

A full audit of the sync path found **five** sites expressing "which cats count", of which
three omit `Fostered`:

| Site | Excludes | |
| --- | --- | --- |
| `lib/stats/census-stats.ts` | all four `cat_status` values | correct |
| `findAdoptableCats` | all four | correct |
| For **FA** summary query | `isNull(cat_status)` — stricter, excludes all | correct |
| For **RI** summary query (`helper.service.ts:656`) | `Adopted`, `Deceased`, `MIA` | **omits `Fostered`** |
| `getInterventionDisplayStatus` (`helper.service.ts:97`) | same three | **omits `Fostered`** |
| `forFaStatus` → col V (`helper.service.ts:140`) | same three | **omits `Fostered`** |

Two distinct consequences:

- Five live cats are off-census in the app yet still appear on the **For RI** rescue
  worklist volunteers work from. A cat in a foster home should not be on a rescue list.
- **All five fostered cats are `is_adoptable`**, so col V labels every one of them
  `Healthy & Adoptable` on the sheet while the app's public catalog excludes them. The
  same fact, answered two ways, in the two places a person is most likely to compare.

The two summary sheets also disagree with each other despite living in the same file: For
RI uses `notInArray(...)`, For FA uses `isNull(cat_status)`. For FA is the correct one.

### 4. Col K discards the sheet's own "unknown" option

Every classification column on a region tab is a `ONE_OF_LIST` dropdown, and **each
carries its own unknown sentinel — they are not uniform**:

| Column | Options | Unknown option | Parser result |
| --- | --- | --- | --- |
| F sex | `Female \| Male \| ???` | `???` | `null` — correct |
| G neutered | `YES \| NO \| ???` | `???` | `null` — correct |
| H sociability | `Domesticated \| Tame \| Feral \| ???` | `???` | `null` — correct |
| I sick, J injured | `YES \| NO \| ???` | `???` | `null` — correct |
| **K adoptable** | `YES \| NO \| ???` | `???` | **`false` — wrong** |
| L status | `Fostered \| Adopted \| MIA \| Deceased \| None of the above` | **"None of the above"** | `null` — correct |
| D color, E age | 12 / 4 values | **none exists** | all accepted — correct |

Only col K is broken. `parseSheetRow` reads it as a two-way flag:

```ts
const is_adoptable = String(row[10] ?? "").toUpperCase() === "YES";
```

So `NO` and `???` both collapse to `false`. The sheet offers "unknown" as a
first-class choice through the intended dropdown UI, and the parser records it as a
definite negative.

**This is active, not latent: 1 of 481 rows holds `???` in col K today.** A volunteer
selected it deliberately, and that cat is now excluded from the public catalog on the
strength of an answer that meant "I don't know".

A second, latent half: `strict` is unset on every rule, so blanks and hand-typed values
are permitted with only a warning. A blank col K yields `false` by the same line, and a
blank col I or J falls through `parseSheetRow`'s final `else` to `condition = "Healthy"` —
a positive medical claim from an empty cell. Both are 0 of 481 today. Note the contrast:
`???` in cols I/J is handled correctly; only a *blank* is mishandled there, whereas col K
mishandles both.

### 4b. Note: two dropdown options are app-written display values

Cols T and U list `Had TNVR intervention` and `Had Vet intervention`, which
`parseInterventionSignal` ignores — only `Will have …` and `Will not have intervention`
carry meaning inbound. This is **not a defect**: those two strings are what
`getInterventionDisplayStatus` *writes* when an intervention is `Finished`, so the
dropdown is enumerating the app's own output. Selecting one by hand is inert, which is
correct — completing an intervention belongs in the app. Recorded so the next reader does
not mistake it for the col-K bug.

One cosmetic wrinkle: col T's option is `"Will have TNVR intervention "` with a trailing
space while forward sync writes it without one. The parser trims, so behaviour is
unaffected, but every synced row in col T carries a data-validation warning flag. Fixing
it means editing the dropdown in the sheet, not the code.

### 5. A permanently failing task is abandoned silently

After `MAX_RETRIES` (3), `syncAndCompactRegion` marks the task `FAILED` — correctly, so it
stops lingering `PENDING`. But it then catches the error and returns `null`, so the cron's
own try/catch never fires and **no alert is sent**. The cat's row never reaches the sheet
and nobody is told.

Reconciliation (A2) would self-heal the missing row, since a `FAILED` task is not
`PENDING`. That fixes the symptom while leaving the cause invisible. Zero failed tasks
exist today.

### 6. The public catalog misreports neutering for 46% of the catalog

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

### 7. `Sick` and `Injured` assert health from absent data

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

### 8. Vaccination wording and inconsistent badge treatment

The catalog's `Vaccinated` row renders `unknown` and the other states as bare `<span>`s
while `Neutered`, `Sick`, and `Injured` use `YesNoBadge`. The row visually drops out of
its pill depending on its value. Separately, `Vaccinated` as a *value* under a
`Vaccinated` *label* reads awkwardly next to `Neutered: Yes`.

## Scope

**In:** automatic reconciliation of `Original` cats against region tabs; failure
reporting in the shared read pass; one shared `cat_status` exclusion set across all five
sites; blank-cell handling in `parseSheetRow`; an alert on retry exhaustion; correcting
the four health fields on the public catalog; one shared tri-state badge; a read-only
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
- **Preserving sheet rows that lack a col-Y UUID.** Forward sync currently *destroys*
  them: compaction filters them out of `finalData`, then `A3:V` is cleared and rewritten
  from `finalData` alone. `CLAUDE.md` describes such rows as "invisible to sync", which is
  true of reverse sync but understates what forward sync does. Not fixed, because the
  Apps Script trigger stamps a UUID on every new row whether created by the app or typed
  into the sheet, and the live audit found 0 of 481 rows unstamped. The residual risk is
  the handoff itself: installable triggers are **per-account**, so a newly inherited
  spreadsheet has none until they are re-installed, and a row typed in that window would
  be destroyed on the next forward sync of its region. This belongs in the handoff guide
  as a deploy-order warning, not in code.
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

#### A3. Wipe guard and per-tick repair budget

Two mechanisms, and only one of them is a refusal.

**A tab that came back empty while cats are expected is skipped and alerted.** Reads
succeeded — a failed read skips the whole tick — so the API genuinely returned nothing for
a tab believed to hold rows. That is the signature of a wipe or a botched script, not of
ordinary drift, and rewriting the tab underneath whoever is working on it is the wrong
move. The escape is deliberately cheap: restore or add any single row and the guard stops
tripping, after which the budget clears the rest automatically.

**Everything else is bounded by a per-tick repair budget rather than refused.**
`RECONCILE_MAX_REPAIRS_PER_TICK = 25`; whatever exceeds it is retried next tick. Wrong-tab
repairs count against the same budget precisely because they are the destructive path, so
a mis-plan can delete at most 25 rows in one tick.

The budget is derived, not chosen: observed drift over the app's lifetime is **6** cats,
the largest region holds **71**, and the census is **558**. Twenty-five is roughly four
times normal drift, so ordinary operation always clears in a single tick, yet well under a
single region, so no bug can rewrite a whole tab at once. Worst case, a full-census
mis-plan drains in under a day at one tick per 20 minutes.

**A proportional cap was considered and rejected.** An earlier draft skipped any region
whose repair count exceeded `max(5, 25% of expected)`. That is a guess dressed as a safety
property, and its failure mode is bad: delete 15 rows from a 40-cat tab and the cap is 10,
so reconciliation refuses every tick, forever, while the reads say plainly that those 15
cats are missing. It declines to work exactly when there is most work to do, and never
self-heals.

The distinction that keeps the wipe guard while dropping the cap is the **escape hatch**.
Both are hard skips, but the wipe guard is escaped by touching one row; the cap could only
be escaped by manually repairing more than it allowed — doing the tool's job by hand.

Convergence is unaffected either way: a repaired cat is present on the next snapshot and
never re-queued, and a cat with a `PENDING` task is skipped by `planRepairs`, so a stuck
batch neither consumes budget nor blocks others.

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

`Fostered` is added to all three omitting sites — the For RI query,
`getInterventionDisplayStatus`, and `forFaStatus` — by extracting the exclusion list into
a single exported constant that every site imports. Fixing the values without fixing the
duplication would leave the same trap armed; the audit found the third site precisely
because the list was written out three times.

For RI's `notInArray(...)` also aligns to For FA's stricter `isNull(cat_status)`, so the
two summary sheets stop disagreeing about the same concept in the same file.

#### A6. Col K reads all three dropdown options; blanks become `null`

`parseSheetRow` gains a three-way read of col K, matching col G's existing treatment:

```ts
const rawAdoptable = String(row[10] ?? "").trim().toUpperCase();
const is_adoptable =
  rawAdoptable === "YES" ? true : rawAdoptable === "NO" ? false : null;
```

`???` — an option the dropdown offers and a volunteer has already used — now records
"unknown" instead of a definite `false`. Blanks and hand-typed values land in the same
`null` branch.

`condition` likewise returns `null` unless **both** cols I and J hold a recognised token
(`YES`/`NO`/`???`), instead of falling through to `"Healthy"`. Partial knowledge ("sick,
injured unknown") is not expressible in a four-value enum, so `null` is the only honest
answer when either input is missing.

**The forward mapper must change with it, or the fix self-corrupts.** Both
`mapCatToSheetRow` and `mapUnknownCatToSheetRow` currently write col K as
`cat.is_adoptable ? "YES" : "NO"`, which flattens `null` to `"NO"`. Left alone the
round-trip destroys the value it just started preserving: a `???` selection becomes
`null`, the next forward sync writes `"NO"`, and the next reverse sync reads `false`. The
`null` would survive about twenty minutes.

Col K therefore adopts col G's three-way pattern verbatim, in **both** mappers:

```ts
cat.is_adoptable === true ? "YES" : cat.is_adoptable === false ? "NO" : "???"
```

This is not a new convention. `is_neutered` (col G) and `condition` (cols I/J) already
emit `"???"` for null and read it back; `is_adoptable` was the only one writing two-way,
which is exactly why it was safe until the column became nullable.

**The one already-affected row does not self-heal.** The cat currently holding `???` in
col K has `is_adoptable = false` in the database. Reverse sync only re-imports rows with a
col-W edit timestamp, so fixing the parser does not retroactively correct it — and forward
sync will not clobber the sheet's `???` either, because untasked rows keep their existing
col A–V values. The divergence simply persists until someone touches that row. One manual
correction closes it (see Testing).

Nothing else needs changing: no `null` ever reaches the Sheets API (every element of both
mappers is a string), col V is derived and write-only — reverse sync parses cols T and U
but never V — and `findAdoptableCats` already filters on `eq(is_adoptable, true)`, so a
`null` is correctly excluded. Future consumers must treat `null` as "not adoptable" rather
than assuming the column is effectively boolean.

#### A7. Alert when a task exhausts its retries

`syncAndCompactRegion` sends one Discord alert naming the region and the affected cats
whenever it marks tasks `FAILED`. Reconciliation will repair the missing rows, but a
repeatedly failing region indicates a real problem — a malformed payload, a permissions
change, a renamed tab — that self-healing would otherwise mask indefinitely.

#### A8. Read-only verification script

`scripts/reconcile-sheet.ts` reports drift in both directions and writes nothing. It also
lists rows whose col K holds `???` while the database records a concrete `is_adoptable`,
which is how the one known mis-recorded cat is found at deploy time. It is
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
| Reconciliation | A region whose tab is empty while cats are expected is skipped and alerted, not repaired |
| Reconciliation | Repairs beyond the per-tick budget are deferred, not dropped — the outcome reports the remainder |
| Reconciliation | Wrong-tab repairs count against the same budget as missing-row repairs |
| Reconciliation | A frozen or retired system enqueues nothing |
| Reconciliation | Repairs run before the pending-task query, so a repaired tick is not idle |
| Off-census set | All five sites share one constant; For RI, `getInterventionDisplayStatus`, and `forFaStatus` all exclude `Fostered` |
| Off-census set | A `Fostered` + `is_adoptable` cat is absent from For RI and does not read `Healthy & Adoptable` in col V |
| `parseSheetRow` | A blank col I or J yields `condition = null`, not `"Healthy"` |
| `parseSheetRow` | `???` in either column still yields `null`; well-formed YES/NO round-trips losslessly in all four combinations |
| `parseSheetRow` | Col K: `YES → true`, `NO → false`, **`??? → null`**, blank → `null` |
| `parseSheetRow` | Cols F/G/H keep mapping `???` to `null`, and col L keeps mapping `"None of the above"` to `null` — each column's own sentinel, unchanged |
| Sheet mappers | Col K emits `"???"` for a null `is_adoptable` in **both** `mapCatToSheetRow` and `mapUnknownCatToSheetRow` |
| Round-trip | `is_adoptable: null → "???" → null` survives a full forward-then-reverse cycle without becoming `false` |
| Retry exhaustion | Marking tasks `FAILED` sends exactly one alert naming the region |
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
10. Clear col I for one cat, run a tick — confirm its condition becomes unknown rather
    than `Healthy`, then restore the value.
11. Confirm the five fostered cats no longer appear on For RI and no longer read
    `Healthy & Adoptable` in col V.
12. Select `???` in col K for a test cat, then run **two** ticks — confirm col K still
    reads `???` and the database holds `null`, rather than collapsing to `NO`/`false`.
    One tick is not enough; the corruption this guards against appears on the second.
13. **One-time correction:** find the single existing row with `???` in col K (the
    verification script reports it) and set that cat's `is_adoptable` to `null`. Fixing
    the parser does not retroactively repair it — reverse sync only re-imports rows
    carrying a col-W edit timestamp.

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
  disappear from a list volunteers use, and the same five stop reading
  `Healthy & Adoptable` in col V. Correct, but a visible change to someone's workflow that
  should be announced rather than shipped silently.
- **One cat is already mis-recorded and needs a manual fix.** The row holding `???` in
  col K has `is_adoptable = false` in the database and will keep it until someone edits
  that row. It is one record, but it is a real cat wrongly excluded from the public
  catalog, so it should be corrected at deploy rather than left to chance.
- **`is_adoptable` can now be `null` where reverse sync previously always wrote a
  concrete value.** Filtering already uses `eq(is_adoptable, true)`, so behaviour is
  unchanged — but any future consumer must treat `null` as "not adoptable" rather than
  assuming the column is effectively boolean.
