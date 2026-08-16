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
 */
export function planRepairs(
  expectedByRegion: Map<string, string[]>,
  presentByRegion: Map<string, Set<string>>,
  pendingCatIds: Set<string>,
): RepairPlan {
  const locationOf = new Map<string, string>();
  for (const [regionId, ids] of presentByRegion) {
    for (const id of ids) locationOf.set(id, regionId);
  }

  const plan: RepairPlan = { missing: [], wrongTab: [] };
  for (const [regionId, catIds] of expectedByRegion) {
    for (const catId of catIds) {
      // A pending task already produces the row: Phase 3 hits idx === -1 and
      // appends it as part of the same operation.
      if (pendingCatIds.has(catId)) continue;
      const found = locationOf.get(catId);
      if (found === regionId) continue;
      if (found === undefined) plan.missing.push({ catId, regionId });
      else plan.wrongTab.push({ catId, fromRegionId: found, toRegionId: regionId });
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
): Promise<ReconcileOutcome> {
  const empty: ReconcileOutcome = {
    restored: 0, moved: 0, deferred: 0, skippedRegions: [], skippedTick: true,
  };

  if (await getSyncHalt()) return empty;

  // Presence is a global property: one failed read makes it untrustworthy
  // everywhere, because a cat living on that tab looks absent from all of them.
  if (failed.size > 0) {
    console.log(
      `[Reconcile] Skipping tick — ${failed.size} region read(s) failed.`,
    );
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
    RECONCILE_MAX_REPAIRS_PER_TICK,
  );
  deferred = notTaken;

  for (const item of taken) {
    if (item.kind === "missing") {
      await db.transaction(async (tx) => {
        await refreshCatInSyncQueue(item.catId, tx);
      });
      restored++;
    } else {
      await repairRegionMove(item.catId, item.fromRegionId, item.toRegionId);
      moved++;
    }
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
 * Same three steps editCat performs, in the same order — supersede the cat's
 * pending tasks for the OLD region only, queue a DELETE so the stale row is
 * removed, then queue the UPDATE that appends it to the new tab.
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
): Promise<void> {
  void toRegionId; // resolved internally by refreshCatInSyncQueue via resolveCatRegion
  await db.transaction(async (tx) => {
    await queueRepo.supersedePendingTasks(
      catId,
      fromRegionId,
      "Superseded by reconciliation",
      tx,
    );
    await queueRepo.insertDeleteTask(catId, fromRegionId, [], tx);
    await refreshCatInSyncQueue(catId, tx);
  });
}
