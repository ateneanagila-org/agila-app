"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DetailHeader,
  TopTabs,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import {
  DatabaseFiltersDialog,
  DatabaseSortByDialog,
  NewInterventionDialog,
  DeleteInterventionDialog,
} from "@/components/app-pages/database/database-dialogs";
import {
  ChevronDownIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/app-pages/shared/icons";
import { CatPhotoButton } from "@/components/app-pages/shared/photo-lightbox";
import { positionFromCat } from "@/lib/photo-position";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  createIntervention,
  editIntervention,
  removeIntervention,
} from "@/app/actions/interventions";
import { useAuth } from "@/contexts/auth-context";
import { useCatDetail } from "@/contexts/cat-detail-context";
import type { SelectIntervention } from "@/lib/validation/interventions";
import {
  INTERVENTION_TYPE_VALUES,
  INTERVENTION_STATUS_VALUES,
} from "@/lib/db/enums";
import type { InterventionType, InterventionStatus } from "@/lib/db/enums";
import { useFilterSort } from "@/lib/hooks/use-filter-sort";
import { INTERVENTIONS_CONFIG } from "@/lib/hooks/filter-sort-configs";

function sexGlyph(s: string | null | undefined): string | null {
  if (s === "Male") return "♂";
  if (s === "Female") return "♀";
  return null;
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const cls =
    status === "Finished"
      ? "bg-brand-green/12 text-brand-green"
      : status === "Cancelled"
        ? "bg-brand-dark/8 text-brand-dark/60"
        : "bg-brand-orange/12 text-brand-orange";
  return (
    <span
      className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      {status || "Pending"}
    </span>
  );
}

/** Notes preview clamped to a few lines (responsive) with an inline expand
 *  toggle — visible only when the text actually overflows. Role-agnostic so
 *  read-only volunteers can still read long notes without the edit dialog. */
function InterventionNotes({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measured while clamped (expanded toggling doesn't re-run this), so the
    // toggle stays available after expanding.
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div className="mt-2">
      <p
        ref={ref}
        className={`whitespace-pre-wrap break-words text-sm text-brand-dark/70${
          expanded ? "" : " line-clamp-2 tablet:line-clamp-3"
        }`}
      >
        {text}
      </p>
      {overflows ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-0.5 text-[11px] font-bold text-brand-green underline underline-offset-2"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

export function DatabaseInterventionsScreen() {
  const { canManage } = useAuth();
  const router = useRouter();
  const {
    catId,
    cat,
    interventions: interventionsList,
    loading,
    error: ctxError,
    refresh,
  } = useCatDetail();

  const [showIntervention, setShowIntervention] = useState(false);

  // Create/edit form state ("edit" carries the target id)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newType, setNewType] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete confirmation
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const displayError = error ?? ctxError;

  const {
    filtered: filteredInterventions,
    activeFilters,
    activeFilterCount,
    clearFilters,
    applyFilters,
    sortKey,
    sortOrder,
    openDialog,
    openFilterDialog,
    openSortDialog,
    closeDialog,
    applySort,
  } = useFilterSort<SelectIntervention>(
    interventionsList,
    INTERVENTIONS_CONFIG,
    (item, key) => {
      if (key === "type") return item.type ?? null;
      if (key === "status") return item.status ?? null;
      return null;
    },
    (item, key) => {
      if (key === "requested_at")
        return item.requested_at ? new Date(item.requested_at) : null;
      if (key === "type") return item.type ?? "";
      if (key === "status") return item.status ?? "";
      return null;
    },
  );

  const openCreate = useCallback(() => {
    setDialogMode("create");
    setEditingId(null);
    setNewType("");
    setNewNotes("");
    setError(null);
    setShowIntervention(true);
  }, []);

  const openEdit = useCallback((item: SelectIntervention) => {
    setDialogMode("edit");
    setEditingId(item.id);
    setNewType(item.type ?? "");
    setNewNotes(item.notes ?? "");
    setError(null);
    setShowIntervention(true);
  }, []);

  // Server errors are logged centrally (actionClient.handleServerError) and
  // returned as result.serverError — surfaced here for the user; finally only
  // resets the busy flag.
  const handleSubmit = useCallback(async () => {
    if (!catId) return;
    setCreating(true);
    setError(null);
    try {
      const result =
        dialogMode === "edit" && editingId
          ? // Edit: send null (not undefined) so cleared fields actually persist —
            // undefined would omit the key and leave the old value in place.
            await editIntervention({
              id: editingId,
              type: (newType || null) as InterventionType | null,
              notes: newNotes || null,
            })
          : await createIntervention({
              cat_id: catId,
              type: (newType || undefined) as InterventionType | undefined,
              notes: newNotes || undefined,
            });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      setNewType("");
      setNewNotes("");
      setEditingId(null);
      setShowIntervention(false);
      await refresh();
    } finally {
      setCreating(false);
    }
  }, [catId, dialogMode, editingId, newType, newNotes, refresh]);

  const handleStatusChange = useCallback(
    async (interventionId: string, newStatus: string) => {
      const result = await editIntervention({
        id: interventionId,
        status: newStatus as InterventionStatus,
      });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      await refresh();
    },
    [refresh],
  );

  const handleDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      const result = await removeIntervention.bind(null, pendingDeleteId)();
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      setPendingDeleteId(null);
      await refresh();
    } finally {
      setDeleting(false);
    }
  }, [pendingDeleteId, refresh]);

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "—";
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
      </div>
    );
  }

  const sex_glyph = sexGlyph(cat?.sex);

  return (
    <>
      <PageContent>
        <DetailHeader
          name={cat?.name || "Unnamed"}
          lastUpdated={formatDate(cat?.last_updated_at)}
          backHref="/dashboard/database"
        />

        {displayError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {displayError}
          </div>
        ) : null}

        {/* Identity card */}
        <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-brand-dark/8">
          <div className="flex flex-col gap-5 p-5 tablet:flex-row tablet:items-center tablet:gap-6 tablet:p-6">
            <div className="h-32 w-32 shrink-0 self-center tablet:h-28 tablet:w-28 tablet:self-auto">
              <CatPhotoButton
                catId={catId ?? ""}
                photoUrl={cat?.photo_url}
                name={cat?.name}
                position={cat ? positionFromCat(cat) : null}
                canEdit={canManage}
                onChanged={refresh}
                className="h-full w-full rounded-2xl ring-1 ring-brand-dark/10"
                iconClassName="h-12 w-12 text-brand-green/30"
                sizes="128px"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-2xl font-bold leading-tight tracking-tight text-brand-dark truncate tablet:text-3xl">
                  {cat?.name || "Unnamed"}
                </h2>
                {sex_glyph ? (
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-green/12 px-1.5 text-sm font-bold text-brand-green">
                    {sex_glyph}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {cat?.color ? (
                  <span className="inline-flex h-6 items-center rounded-full bg-brand-cream-dark/60 px-2.5 text-[11px] font-semibold text-brand-dark/75">
                    {cat.color}
                  </span>
                ) : null}
                {cat?.age ? (
                  <span className="inline-flex h-6 items-center rounded-full bg-brand-cream-dark/60 px-2.5 text-[11px] font-semibold text-brand-dark/75">
                    {cat.age}
                  </span>
                ) : null}
              </div>

              <p className="mt-3 flex items-baseline gap-1.5 text-xs text-brand-dark/60">
                <span className="font-bold uppercase tracking-wider text-brand-green/80 text-[10px]">
                  Last seen
                </span>
                <span className="font-semibold text-brand-dark/80">
                  {cat?.spot_last_seen || "Unknown"}
                </span>
                {cat?.date_last_seen ? (
                  <>
                    <span className="text-brand-dark/30">·</span>
                    <span className="tabular-nums">
                      {formatDate(cat.date_last_seen)}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="border-t border-brand-dark/8 px-5 pt-2 tablet:px-6">
            <TopTabs active="Interventions" />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 max-[400px]:gap-1.5">
          <button
            type="button"
            onClick={openFilterDialog}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-dark/15 bg-white px-4 py-2 text-xs font-bold text-brand-dark/75 transition-colors hover:border-brand-dark/40 hover:text-brand-dark max-[400px]:px-2.5 max-[400px]:text-[10px]"
          >
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}{" "}
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={openSortDialog}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-dark/15 bg-white px-4 py-2 text-xs font-bold text-brand-dark/75 transition-colors hover:border-brand-dark/40 hover:text-brand-dark max-[400px]:px-2.5 max-[400px]:text-[10px]"
          >
            Sort by <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
          <div className="ml-auto" />
          {canManage ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90 max-[400px]:px-2.5 max-[400px]:text-[10px]"
            >
              New Intervention <PlusIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {/* List */}
        <div className="rounded-3xl bg-white p-2 ring-1 ring-brand-dark/8 tablet:p-3">
          {filteredInterventions.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-brand-dark/55">
              No interventions yet.
            </div>
          ) : (
            <ul className="divide-y divide-brand-dark/8">
              {filteredInterventions.map((item, index) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 p-4 tablet:flex-row tablet:items-center tablet:justify-between tablet:gap-6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-orange">
                          No. {String(index + 1).padStart(2, "0")}
                        </span>
                        <StatusPill status={item.status} />
                      </div>
                      {canManage ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-brand-dark/40 transition-colors hover:bg-brand-cream-dark hover:text-brand-dark"
                            aria-label="Edit intervention"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(item.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-brand-dark/40 transition-colors hover:bg-red-50 hover:text-red-500"
                            aria-label="Delete intervention"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-1 font-heading text-base font-bold leading-tight tracking-tight text-brand-dark">
                      {item.type || "Intervention"}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/45">
                      Requested {formatDate(item.requested_at)}
                    </p>
                    {item.notes ? <InterventionNotes text={item.notes} /> : null}
                  </div>

                  <div className={`w-full tablet:w-40 tablet:shrink-0${!canManage ? " pointer-events-none opacity-60" : ""}`}>
                    <CustomSelect
                      options={INTERVENTION_STATUS_VALUES}
                      value={item.status ?? "Pending"}
                      onChange={(v) => handleStatusChange(item.id, v)}
                      variant="white"
                      size="sm"
                      placeholder="Status"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard/database")}
            className="rounded-full border-2 border-brand-dark/15 px-5 py-2 text-sm font-bold text-brand-dark/70 transition-colors hover:border-brand-dark/40 hover:text-brand-dark"
          >
            Done
          </button>
        </div>
      </PageContent>

      <DatabaseFiltersDialog
        open={openDialog === "filter"}
        onClose={closeDialog}
        categories={INTERVENTIONS_CONFIG.filters}
        activeFilters={activeFilters}
        onClear={clearFilters}
        onApply={applyFilters}
      />
      <DatabaseSortByDialog
        open={openDialog === "sort"}
        onClose={closeDialog}
        options={INTERVENTIONS_CONFIG.sortOptions}
        activeKey={sortKey}
        order={sortOrder}
        onApply={applySort}
      />
      <NewInterventionDialog
        open={showIntervention}
        mode={dialogMode}
        onClose={() => {
          setShowIntervention(false);
          setError(null);
        }}
        type={newType}
        onTypeChange={setNewType}
        notes={newNotes}
        onNotesChange={setNewNotes}
        typeOptions={INTERVENTION_TYPE_VALUES}
        onCreate={handleSubmit}
        creating={creating}
        error={error}
      />
      <DeleteInterventionDialog
        open={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={handleDelete}
        isLoading={deleting}
      />
    </>
  );
}
