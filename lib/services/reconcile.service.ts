import { db } from "@/lib/db";
import type { SheetRow } from "@/lib/services/helper.service";
import { refreshCatInSyncQueue } from "@/lib/services/helper.service";
import { getSyncHalt } from "@/lib/services/system.service";
import { sendSyncAlert } from "@/lib/services/discord.service";
import * as catsRepo from "@/lib/repo/cats.repo";
import * as queueRepo from "@/lib/repo/sync-queue.repo";
// NOTE: no gsheetSyncQueue / drizzle-orm imports here — every statement against
// the queue table lives in sync-queue.repo.ts. This service only orchestrates
// the transaction.

export type RepairPlan = {
  missing: { catId: string; regionId: string }[];
  wrongTab: { catId: string; fromRegionId: string; toRegionId: string }[];
};

export type ReconcileOutcome = {
  restored: number;
  moved: number;
  /** Repairs left for the next tick because the budget ran out. */
  deferred: number;
  skippedRegions: string[];
  skippedTick: boolean;
};

/**
 * Presence is global on purpose. Checking only the cat's own region would append
 * a cat that already sits on a stale tab, producing the double-listing failure
 * this is meant to prevent.
 *
 * A cat can be present on MORE than one tab at once — that double-listing is
 * exactly the failure this function has to catch, not just the single-tab
 * "wrong tab" case. So `locationOf` collects every tab a cat was found on,
 * not just the last one a `Map` overwrite happened to keep: with a plain
 * last-writer-wins map, iterating regions in one order reports the duplicate
 * as `wrongTab` (and cleans it up) while the reverse order reports the same
 * cat as correctly placed (and never flags it) — the exact silent,
 * order-dependent miss this is meant to prevent. Every location that is NOT
 * the expected region becomes its own `wrongTab` repair, even when the cat is
 * ALSO correctly present at the expected region — that location is left
 * alone; only the stale extras are queued for cleanup.
 *
 * Disjointness from reverse sync (see `reconcileSheetRepresentation`'s
 * skippedTick comment) holds for `missing` only: a missing cat is by
 * definition absent from every tab, so reverse sync — which only processes
 * rows that exist — has nothing to cancel. A `wrongTab` cat is present on a
 * tab, and reverse sync's PENDING-task cancellation is scoped by entity id
 * only, not by region (see `reverse-sync.service.ts`'s cancel-on-edit block),
 * so a human edit landing on the stale row between the snapshot and the
 * repair can supersede both the DELETE and the compensating UPDATE. That is
 * bounded, not silent: the edit stamps the cat's `last_updated_at`, so the
 * next tick re-detects the same wrongTab state and repairs it again.
 */
export function planRepairs(
  expectedByRegion: Map<string, string[]>,
  presentByRegion: Map<string, Set<string>>,
  pendingCatIds: Set<string>,
): RepairPlan {
  const locationOf = new Map<string, string[]>();
  for (const [regionId, ids] of presentByRegion) {
    for (const id of ids) {
      const locations = locationOf.get(id) ?? [];
      locations.push(regionId);
      locationOf.set(id, locations);
    }
  }

  const plan: RepairPlan = { missing: [], wrongTab: [] };
  for (const [regionId, catIds] of expectedByRegion) {
    for (const catId of catIds) {
      // A pending task already produces the row: Phase 3 hits idx === -1 and
      // appends it as part of the same operation.
      if (pendingCatIds.has(catId)) continue;
      const locations = locationOf.get(catId);
      if (!locations || locations.length === 0) {
        plan.missing.push({ catId, regionId });
        continue;
      }
      // Every location other than the expected one is a stale duplicate (or,
      // if there is exactly one and it isn't the expected region, the sole
      // wrong-tab case). The expected location, if present, is left alone.
      for (const found of locations) {
        if (found !== regionId) {
          plan.wrongTab.push({ catId, fromRegionId: found, toRegionId: regionId });
        }
      }
    }
  }
  return plan;
}

/**
 * A region that expects cats but whose snapshot came back completely empty.
 * Reads succeeded (a failed read skips the whole tick), so the API genuinely
 * returned nothing for a tab we believe holds rows — the signature of a wipe or
 * a botched script, not of ordinary drift. Pause and alert rather than rewriting
 * the tab underneath whoever is working on it.
 *
 * The escape is deliberately cheap: restore or add any single row and this stops
 * tripping, after which the per-tick budget clears the rest automatically. That
 * is why this stays a hard skip while a proportional "too many repairs" cap was
 * rejected — the cap's only escape was repairing more by hand than it allowed,
 * i.e. doing this function's job manually.
 */
export function looksWiped(expected: number, present: number): boolean {
  return expected > 0 && present === 0;
}

/**
 * Per-tick repair budget. Bounds how much a mis-plan can do in one tick without
 * ever refusing to converge: whatever is deferred is simply retried next tick,
 * and ticks run every 20 minutes.
 *
 * 25 is derived, not picked: observed drift over the app's lifetime is 6 cats,
 * the largest region holds 71, and the census is 558. 25 is roughly four times
 * normal drift — so ordinary operation always clears in a single tick — while
 * remaining well under a single region, so no bug can rewrite a whole tab at
 * once. Worst case, a full-census mis-plan drains in under a day.
 */
export const RECONCILE_MAX_REPAIRS_PER_TICK = 25;

export function takeWithinBudget<T>(
  items: T[],
  budget: number,
): { taken: T[]; deferred: number } {
  const taken = items.slice(0, Math.max(0, budget));
  return { taken, deferred: items.length - taken.length };
}

export async function reconcileSheetRepresentation(
  allRegions: { id: string; name: string }[],
  states: Map<string, SheetRow[]>,
  failed: Set<string>,
  // Test seam only — production always uses the module default. Kept as a
  // parameter (not an env var or module mock) so the shared-budget property
  // between `missing` and `wrongTab` repairs can be exercised directly.
  maxRepairsPerTick: number = RECONCILE_MAX_REPAIRS_PER_TICK,
): Promise<ReconcileOutcome> {
  const empty: ReconcileOutcome = {
    restored: 0, moved: 0, deferred: 0, skippedRegions: [], skippedTick: true,
  };

  if (await getSyncHalt()) return empty;

  // Presence is a global property: one failed read makes it untrustworthy
  // everywhere, because a cat living on that tab looks absent from all of them.
  if (failed.size > 0) {
    const failedNames = allRegions
      .filter((r) => failed.has(r.id))
      .map((r) => r.name);
    console.log(
      `[Reconcile] Skipping tick — ${failed.size} region read(s) failed.`,
    );
    // A console.log is not a signal anyone sees. A renamed or deleted tab
    // fails every tick from then on, so without an alert reconciliation goes
    // silently dark forever — exactly the failure mode this branch exists to
    // end. Wrapped in its own try/catch, like the other alert sites, so a
    // Discord outage can't turn a real skipped tick into an uncaught throw.
    try {
      await sendSyncAlert(
        `Sheet reconciliation: skipped this tick — region read(s) failed for ${failedNames.join(", ") || failed.size + " region(s)"}. Reconciliation is off until this resolves.`,
      );
    } catch (err) {
      console.error(
        "[Reconcile] Alert delivery failed:",
        err instanceof Error ? err.message : err,
      );
    }
    return empty;
  }

  const [rows, pendingIds] = await Promise.all([
    catsRepo.findOriginalCatIdsByEffectiveRegion(),
    queueRepo.findPendingSyncCatIds(),
  ]);

  const expectedByRegion = new Map<string, string[]>();
  for (const { cat_id, region_id } of rows) {
    if (!region_id) continue; // no resolvable region — nowhere to put it
    const list = expectedByRegion.get(region_id) ?? [];
    list.push(cat_id);
    expectedByRegion.set(region_id, list);
  }

  const presentByRegion = new Map<string, Set<string>>();
  for (const region of allRegions) {
    const ids = new Set<string>();
    for (const r of states.get(region.id) ?? []) {
      const id = String(r.entityId ?? "").trim();
      if (id) ids.add(id);
    }
    presentByRegion.set(region.id, ids);
  }

  const plan = planRepairs(expectedByRegion, presentByRegion, new Set(pendingIds));

  const skippedRegions: string[] = [];
  let restored = 0;
  let moved = 0;
  let deferred = 0;

  // Drop repairs aimed at a region whose tab looks wiped, then spend one shared
  // budget across everything that remains. Wrong-tab repairs count against the
  // same budget precisely because they are the destructive path.
  const eligible: Array<
    | { kind: "missing"; catId: string; regionId: string }
    | { kind: "wrongTab"; catId: string; fromRegionId: string; toRegionId: string }
  > = [];

  for (const region of allRegions) {
    const expected = expectedByRegion.get(region.id)?.length ?? 0;
    const present = presentByRegion.get(region.id)?.size ?? 0;
    if (looksWiped(expected, present)) {
      skippedRegions.push(region.name);
      continue;
    }
    for (const m of plan.missing.filter((x) => x.regionId === region.id)) {
      eligible.push({ kind: "missing", ...m });
    }
    for (const w of plan.wrongTab.filter((x) => x.toRegionId === region.id)) {
      eligible.push({ kind: "wrongTab", ...w });
    }
  }

  const { taken, deferred: notTaken } = takeWithinBudget(
    eligible,
    maxRepairsPerTick,
  );
  deferred = notTaken;

  const missingCatIds: string[] = [];

  for (const item of taken) {
    if (item.kind === "missing") {
      // refreshCatInSyncQueue returns undefined ONLY when the cat is gone or
      // has no resolvable region. When the cat resolves but is no longer
      // Original (e.g. merged between the snapshot and this repair running)
      // it returns the region — truthy — while queueing nothing
      // (helper.service.ts:254-260). So a truthy check on the return value
      // can't tell "queued" from "resolved but skipped", and counting on it
      // overstates `restored` (and the Discord alert says "restored" for a
      // cat that got nothing queued). Confirm a task actually landed instead.
      await db.transaction((tx) => refreshCatInSyncQueue(item.catId, tx));
      missingCatIds.push(item.catId);
    } else {
      const didMove = await repairRegionMove(
        item.catId,
        item.fromRegionId,
        item.toRegionId,
      );
      if (didMove) moved++;
    }
  }

  if (missingCatIds.length > 0) {
    // planRepairs (via pendingCatIds) already excluded any catId that had a
    // PENDING task before this tick, so any of these ids showing up as
    // PENDING now is exactly the set the loop above actually queued.
    const nowPending = new Set(await queueRepo.findPendingSyncCatIds());
    restored = missingCatIds.filter((id) => nowPending.has(id)).length;
  }

  if (restored + moved + deferred + skippedRegions.length > 0) {
    const parts: string[] = [];
    if (restored) parts.push(`restored ${restored} missing row(s)`);
    if (moved) parts.push(`moved ${moved} row(s) to the correct tab`);
    // Report the remainder, or a partial repair reads as a complete one.
    if (deferred) parts.push(`${deferred} more queued for the next tick`);
    if (skippedRegions.length) {
      parts.push(`skipped ${skippedRegions.join(", ")} — tab looks wiped`);
    }
    try {
      await sendSyncAlert(
        `Sheet reconciliation: ${parts.join("; ")}. Deleting a row does not delete a cat — set column L status instead.`,
      );
    } catch (err) {
      console.error(
        "[Reconcile] Alert delivery failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { restored, moved, deferred, skippedRegions, skippedTick: false };
}

/**
 * A region move whose DELETE was missed: the row still sits on the old tab.
 *
 * ORDER MATTERS — this must match `editCat`'s sequence exactly
 * (`cats.service.ts:107-131`): refresh FIRST, capture the region it actually
 * resolved to, and only supersede + DELETE the old region if that resolution
 * really did move away from it. An earlier draft of this function ran
 * supersede + DELETE before the refresh, unconditionally. Two ways that goes
 * wrong:
 *
 *   - `refreshCatInSyncQueue` returns undefined ONLY when the cat is gone or
 *     has no resolvable region — that's exactly what the `!dest` guard below
 *     catches, so no DELETE fires either. A cat that resolves but is no
 *     longer Original (e.g. merged) instead returns the region — truthy —
 *     while queueing nothing (`helper.service.ts:254-260`), so `!dest` does
 *     NOT catch it: the DELETE still fires with no compensating UPDATE, and
 *     the cat's row is simply gone from every sheet. That is correct here —
 *     a merged cat should not be re-added to any tab — but it means this
 *     path's safety rests on the entry_status gate inside
 *     `refreshCatInSyncQueue`, not on this function's own `!dest` check.
 *   - A race: between the expected-set snapshot and this repair running, a
 *     manager's `editCat` moves the cat back to `fromRegionId`. Refreshing
 *     first makes `dest.id === fromRegionId` true and this correctly no-ops.
 *     Refreshing last would instead queue a DELETE and an UPDATE against the
 *     SAME region with the SAME (transaction-constant) `createdAt`, an
 *     arbitrary tie `syncAndCompactRegion` breaks by `asc(createdAt)` order —
 *     either the row is written then spliced out (the cat vanishes from the
 *     sheet) or spliced then re-appended through the `idx === -1` branch,
 *     which assigns a fresh catalog number (the cat is silently renumbered,
 *     and catalog numbers are sheet-owned and never stored in the DB, so this
 *     is unrecoverable).
 *
 * Returns whether a move repair actually happened, so the caller counts
 * successes and not attempts.
 *
 * The DELETE is the one destructive act in reconciliation. Cols A-V are DB
 * projections and are rewritten at the destination, but cols W/X
 * (last_edited_at, edited_by) are Apps Script-owned and sheet-only, so they do
 * not survive the move.
 */
async function repairRegionMove(
  catId: string,
  fromRegionId: string,
  toRegionId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const dest = await refreshCatInSyncQueue(catId, tx);
    // By the time this guard can see `dest.id === fromRegionId` — the race
    // this no-op exists for — refreshCatInSyncQueue has already queued an
    // UPDATE for `dest.id`, i.e. the CURRENT (correct) region, and that
    // UPDATE commits regardless: this function does not, and must not, roll
    // it back. That is one redundant-but-harmless rewrite of the correct
    // tab, not the corruption this guard prevents (a DELETE with no
    // compensating UPDATE against the OLD tab). Do not reorder this to
    // check-then-refresh to avoid that write — running supersede/DELETE
    // before the refresh is exactly the ordering the Critical above was
    // fixed by removing.
    if (!dest || dest.id === fromRegionId) return false;

    // toRegionId is what the planner expected from the read-only snapshot;
    // dest.id is what actually resolved just now, inside this transaction.
    // They agree unless the cat's region changed underneath the snapshot —
    // not a bug, just why the guard above trusts dest, not toRegionId.
    if (dest.id !== toRegionId) {
      console.warn(
        `[Reconcile] region move for cat ${catId}: planner expected ${toRegionId}, resolved to ${dest.id} — cat moved again since the snapshot was taken.`,
      );
    }

    await queueRepo.supersedePendingTasks(
      catId,
      fromRegionId,
      "Superseded by reconciliation",
      tx,
    );
    await queueRepo.insertDeleteTask(catId, fromRegionId, [], tx);
    return true;
  });
}
