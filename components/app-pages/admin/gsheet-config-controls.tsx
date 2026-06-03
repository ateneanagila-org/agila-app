"use client";

import { useState, useTransition } from "react";
import { provisionSheets, seedSheetUuids, unfreezeSync } from "@/app/actions/system";

type ActionResult = { ok: boolean; text: string };

type GSheetConfigControlsProps = {
  initialStatus: {
    frozen: boolean | null;
    reason: string | null;
  };
};

export function GSheetConfigControls({ initialStatus }: GSheetConfigControlsProps) {
  const [isPending, startTransition] = useTransition();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ActionResult>>({});
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [frozen, setFrozen] = useState<boolean | null>(initialStatus.frozen);
  const [reason, setReason] = useState<string | null>(initialStatus.reason);

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
            {frozen !== null && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${frozen ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                {frozen ? "Frozen" : "Active"}
              </span>
            )}
          </div>
          {frozen && reason && (
            <p className="mb-2 text-xs text-red-500">Reason: {reason}</p>
          )}
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
      </div>
    </div>
  );
}
