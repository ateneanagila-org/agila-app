"use client";

import { useEffect, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  listRegions,
  createRegion,
  updateRegion,
  deleteRegion,
} from "@/app/actions/regions";
import { REGION_COLOR_VALUES } from "@/lib/db/enums";
import { CustomSelect } from "@/components/ui/custom-select";

type Region = {
  id: string;
  name: string;
  color: string | null;
};

const PAGE_SIZE = 5;

export function RegionControls() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>("");

  // Inline rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Delete confirm modal
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  async function refresh() {
    const res = await listRegions({});
    if (res?.data) setRegions(res.data as Region[]);
  }
  useEffect(() => {
    listRegions({}).then((res) => {
      if (res?.data) setRegions(res.data as Region[]);
    });
  }, []);

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

  const visible = [...regions].sort((a, b) => a.name.localeCompare(b.name));

  const totalPages = Math.ceil(visible.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const paged = visible.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  /**
   * Opens the confirm modal. Deliberately makes NO server call — the previous
   * implementation probed with an unforced deleteRegion, which the server
   * treats as a real delete for an empty region (row + sheet tab gone before
   * any dialog appeared).
   */
  function handleDeleteClick(r: Region) {
    setError(null);
    setConfirmDelete({ id: r.id, name: r.name });
  }

  return (
    <>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-brand-dark">Regions</h2>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-full bg-brand-dark px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
          >
            <span>Add Region</span>
            <span className="text-base leading-none">+</span>
          </button>
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-border">
          {error && (
            <p className="mx-4 mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}

          {visible.length > 0 && (
            <div className="flex items-center justify-end px-4 py-3">
              <span className="text-xs text-brand-dark/40">
                {visible.length} region{visible.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          <div className="divide-y divide-border">
            {paged.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-brand-dark/40">
                No regions yet.
              </p>
            ) : (
              paged.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-4 py-2.5">
                  {renamingId === r.id ? (
                    <>
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                        className="h-8 flex-1 rounded-lg border border-brand-orange/30 bg-white px-2 text-sm outline-none"
                      />
                      <button
                        type="button"
                        disabled={isPending || !renameValue.trim()}
                        onClick={() =>
                          run(async () => {
                            const res = await updateRegion({
                              id: r.id,
                              name: renameValue.trim(),
                            });
                            if (res?.serverError)
                              throw new Error(res.serverError);
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
                      </span>
                      <button
                        type="button"
                        title="Rename"
                        onClick={() => {
                          setRenamingId(r.id);
                          setRenameValue(r.name);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-brand-dark/40 transition-colors hover:text-brand-dark"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        disabled={isPending}
                        onClick={() => handleDeleteClick(r)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 transition-colors hover:text-red-600 disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                className="text-xs font-semibold text-brand-dark/60 disabled:opacity-30 hover:text-brand-dark"
              >
                ← Prev
              </button>
              <span className="text-xs text-brand-dark/40">
                {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage(safePage + 1)}
                className="text-xs font-semibold text-brand-dark/60 disabled:opacity-30 hover:text-brand-dark"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Region Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowAdd(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-brand-cream p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-lg font-bold text-brand-dark">
              Add Region
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/60">
                  Name
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. NEW ZONE"
                  autoFocus
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-brand-orange/40"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/60">
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
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-full px-4 py-2 text-sm font-bold text-brand-dark/60"
              >
                Cancel
              </button>
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
                    setShowAdd(false);
                  })
                }
                className="rounded-full bg-brand-dark px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                {isPending ? "Adding…" : "Add region"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <DeleteRegionConfirm
          name={confirmDelete.name}
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
    </>
  );
}

function DeleteRegionConfirm({
  name,
  pending,
  onCancel,
  onConfirm,
}: {
  name: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");

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
          Deleting <strong>{name}</strong> permanently removes the region, all of
          its sessions, and any cats that exist only in this zone. This cannot be
          undone.
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
            disabled={typed !== name || pending}
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
