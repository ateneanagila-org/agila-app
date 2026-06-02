"use client";

import { useState, useTransition } from "react";
import { syncRegions, provisionSheets, seedSheetUuids } from "@/app/actions/system";

type ActionResult = { ok: boolean; text: string };

export function SheetSetupControls() {
  const [isPending, startTransition] = useTransition();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ActionResult>>({});
  const [confirmSeed, setConfirmSeed] = useState(false);

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
    <div className="rounded-2xl bg-white p-4 ring-1 ring-border">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-bold text-brand-dark">
          Sheet Setup &amp; Maintenance
        </span>
        {isPending && (
          <span className="text-xs text-brand-dark/40">Working…</span>
        )}
      </div>
      <p className="mb-4 text-xs text-brand-dark/55">
        Server-side, idempotent — safe to re-run. Requires the onEdit trigger
        installed in Apps Script (see the GSheets setup guide).
      </p>

      <div className="space-y-3">
        {/* Sync regions from enum */}
        <ActionRow
          title="Sync regions from enum"
          desc="Insert any region names missing from the database. Edit colors after."
          buttonLabel="Sync regions"
          busy={busy("regions")}
          disabled={isPending}
          result={results.regions}
          onClick={() =>
            run("regions", async () => {
              const r = await syncRegions();
              return r.inserted === 0
                ? "No new regions — table already in sync."
                : `Inserted ${r.inserted}: ${r.names.join(", ")}`;
            })
          }
        />

        {/* Provision sheets */}
        <ActionRow
          title="Provision region sheets"
          desc="Ensure W/X/Y headers, apply A & W–Y protections, refresh _config!B2."
          buttonLabel="Provision sheets"
          busy={busy("provision")}
          disabled={isPending}
          result={results.provision}
          onClick={() =>
            run("provision", async () => {
              const r = await provisionSheets();
              return `Provisioned ${r.regions} region sheet${r.regions === 1 ? "" : "s"} (headers, protections, _config).`;
            })
          }
        />

        {/* Seed missing UUIDs — identity-affecting, inline confirm */}
        <div className="rounded-xl bg-brand-cream/60 p-3 ring-1 ring-border">
          <p className="text-sm font-bold text-brand-dark">Seed missing UUIDs</p>
          <p className="mt-0.5 text-xs text-brand-dark/55">
            Mint a permanent UUID in col Y for existing rows that lack one, so
            they can be imported. Only fills blanks.
          </p>
          {confirmSeed ? (
            <div className="mt-2.5 flex items-center gap-2">
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
                className="rounded-full bg-brand-orange px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {busy("seed") ? "Seeding…" : "Confirm — write UUIDs"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirmSeed(false)}
                className="rounded-full px-3 py-1.5 text-xs font-bold text-brand-dark/60 transition-colors hover:text-brand-dark disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmSeed(true)}
              className="mt-2.5 rounded-full border border-brand-orange/40 px-4 py-1.5 text-xs font-bold text-brand-orange transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Seed UUIDs…
            </button>
          )}
          {results.seed && (
            <p
              className={`mt-2 text-xs ${results.seed.ok ? "text-brand-green" : "text-red-600"}`}
            >
              {results.seed.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionRow({
  title,
  desc,
  buttonLabel,
  busy,
  disabled,
  result,
  onClick,
}: {
  title: string;
  desc: string;
  buttonLabel: string;
  busy: boolean;
  disabled: boolean;
  result?: ActionResult;
  onClick: () => void;
}) {
  return (
    <div className="rounded-xl bg-brand-cream/60 p-3 ring-1 ring-border">
      <p className="text-sm font-bold text-brand-dark">{title}</p>
      <p className="mt-0.5 text-xs text-brand-dark/55">{desc}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="mt-2.5 rounded-full bg-brand-dark px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Working…" : buttonLabel}
      </button>
      {result && (
        <p
          className={`mt-2 text-xs ${result.ok ? "text-brand-green" : "text-red-600"}`}
        >
          {result.text}
        </p>
      )}
    </div>
  );
}
