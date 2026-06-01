"use client";

import { useState, useCallback } from "react";
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
} from "@/components/app-pages/database/database-dialogs";
import { ChevronDownIcon, PlusIcon } from "@/components/app-pages/shared/icons";
import { CatPhoto } from "@/components/app-pages/shared/cat-photo";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  createIntervention,
  editIntervention,
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
    status === "Completed"
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

  // Create form state
  const [newType, setNewType] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleCreate = useCallback(async () => {
    if (!catId) return;
    setCreating(true);
    setError(null);
    try {
      const result = await createIntervention({
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
      setShowIntervention(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create.");
    } finally {
      setCreating(false);
    }
  }, [catId, newType, newNotes, refresh]);

  const handleStatusChange = useCallback(
    async (interventionId: string, newStatus: string) => {
      try {
        await editIntervention({
          id: interventionId,
          status: newStatus as InterventionStatus,
        });
        await refresh();
      } catch (err) {
        console.error("Failed to update status:", err);
      }
    },
    [refresh],
  );

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "—";
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
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
              <CatPhoto
                photoUrl={cat?.photo_url}
                name={cat?.name}
                className="h-full w-full overflow-hidden rounded-2xl ring-1 ring-brand-dark/10"
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
                <span className="text-brand-dark/30">·</span>
                <span className="tabular-nums">
                  {formatDate(cat?.last_updated_at)}
                </span>
              </p>
            </div>
          </div>

          <div className="border-t border-brand-dark/8 px-5 tablet:px-6">
            <TopTabs active="Interventions" />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openFilterDialog}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-dark/15 bg-white px-4 py-2 text-xs font-bold text-brand-dark/75 transition-colors hover:border-brand-dark/40 hover:text-brand-dark"
          >
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}{" "}
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={openSortDialog}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-dark/15 bg-white px-4 py-2 text-xs font-bold text-brand-dark/75 transition-colors hover:border-brand-dark/40 hover:text-brand-dark"
          >
            Sort by <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
          <div className="ml-auto" />
          {canManage ? (
            <button
              type="button"
              onClick={() => setShowIntervention(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
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
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-orange">
                        No. {String(index + 1).padStart(2, "0")}
                      </span>
                      <StatusPill status={item.status} />
                    </div>
                    <p className="mt-1 font-heading text-base font-bold leading-tight tracking-tight text-brand-dark">
                      {item.type || "Intervention"}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/45">
                      Requested {formatDate(item.requested_at)}
                    </p>
                    {item.notes ? (
                      <p className="mt-2 text-sm text-brand-dark/70">
                        {item.notes}
                      </p>
                    ) : null}
                  </div>

                  <div className={`w-full tablet:w-40${!canManage ? " pointer-events-none opacity-60" : ""}`}>
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

      {/* FAB (mobile) */}
      {canManage ? (
        <div className="pointer-events-none fixed bottom-20 right-4 z-10 tablet:hidden">
          <button
            type="button"
            onClick={() => setShowIntervention(true)}
            className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange p-0 leading-none shadow-lg transition-opacity hover:opacity-90"
            aria-label="New intervention"
          >
            <PlusIcon className="h-6 w-6 text-white" />
          </button>
        </div>
      ) : null}

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
        onClose={() => {
          setShowIntervention(false);
          setError(null);
        }}
        type={newType}
        onTypeChange={setNewType}
        notes={newNotes}
        onNotesChange={setNewNotes}
        typeOptions={INTERVENTION_TYPE_VALUES}
        onCreate={handleCreate}
        creating={creating}
        error={error}
      />
    </>
  );
}
