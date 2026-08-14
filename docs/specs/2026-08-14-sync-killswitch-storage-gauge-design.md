# P3 — Sync Killswitch & Storage Gauge

**Date:** 2026-08-14
**Status:** Design approved, pending implementation plan
**Scope:** Finalization items 6 (sync killswitch) and 10a (storage gauge + GC cadence)

## Context

Third of the finalization sub-projects. P1 repaired the Admin screen and region subsystem;
P2 made referral links admin-editable and replaced the broken bug-report link.

| Phase | Contents |
| ----- | -------- |
| P1 (done) | Fix Admin screen; repair region adding/deleting |
| P2 (done) | Admin-editable referral links; in-app bug reports |
| **P3** (this) | Sync killswitch; storage gauge + automated GC |
| P4 | Photo rotation, vaccination expiry warning, basic SEO |
| Handoff guide | Split out of P3 — see below |
| Spike | Stats mismatch/drift — diagnose live before speccing |

**The handoff/decoupling guide (item 11) was deliberately removed from this phase.** It is pure
documentation whose accuracy depends on facts not present in the repo — who owns each account,
which are personal versus organisational, what is on a paid plan. Nothing verifies it, so a
subagent pipeline would produce a confident document full of guesses. It becomes its own
project, written from a direct interview, **after** the code is final so it documents a
finished system rather than a moving one.

## Problem

### The app has no way to be retired

A freeze exists, but it is not a killswitch. `isSyncFrozen()` is checked inside reverse sync
(`reverse-sync.service.ts`) and forward sync (`helper.service.ts`), and
`app/api/cron/sync/route.ts` sets it **automatically** when a tick throws, telling the admin to
unfreeze after resolving. It is a safety pause: temporary, error-triggered, designed to be
undone by a button labelled **Unfreeze**.

Retirement is the opposite in every respect — deliberate, permanent, and afterwards the sheets
are no longer the app's to write. Three concrete gaps:

1. **No permanent stop.** Reusing `sync_frozen` means one click on Unfreeze — a button built
   for the routine "a tick failed, fix it and resume" case — resurrects sync onto sheets the
   org may have hand-edited for months.
2. **A frozen tick is not a cheap tick.** `/api/cron/sync` never checks the freeze flag. It
   authenticates, opens an `after()` block, and calls `syncAllPendingRegions()`, which loads
   regions from the database. The freeze gates sit deeper. So a frozen system still costs one
   Cloudflare invocation, two Vercel invocations (`/api/health` then `/api/cron/sync`) and
   several queries every 20 minutes, indefinitely.
3. **Retiring would strand the spreadsheet.** The app owns protections on columns A and W–Y of
   every region sheet (`setupSystemColProtections`). They exist to stop humans editing
   system-managed columns. After retirement nothing manages those columns, so leaving the
   protections in place hands stewards a spreadsheet with four locked columns and no app to
   unlock them.

### Photo storage has no visibility and no maintenance

`docs/archive/specs/2026-06-24-cat-photo-storage-analysis.md` measured 116 MB of the 1024 MB
free tier and an 8–25 year runway, then recommended two cheap moves that were never built:

- **A storage gauge in Admin.** Stewards cannot run SQL. If usage is operationally necessary to
  see, it has to be self-serve.
- **Running the orphan GC on a cadence.** `reconcileCatPhotos` is already built and
  reference-aware, but only runs when a human clicks it. The analysis calls orphan neglect
  "the silent creeper" — merges reassign photo paths and region/bulk deletes leave blobs
  behind, and nothing reclaims them unless someone remembers.

A documented habit that depends on a non-technical steward remembering a manual sweep for a
decade is a habit that will not happen.

## Scope

**In:** the killswitch (flag, gates, protection release, admin UI), the storage gauge, and
automated weekly GC.

**Out:**

- **The handoff/decoupling guide.** Split into its own project — see Context.
- **The thumbnail tier.** The storage analysis §6 ranks it third and explicitly defers it until
  egress bites. Egress remains the likelier near-term ceiling; this project does not address it.
- **Batch-recompressing existing photos** or changing upload quality. The analysis recommends
  settling compression deliberately, but 116/1024 MB gives no urgency, and re-compressing 495
  blobs is its own project.
- **Pruning photos of deceased/adopted cats.** A retention *policy* decision, not an
  engineering one.
- **Disabling the Cloudflare cron trigger from the app.** Impossible by construction — see below.
- **Fixing the pre-existing `db.*` layering violations** in `system.service.ts`,
  `photo-import.service.ts`, `sync-cron.service.ts`, `reverse-sync.service.ts` and
  `helper.service.ts`. New code follows the rule; the existing calls stay.

## Design

### 1. Retirement is a separate flag, not a reused freeze

A new `system_config` key, `sync_retired`, alongside the existing `sync_frozen`.

- The **same two gates** honour it — `reverse-sync.service.ts` (reverse import) and
  `helper.service.ts` (forward sync), the only places `isSyncFrozen()` is consulted today. Each
  stops if either flag is set.
- **`Unfreeze` does not clear it**, and the Unfreeze button is hidden once it is set. Otherwise
  the killswitch is one click from being undone, by a control built for a different scenario.
- **Irreversible from the UI, recoverable from the database.** The admin screen offers only the
  one-way trip, so "this cannot be undone from here" is literally true. A developer with
  database access can delete the row. No undo machinery is built for an event expected to
  happen once.

Arming it requires a typed confirmation, matching how this codebase already treats destructive
actions.

### 2. A retired tick short-circuits at the route entry

`/api/cron/sync` gains an early check: if retired, return immediately without opening the
`after()` block or touching the database. This is the only compute saving available *inside*
the app, and it matters for the window between throwing the switch and someone disabling the
trigger — a window that may never close if the steward does not perform that step.

The check is deliberately placed **after** the `CRON_SECRET` authorisation check, so an
unauthenticated caller still gets 401 rather than learning the system's retirement state.

### 3. Releasing the sheets

Retirement performs exactly **one** write to the spreadsheet: releasing the A and W–Y column
protections.

`releaseSystemColProtections()` is the delete loop already inside `setupSystemColProtections`
(which clears existing protections before re-applying, to avoid stacking), without the
re-apply.

**Order is load-bearing:** the flag is written **first**, then protections are released
**best-effort**. A Sheets failure is reported to the admin but does not roll back the flag or
fail the action.

The reasoning: a decade from now, the likeliest reason someone reaches for this button is that
Google access has *already* broken — expired credentials, a revoked service account, a deleted
spreadsheet. A killswitch that cannot fire when the thing it kills is already broken is
useless.

**Nothing else is written.** No final column-A restamp, no summary regeneration, no `_config`
clearing. The switch's job is to stop writing; a flurry of farewell writes would contradict it.
`_config!B2` stays because it is harmless and documents what the regions were.

### 4. The storage gauge

`storage.objects` is a real Postgres table in Supabase's `storage` schema, with byte size in
`metadata->>'size'`. The codebase already declares a foreign schema this way — `pgSchema("auth")`
for `auth.users` — so `pgSchema("storage")` follows the existing idiom.

```sql
SELECT sum((metadata->>'size')::bigint) FROM storage.objects WHERE bucket_id = 'cat-photos'
```

One row, seeded through `admin/page.tsx`'s existing blocking `Promise.all` like every other
load on that screen, rendered as its own **Photo Storage** card in both breakpoints:

```
Photo Storage
  ████████░░░░░░░░░░░░   116 MB / 1024 MB  (11%)
  Last cleanup: 12 Aug 2026
```

Thresholds come from the analysis: **normal** below 80%, **warning** at or above 80% (819 MB),
**critical** at or above 92%. The 1024 MB cap is a free-tier plan limit, so it lives in
`lib/constants.ts` as a named constant with a comment explaining it tracks the Supabase plan —
not inline in a component.

A failed read degrades to "Unavailable" rather than rendering `0 MB`, which would read as
reassuring when it is actually uninformed.

### 5. Automated GC

`reconcileCatPhotos` runs **weekly from the cron tick**, guarded by a `last_photo_gc_at`
timestamp in `system_config` so it fires at most once per week regardless of the 20-minute
cadence. The timestamp surfaces in the storage card, so neglect becomes visible rather than
silent.

It is safe to run unattended: `reconcileCatPhotos` (in `lib/services/photo-import.service.ts`,
returning `{ scanned, referenced, removed }`) is already reference-aware, deriving paths from
`photo_url` and reference-checking before deleting — the invariant that stops a merged
duplicate's reassigned blob being reclaimed while the surviving cat still points at it. It is
also documented idempotent and safe to re-run.

The GC runs **after** the sync phases in the tick, wrapped so that a throw is logged and
swallowed rather than auto-freezing sync. Note the wrapper is still needed even though
`reconcileCatPhotos` is best-effort about *removals* (it logs individual delete failures rather
than throwing): the steps before that — listing bucket paths and querying referenced URLs —
can still throw. A storage-cleanup failure is not a sync integrity problem, and freezing sync
over one would raise a false alarm on the wrong subsystem.

**Interaction with retirement, stated explicitly because it is easy to miss.** The retired
short-circuit sits at the route entry, so retiring sync also stops automated GC — while photos
keep accumulating, since the app stays editable. The resolution is that after retirement the
cron trigger is disabled anyway (see §6), so automated GC stops regardless of where the
short-circuit sits. Post-retirement the app becomes a smaller thing: the gauge remains, and
reclaiming falls back to the existing manual Admin button.

### 6. What the app cannot do — the decommission runbook

Two necessary steps live outside the application and must be documented as a runbook in
`docs/operations/`:

**Disable the Cloudflare cron trigger.** The trigger lives in `wrangler.toml` and Cloudflare's
config; a `scheduled()` handler has no way to disarm itself. Removing `crons` and redeploying,
or disabling the trigger in the dashboard, is what actually ends the invocations. This matters
beyond cost: if the app is eventually deleted while the worker survives, `sendAlert` fires
**"App unreachable" to Discord every 20 minutes, forever**, at a webhook nobody owns any more.

**Delete the Apps Script triggers.** After retirement the script becomes actively misleading.
`onEdit` keeps stamping W/X — pointless but harmless. `onChange` is worse: it banners hand-made
tabs with copy reading *"To add a REGION, use the app (Admin > Edit Regions)"*. Once retired
that advice is wrong — stewards may legitimately add tabs by hand, and would get a red warning
pointing them at an app that no longer syncs.

The runbook also records a consequence stewards will not otherwise anticipate: **column B is
`=IMAGE()` pointing at Supabase storage.** While the app lives, photos in the sheets keep
resolving. If the app is later shut down, every photo in every sheet breaks silently.

## Testing

Automated (Jest, mocked seams, matching the existing service-test style):

| Area | Assertion |
| ---- | --------- |
| `isSyncRetired` | True when the row is set; false when absent |
| Sync gates | Forward and reverse sync stop when retired, with `sync_frozen` unset |
| `unfreezeSync` | Does **not** clear `sync_retired` |
| `retireSync` | Writes the flag before attempting any Sheets call |
| `retireSync` | Still resolves successfully when the protection release throws |
| `releaseSystemColProtections` | Deletes A and W–Y protections and re-applies none |
| Cron route | Returns early when retired, without calling `syncAllPendingRegions` |
| Cron route | Returns 401 for a bad secret **even when retired** |
| Weekly GC | Runs when `last_photo_gc_at` is older than 7 days or absent |
| Weekly GC | Skips when it ran within the last 7 days |
| Weekly GC | A throw from the GC is swallowed and does not auto-freeze sync |
| Weekly GC | Updates `last_photo_gc_at` on success |
| Storage gauge | Sums only `cat-photos` rows; a failed read reports unavailable, not zero |

UI is not unit-tested, consistent with the rest of the codebase (`testEnvironment: "node"`, no
component tests). UI verification is `pnpm tsc --noEmit`, `pnpm lint`, and manual checks.

Manual:

1. Storage card shows a plausible figure matching the Supabase dashboard.
2. Trigger a manual reclaim → the "Last cleanup" timestamp updates.
3. Arm the killswitch on a **test** spreadsheet → confirm column protections are gone, the flag
   is set, the Unfreeze button disappears, and a subsequent cron tick does nothing.
4. Confirm no further writes reach the sheet after retirement.

## Risks

- **Retirement is tested once, in production, a decade from now.** By then nobody involved will
  remember how it works. Mitigated by the runbook and by the flag-first ordering, which makes
  the destructive half survivable even when Sheets access is already broken.
- **`storage.objects` is Supabase-managed.** Its shape could change under a platform upgrade.
  The gauge is read-only and degrades to "Unavailable", so a schema change breaks a display
  rather than the app.
- **Weekly GC runs unattended against blob storage.** `reconcileCatPhotos` is reference-aware
  and already ships, but it now runs without a human watching. The `last_photo_gc_at` timestamp
  and the storage card make its behaviour observable.
- **The 1024 MB cap is assumed.** If the project is ever moved to a paid Supabase plan the
  constant is wrong and the gauge under-reports headroom. It is a named constant with a comment
  for exactly this reason.
