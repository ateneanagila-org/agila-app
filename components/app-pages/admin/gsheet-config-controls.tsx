"use client";

import { useState, useTransition } from "react";
import {
  provisionSheets,
  seedSheetUuids,
  unfreezeSync,
  reclaimOrphanedPhotos,
  retireSyncAction,
} from "@/app/actions/system";

type ActionResult = { ok: boolean; text: string };

type GSheetConfigControlsProps = {
  initialStatus: {
    frozen: boolean | null;
    reason: string | null;
    retired: boolean;
  };
};

export function GSheetConfigControls({ initialStatus }: GSheetConfigControlsProps) {
  const [isPending, startTransition] = useTransition();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ActionResult>>({});
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [confirmReclaim, setConfirmReclaim] = useState(false);
  const [frozen, setFrozen] = useState<boolean | null>(initialStatus.frozen);
  const [reason, setReason] = useState<string | null>(initialStatus.reason);
  const [retired, setRetired] = useState(initialStatus.retired);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [typed, setTyped] = useState("");

  function run(key: string, fn: () => Promise<string>) {
    setActiveKey(key);
    startTransition(async () => {
      try {
        const text = await fn();
        setResults((r) => ({ ...r, [key]: { ok: true, text } }));
      } catch (e) {
        setResults((r) => ({
          ...r,
          [key]: {
            ok: false,
            text: e instanceof Error ? e.message : "Failed — check server logs.",
          },
        }));
      } finally {
        setActiveKey(null);
      }
    });
  }

  const busy = (key: string) => isPending && activeKey === key;

  return (
    <div>
      <h2 className="mb-2 text-sm font-bold text-brand-dark">GSheet Config</h2>
      <div className="rounded-2xl bg-white ring-1 ring-border">
        {isPending && (
          <p className="px-4 pt-3 text-xs text-brand-dark/40">Working…</p>
        )}

        {/* Sync status */}
        <div className="px-4 py-3">
          <div className="mb-1 flex items-center gap-2">
            <p className="text-sm font-semibold text-brand-dark">Sync status</p>
            {retired ? (
              <span className="rounded-full bg-brand-dark px-2 py-0.5 text-[11px] font-semibold text-white">
                Retired
              </span>
            ) : frozen !== null ? (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${frozen ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                {frozen ? "Frozen" : "Active"}
              </span>
            ) : null}
          </div>
          {frozen && reason && (
            <p className="mb-2 text-xs text-red-500">Reason: {reason}</p>
          )}
          {retired ? (
            <p className="text-xs text-brand-dark/55">
              Sync is permanently retired. The spreadsheet is no longer written
              to and its system columns have been unlocked for manual editing.
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs text-brand-dark/55">
                Unfreezing runs a full reverse sync then resumes the forward sync cron.
              </p>
              <button
                type="button"
                disabled={isPending || frozen === false}
                onClick={() =>
                  run("unfreeze", async () => {
                    await unfreezeSync();
                    setFrozen(false);
                    setReason(null);
                    return "System unfrozen. Sync resumed.";
                  })
                }
                className="rounded-full bg-brand-dark px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {busy("unfreeze") ? "Unfreezing…" : "Unfreeze"}
              </button>
              {results.unfreeze && (
                <p className={`mt-2 text-xs ${results.unfreeze.ok ? "text-brand-green" : "text-red-600"}`}>
                  {results.unfreeze.text}
                </p>
              )}
            </>
          )}
        </div>

        <div className="border-t border-border" />

        {/* Provision sheets */}
        <div className="px-4 py-3">
          <p className="mb-0.5 text-sm font-semibold text-brand-dark">Provision region sheets</p>
          <p className="mb-2 text-xs text-brand-dark/55">
            Ensure W/X/Y headers, apply A &amp; W–Y protections, refresh _config!B2.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run("provision", async () => {
                const r = await provisionSheets();
                return `Provisioned ${r.regions} region sheet${r.regions === 1 ? "" : "s"} (headers, protections, _config).`;
              })
            }
            className="rounded-full bg-brand-dark px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy("provision") ? "Working…" : "Provision sheets"}
          </button>
          {results.provision && (
            <p className={`mt-2 text-xs ${results.provision.ok ? "text-brand-green" : "text-red-600"}`}>
              {results.provision.text}
            </p>
          )}
        </div>

        <div className="border-t border-border" />

        {/* Seed missing UUIDs */}
        <div className="px-4 py-3">
          <p className="mb-0.5 text-sm font-semibold text-brand-dark">Seed missing UUIDs</p>
          <p className="mb-2 text-xs text-brand-dark/55">
            Mint a permanent UUID in col Y for existing rows that lack one, so they can be imported. Only fills blanks.
          </p>
          {confirmSeed ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setConfirmSeed(false);
                  run("seed", async () => {
                    const r = await seedSheetUuids();
                    return r.seeded === 0
                      ? "No rows needed a UUID."
                      : `Seeded ${r.seeded} UUID${r.seeded === 1 ? "" : "s"}.`;
                  });
                }}
                className="rounded-full bg-brand-dark px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {busy("seed") ? "Seeding…" : "Confirm — write UUIDs"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirmSeed(false)}
                className="rounded-full px-3 py-1.5 text-xs font-bold text-brand-dark/60 hover:text-brand-dark disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmSeed(true)}
              className="rounded-full bg-brand-dark px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Seed UUIDs…
            </button>
          )}
          {results.seed && (
            <p className={`mt-2 text-xs ${results.seed.ok ? "text-brand-green" : "text-red-600"}`}>
              {results.seed.text}
            </p>
          )}
        </div>

        <div className="border-t border-border" />

        {/* Reclaim orphaned photos */}
        <div className="px-4 py-3">
          <p className="mb-0.5 text-sm font-semibold text-brand-dark">Reclaim orphaned photos</p>
          <p className="mb-2 text-xs text-brand-dark/55">
            Delete cat-photo files no cat record points to anymore (left behind by
            deletions and merges). Reference-safe — never touches a photo still in use.
          </p>
          {confirmReclaim ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setConfirmReclaim(false);
                  run("reclaim", async () => {
                    const r = await reclaimOrphanedPhotos();
                    return r.removed === 0
                      ? `No orphans found (${r.scanned} scanned, ${r.referenced} in use).`
                      : `Removed ${r.removed} orphaned photo${r.removed === 1 ? "" : "s"} (${r.scanned} scanned, ${r.referenced} in use).`;
                  });
                }}
                className="rounded-full bg-brand-dark px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {busy("reclaim") ? "Reclaiming…" : "Confirm — delete orphans"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirmReclaim(false)}
                className="rounded-full px-3 py-1.5 text-xs font-bold text-brand-dark/60 hover:text-brand-dark disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmReclaim(true)}
              className="rounded-full bg-brand-dark px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Reclaim photos…
            </button>
          )}
          {results.reclaim && (
            <p className={`mt-2 text-xs ${results.reclaim.ok ? "text-brand-green" : "text-red-600"}`}>
              {results.reclaim.text}
            </p>
          )}
        </div>

        {!retired && (
          <>
            <div className="border-t border-border" />
            <div className="px-4 py-3">
              <p className="mb-0.5 text-sm font-semibold text-red-600">
                Retire sync
              </p>
              <p className="mb-2 text-xs text-brand-dark/55">
                Permanently stops all writes to the spreadsheet and unlocks its
                system columns for manual editing. The app keeps working on its
                own database. <strong>This cannot be undone from here.</strong>
              </p>

              {confirmRetire ? (
                <div className="space-y-2">
                  <p className="text-xs text-brand-dark/60">
                    Type <strong>RETIRE</strong> to confirm.
                  </p>
                  <input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoFocus
                    className="h-9 w-full max-w-xs rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-brand-orange/40"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isPending || typed !== "RETIRE"}
                      onClick={() =>
                        run("retire", async () => {
                          const r = await retireSyncAction();
                          setRetired(true);
                          setConfirmRetire(false);
                          setTyped("");
                          return r.protectionsReleased
                            ? `Sync retired. Released ${r.released} column protection${r.released === 1 ? "" : "s"}.`
                            : `Sync retired, but the spreadsheet could not be updated: ${r.error}. Column protections may still need removing by hand.`;
                        })
                      }
                      className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {busy("retire") ? "Retiring…" : "Confirm — retire sync"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setConfirmRetire(false);
                        setTyped("");
                      }}
                      className="rounded-full px-4 py-1.5 text-xs font-bold text-brand-dark/60 disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setConfirmRetire(true)}
                  className="rounded-full border border-red-300 px-4 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                >
                  Retire sync…
                </button>
              )}

              {results.retire && (
                <p className={`mt-2 text-xs ${results.retire.ok ? "text-brand-green" : "text-red-600"}`}>
                  {results.retire.text}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
