import {
  STORAGE_WARN_RATIO,
  STORAGE_CRITICAL_RATIO,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";

function formatMb(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function StorageGauge({
  usage,
  lastCleanupAt,
}: {
  usage: { bytes: number | null; capBytes: number };
  lastCleanupAt: string | null;
}) {
  const { bytes, capBytes } = usage;
  const ratio = bytes === null ? 0 : Math.min(bytes / capBytes, 1);
  const critical = ratio >= STORAGE_CRITICAL_RATIO;
  const warning = !critical && ratio >= STORAGE_WARN_RATIO;

  const barColor = critical
    ? "bg-red-500"
    : warning
      ? "bg-amber-500"
      : "bg-brand-green";

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
      </div>
    </div>
  );
}
