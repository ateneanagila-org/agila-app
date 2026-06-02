"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listRegions,
  createRegion,
  renameRegion,
  setRegionArchived,
  deleteRegion,
} from "@/app/actions/regions";
import { REGION_COLOR_VALUES } from "@/lib/db/enums";
import { CustomSelect } from "@/components/ui/custom-select";

type Region = {
  id: string;
  name: string;
  color: string | null;
  archived_at: Date | string | null;
};

export function RegionControls() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    name: string;
    warningText: string | null;
  } | null>(null);

  async function refresh() {
    const res = await listRegions({});
    if (res?.data) setRegions(res.data as Region[]);
  }
  useEffect(() => { refresh(); }, []);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      }
    });
  }

  const visible = regions
    .filter((r) => showArchived || !r.archived_at)
    .sort((a, b) => a.name.localeCompare(b.name));

  async function handleDeleteClick(r: Region) {
    setError(null);
    // Attempt a free delete — if the region is non-empty, the action returns a
    // serverError with the warning text. Surface that in the confirm dialog.
    const res = await deleteRegion({ id: r.id });
    if (res?.serverError) {
      if (res.serverError.includes("not empty")) {
        setConfirmDelete({ id: r.id, name: r.name, warningText: res.serverError });
      } else {
        setError(res.serverError);
      }
      return;
    }
    await refresh();
  }

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-border">
      <h2 className="mb-1 text-sm font-bold text-brand-dark">Edit Regions</h2>
      <p className="mb-4 text-xs text-brand-dark/55">
        Add, rename, archive, or delete regions. Sheet tabs are created and
        renamed automatically.
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      {/* Add region */}
      <div className="mb-4 flex flex-col gap-2 rounded-xl bg-brand-cream/60 p-3 ring-1 ring-border sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-brand-orange">
            New region
          </label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. NEW ZONE"
            className="mt-1 h-10 w-full rounded-xl border border-brand-orange/30 bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-brand-orange/40"
          />
        </div>
        <div className="w-full sm:w-36">
          <label className="text-[11px] font-bold uppercase tracking-wider text-brand-orange">
            Color
          </label>
          <div className="mt-1">
            <CustomSelect
              options={["—", ...REGION_COLOR_VALUES]}
              value={newColor || "—"}
              onChange={(v) => setNewColor(v === "—" ? "" : v)}
              variant="white"
              size="sm"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={isPending || !newName.trim()}
          onClick={() =>
            run(async () => {
              const res = await createRegion({
                name: newName.trim(),
                color: (newColor || null) as never,
              });
              if (res?.serverError) throw new Error(res.serverError);
              setNewName("");
              setNewColor("");
            })
          }
          className="h-10 shrink-0 rounded-full bg-brand-dark px-4 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Add region
        </button>
      </div>

      <label className="mb-2 flex items-center gap-2 text-xs text-brand-dark/60">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Show archived
      </label>

      {/* Region list */}
      <div className="divide-y divide-border">
        {visible.map((r) => (
          <div key={r.id} className="flex items-center gap-2 py-2">
            {renamingId === r.id ? (
              <>
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="h-8 flex-1 rounded-lg border border-brand-orange/30 bg-white px-2 text-sm outline-none"
                />
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    run(async () => {
                      const res = await renameRegion({ id: r.id, name: renameValue.trim() });
                      if (res?.serverError) throw new Error(res.serverError);
                      setRenamingId(null);
                    })
                  }
                  className="rounded-full bg-brand-green px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingId(null)}
                  className="px-2 text-xs font-bold text-brand-dark/50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-semibold text-brand-dark">
                  {r.name}
                  {r.archived_at && (
                    <span className="ml-2 rounded-full bg-brand-dark/10 px-2 py-0.5 text-[10px] font-bold text-brand-dark/50">
                      archived
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingId(r.id);
                    setRenameValue(r.name);
                  }}
                  className="rounded-full px-2 py-1 text-xs font-bold text-brand-dark/60 hover:text-brand-dark"
                >
                  Rename
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    run(async () => {
                      const res = await setRegionArchived({ id: r.id, archived: !r.archived_at });
                      if (res?.serverError) throw new Error(res.serverError);
                    })
                  }
                  className="rounded-full px-2 py-1 text-xs font-bold text-brand-dark/60 hover:text-brand-dark disabled:opacity-40"
                >
                  {r.archived_at ? "Unarchive" : "Archive"}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDeleteClick(r)}
                  className="rounded-full px-2 py-1 text-xs font-bold text-red-600/80 hover:text-red-600 disabled:opacity-40"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        ))}
        {visible.length === 0 && (
          <p className="py-6 text-center text-xs text-brand-dark/40">
            No regions{showArchived ? "" : " — check 'Show archived' to see archived ones"}.
          </p>
        )}
      </div>

      {/* Populated-region delete confirm */}
      {confirmDelete && (
        <DeleteRegionConfirm
          name={confirmDelete.name}
          warningText={confirmDelete.warningText}
          pending={isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() =>
            run(async () => {
              const res = await deleteRegion({
                id: confirmDelete.id,
                force: true,
              });
              if (res?.serverError) throw new Error(res.serverError);
              setConfirmDelete(null);
            })
          }
        />
      )}
    </div>
  );
}

function DeleteRegionConfirm({
  name,
  warningText,
  pending,
  onCancel,
  onConfirm,
}: {
  name: string;
  warningText: string | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const canConfirm = typed === name;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-brand-cream p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-heading text-lg font-bold text-brand-dark">
          Delete &ldquo;{name}&rdquo;?
        </h3>
        <p className="mt-2 text-sm text-red-600">
          {warningText ?? "This cannot be undone."}
        </p>
        <p className="mt-3 text-xs text-brand-dark/60">
          Type the region name to confirm:
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={name}
          className="mt-1 h-9 w-full rounded-lg border border-red-300 bg-white px-2 text-sm outline-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-bold text-brand-dark/60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm || pending}
            onClick={onConfirm}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
