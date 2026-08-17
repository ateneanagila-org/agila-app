"use client";

import { useState, useTransition } from "react";
import { reclaimOrphanedPhotos } from "@/app/actions/system";
import {
  STORAGE_WARN_RATIO,
  STORAGE_CRITICAL_RATIO,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";

function formatMb(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/**
 * Photo Storage: the gauge and the one action that changes it.
 *
 * Reclaim used to live in GSheet Config, which put the measurement and its
 * remedy in different cards — the warning text said "reclaim orphaned photos"
 * while the button to do so sat elsewhere. They are one concern.
 */
export function StorageGauge({
  usage,
  lastCleanupAt,
}: {
  usage: { bytes: number | null; capBytes: number };
  lastCleanupAt: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmReclaim, setConfirmReclaim] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const { bytes, capBytes } = usage;
  const ratio = bytes === null ? 0 : Math.min(bytes / capBytes, 1);
  const critical = ratio >= STORAGE_CRITICAL_RATIO;
  const warning = !critical && ratio >= STORAGE_WARN_RATIO;

  const barColor = critical
    ? "bg-red-500"
    : warning
      ? "bg-amber-500"
      : "bg-brand-green";

  function handleReclaim() {
    setConfirmReclaim(false);
    startTransition(async () => {
      try {
        const r = await reclaimOrphanedPhotos();
        setResult({
          ok: true,
          text:
            r.removed === 0
              ? `No orphans found (${r.scanned} scanned, ${r.referenced} in use).`
              : `Removed ${r.removed} orphaned photo${r.removed === 1 ? "" : "s"} (${r.scanned} scanned, ${r.referenced} in use).`,
        });
      } catch (e) {
        setResult({
          ok: false,
          text: e instanceof Error ? e.message : "Failed — check server logs.",
        });
      }
    });
  }

  return (
    <div>
      <h2 className="mb-2 text-sm font-bold text-brand-dark">Photo Storage</h2>
      <div className="rounded-2xl bg-white ring-1 ring-border">
        <div className="px-4 py-4">
          {bytes === null ? (
            <p className="text-sm text-brand-dark/55">
              Usage unavailable — could not read storage.
            </p>
          ) : (
            <>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-brand-mint"
                role="progressbar"
                aria-valuenow={Math.round(ratio * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Photo storage used"
              >
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.max(ratio * 100, 1)}%` }}
                />
              </div>
              <p className="mt-2 text-sm font-semibold text-brand-dark">
                {formatMb(bytes)} / {formatMb(capBytes)}{" "}
                <span className="font-normal text-brand-dark/55">
                  ({Math.round(ratio * 100)}%)
                </span>
              </p>
              {critical && (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  Critical — storage is nearly full. Reclaim orphaned photos, or
                  the next photo upload may fail.
                </p>
              )}
              {warning && (
                <p className="mt-1 text-xs font-semibold text-amber-600">
                  Getting full. Consider reclaiming orphaned photos.
                </p>
              )}
            </>
          )}

          <p className="mt-2 text-[11px] text-brand-dark/45">
            Last cleanup: {lastCleanupAt ? formatDate(lastCleanupAt) : "never"}
          </p>
        </div>

        <div className="border-t border-border" />

        {/* Reclaim orphaned photos */}
        <div className="px-4 py-3">
          <p className="mb-0.5 text-sm font-semibold text-brand-dark">
            Reclaim orphaned photos
          </p>
          <p className="mb-2 text-xs text-brand-dark/55">
            Delete cat-photo files no cat record points to anymore (left behind by
            deletions and merges). Reference-safe — never touches a photo still in use.
          </p>
          {confirmReclaim ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={handleReclaim}
                className="rounded-full bg-brand-dark px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {isPending ? "Reclaiming…" : "Confirm — delete orphans"}
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
              {isPending ? "Reclaiming…" : "Reclaim photos…"}
            </button>
          )}
          {result && (
            <p
              className={`mt-2 text-xs ${result.ok ? "text-brand-green" : "text-red-600"}`}
            >
              {result.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
