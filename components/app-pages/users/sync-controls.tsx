"use client";

import { useState, useEffect, useTransition } from "react";
import {
  freezeSync,
  unfreezeSync,
  getSyncStatus,
} from "@/app/actions/system";

export function SyncControls() {
  const [frozen, setFrozen] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getSyncStatus().then((res) => setFrozen(res.frozen));
  }, []);

  function handleFreeze() {
    startTransition(async () => {
      setMessage(null);
      try {
        await freezeSync();
        setFrozen(true);
        setMessage("System frozen. Sheet protections removed.");
      } catch {
        setMessage("Freeze failed — check server logs.");
      }
    });
  }

  function handleUnfreeze() {
    startTransition(async () => {
      setMessage(null);
      try {
        await unfreezeSync();
        setFrozen(false);
        setMessage("System unfrozen. Sheet protections restored.");
      } catch {
        setMessage("Unfreeze failed — check server logs.");
      }
    });
  }

  return (
    <div className="rounded-2xl bg-brand-green p-4 ring-1 ring-brand-green">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-bold text-white">GSheet Sync</span>
        {frozen !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              frozen
                ? "bg-red-500/30 text-red-200"
                : "bg-green-500/30 text-green-200"
            }`}
          >
            {frozen ? "Frozen" : "Active"}
          </span>
        )}
        {isPending && (
          <span className="text-xs text-white/50">Working...</span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending || frozen === true}
          onClick={handleFreeze}
          className="rounded-full bg-red-500/80 px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Freeze
        </button>
        <button
          type="button"
          disabled={isPending || frozen === false}
          onClick={handleUnfreeze}
          className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Unfreeze
        </button>
      </div>

      {message && (
        <p className="mt-2 text-xs text-white/60">{message}</p>
      )}
    </div>
  );
}
