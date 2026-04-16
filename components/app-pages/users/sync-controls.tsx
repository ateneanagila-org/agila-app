"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Sync</span>
        {frozen !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              frozen
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {frozen ? "Frozen" : "Active"}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={isPending || frozen === true}
          onClick={handleFreeze}
        >
          Freeze
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending || frozen === false}
          onClick={handleUnfreeze}
        >
          Unfreeze
        </Button>
      </div>

      {message && (
        <p className="text-xs text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
