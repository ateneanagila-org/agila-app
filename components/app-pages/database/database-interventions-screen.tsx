"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  DetailHeader,
  TopTabs,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import {
  DialogShell,
  FiltersDialog,
  SortByDialog,
} from "@/components/app-pages/shared/dialogs";
import {
  ChevronDownIcon,
  ImagePlaceholderIcon,
  PlusCircleIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";
import { getCats } from "@/app/actions/cats";
import {
  getInterventions,
  createIntervention,
  editIntervention,
} from "@/app/actions/interventions";
import { syncAllPendingRegions } from "@/app/actions/google-sheets";
import type { SelectCat } from "@/lib/validation/cats";
import type { SelectIntervention } from "@/lib/validation/interventions";
import {
  INTERVENTION_TYPE_VALUES,
  INTERVENTION_STATUS_VALUES,
} from "@/lib/db/enums";
import type { InterventionType, InterventionStatus } from "@/lib/db/enums";
import { useFilterSort } from "@/lib/hooks/use-filter-sort";
import { INTERVENTIONS_CONFIG } from "@/lib/hooks/filter-sort-configs";

export function DatabaseInterventionsScreen() {
  const searchParams = useSearchParams();
  const catId = searchParams.get("id");

  const [cat, setCat] = useState<SelectCat | null>(null);
  const [interventionsList, setInterventionsList] = useState<
    SelectIntervention[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showSort, setShowSort] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showIntervention, setShowIntervention] = useState(false);

  // Create form state
  const [newType, setNewType] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    filtered: filteredInterventions,
    activeFilters,
    toggleFilter,
    clearFilters,
    activeFilterCount,
    sortKey,
    setSortKey,
    sortOrder,
    setSortOrder,
  } = useFilterSort<SelectIntervention>(
    interventionsList,
    INTERVENTIONS_CONFIG,
    (item, key) => {
      if (key === "type") return item.type ?? null;
      if (key === "status") return item.status ?? null;
      return null;
    },
    (item, key) => {
      if (key === "requested_at") return item.requested_at ? new Date(item.requested_at) : null;
      if (key === "type") return item.type ?? "";
      if (key === "status") return item.status ?? "";
      return null;
    },
  );

  const fetchData = useCallback(async () => {
    if (!catId) {
      setError("Missing cat ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [catResult, intResult] = await Promise.all([
        getCats({ id: catId }),
        getInterventions({ cat_id: catId }),
      ]);
      if (catResult?.data && catResult.data.length > 0) {
        setCat(catResult.data[0]);
      } else {
        setError("Cat not found.");
      }
      if (intResult?.data) {
        setInterventionsList(intResult.data);
      }
    } catch (err) {
      console.error("Failed to fetch interventions:", err);
      setError("Failed to load interventions.");
    } finally {
      setLoading(false);
    }
  }, [catId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      syncAllPendingRegions();
      setNewType("");
      setNewNotes("");
      setShowIntervention(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create.");
    } finally {
      setCreating(false);
    }
  }, [catId, newType, newNotes, fetchData]);

  const handleStatusChange = useCallback(
    async (interventionId: string, newStatus: string) => {
      try {
        const boundEdit = editIntervention.bind(null, interventionId);
        await boundEdit({
          status: newStatus as InterventionStatus,
        });
        syncAllPendingRegions();
        await fetchData();
      } catch (err) {
        console.error("Failed to update status:", err);
      }
    },
    [fetchData],
  );

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "—";
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
  };

  const sexSymbol = (s: string | null | undefined): string | null => {
    if (s === "Male") return "♂";
    if (s === "Female") return "♀";
    return null;
  };

  const sexColor = (s: string | null | undefined): string => {
    if (s === "Male") return "text-blue-500";
    if (s === "Female") return "text-pink-500";
    return "text-slate-400";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
      </div>
    );
  }

  return (
    <>
      <div className="tablet:hidden">
        <PageContent>
          <DetailHeader
            name={cat?.name || "Unnamed"}
            lastUpdated={formatDate(cat?.last_updated_at)}
            backHref="/database"
          />
          <TopTabs active="Interventions" />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowSort(true)}
              className="flex-1 rounded-xl bg-brand-orange px-4 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              Sort By
            </button>
            <button
              type="button"
              onClick={() => setShowIntervention(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              Create New
              <span className="text-lg leading-none">+</span>
            </button>
          </div>

          {filteredInterventions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No interventions yet.
            </div>
          ) : (
            interventionsList.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-2xl bg-brand-green p-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading text-sm font-bold tracking-tight text-white">
                    {item.type || "Intervention"}
                  </span>
                  <div className="relative">
                    <select
                      value={item.status ?? "Pending"}
                      onChange={(e) =>
                        handleStatusChange(item.id, e.target.value)
                      }
                      className="flex appearance-none items-center gap-1 rounded-full bg-brand-orange px-2.5 py-1 pr-7 text-[11px] font-bold text-white"
                    >
                      {INTERVENTION_STATUS_VALUES.map((s) => (
                        <option key={s} value={s} className="bg-white text-slate-900">
                          {s}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/70" />
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-white/70">
                  Requested At {formatDate(item.requested_at)}
                </p>
                <p className="text-xs text-white/70">
                  Notes: {item.notes || "—"}
                </p>
              </div>
            ))
          )}
        </PageContent>
      </div>

      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Database
          </h1>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Add entry
            <span className="text-lg leading-none">+</span>
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-border">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search"
                className="h-9 w-full rounded-full bg-brand-cream px-4 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-1 rounded-full bg-brand-cream px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-border"
            >
              Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowSort(true)}
              className="flex items-center gap-1 rounded-full bg-brand-cream px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-border"
            >
              Sort by
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <section className="mt-4 overflow-hidden rounded-2xl bg-brand-green p-5 ring-1 ring-brand-green">
          <div className="flex gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <ImagePlaceholderIcon className="h-9 w-9 text-white/50" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-xl font-bold tracking-tight text-white">
                  {cat?.name || "Unnamed"}
                </h2>
                {sexSymbol(cat?.sex) ? (
                  <span className="text-xl font-semibold text-white/70">
                    {sexSymbol(cat?.sex)}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {cat?.color ? (
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                    {cat.color}
                  </span>
                ) : null}
                {cat?.age ? (
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                    {cat.age}
                  </span>
                ) : null}
              </div>

              <p className="mt-3 text-sm text-white/70">
                Last seen: {cat?.spot_last_seen || "—"} &middot;{" "}
                {formatDate(cat?.last_updated_at)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <TopTabs active="Interventions" />
            <div className="ml-4 flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white">
              <span>Adoptable</span>
              <span
                className={`relative inline-flex h-4 w-7 items-center rounded-full ${cat?.is_adoptable ? "bg-brand-orange" : "bg-white/30"}`}
              >
                <span
                  className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${cat?.is_adoptable ? "translate-x-3.5" : "translate-x-0.5"}`}
                />
              </span>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setShowSort(true)}
              className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Sort by <span className="ml-1">&#9662;</span>
            </button>
            <button
              type="button"
              onClick={() => setShowIntervention(true)}
              className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Create New <span className="ml-1">+</span>
            </button>
          </div>

          <div className="mt-3 divide-y divide-white/10 border-t border-white/10">
            {filteredInterventions.length === 0 ? (
              <div className="py-8 text-center text-sm text-white/50">
                No interventions yet.
              </div>
            ) : (
              filteredInterventions.map((item) => (
                <div
                  key={`desktop-${item.id}`}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-heading text-base font-bold tracking-tight text-white">
                      {item.type || "Intervention"}
                    </p>
                    <p className="mt-0.5 text-sm text-white/70">
                      Requested at {formatDate(item.requested_at)}
                    </p>
                    {item.notes ? (
                      <p className="mt-0.5 text-xs text-white/60">
                        {item.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="relative">
                    <select
                      value={item.status ?? "Pending"}
                      onChange={(e) =>
                        handleStatusChange(item.id, e.target.value)
                      }
                      className="flex h-9 min-w-36 appearance-none items-center justify-between rounded-lg bg-brand-orange px-3 pr-8 text-sm font-bold text-white"
                    >
                      {INTERVENTION_STATUS_VALUES.map((s) => (
                        <option key={s} value={s} className="bg-white text-slate-900">
                          {s}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <FiltersDialog
        open={showFilters}
        onClose={() => setShowFilters(false)}
        categories={INTERVENTIONS_CONFIG.filters}
        activeFilters={activeFilters}
        onToggle={toggleFilter}
        onClear={clearFilters}
        activeCount={activeFilterCount}
      />
      <SortByDialog
        open={showSort}
        onClose={() => setShowSort(false)}
        options={INTERVENTIONS_CONFIG.sortOptions}
        activeKey={sortKey}
        order={sortOrder}
        onSort={setSortKey}
        onOrder={setSortOrder}
      />

      <DialogShell
        open={showIntervention}
        onClose={() => setShowIntervention(false)}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-bold text-white">
            Create Intervention
          </h2>
          <button
            type="button"
            onClick={() => setShowIntervention(false)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm text-white/70 hover:bg-white/30"
            aria-label="Close"
          >
            &#10005;
          </button>
        </div>

        {error ? (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        ) : null}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-white/70">Type</label>
            <div className="relative mt-1.5 rounded-lg bg-white/15 border border-white/20">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="h-10 w-full appearance-none rounded-lg bg-white/15 px-3 pr-10 text-sm font-medium text-white"
              >
                <option value="" className="bg-white text-slate-900">&mdash;</option>
                {INTERVENTION_TYPE_VALUES.map((t) => (
                  <option key={t} value={t} className="bg-white text-slate-900">
                    {t}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/50">
                &#9660;
              </span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-white/70">Notes</label>
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="mt-1.5 h-16 w-full resize-none rounded-lg bg-white/15 border border-white/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/50"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowIntervention(false)}
            className="rounded-full border-2 border-white px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white hover:text-brand-green"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={creating}
            onClick={handleCreate}
            className="rounded-full bg-brand-orange px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </DialogShell>
    </>
  );
}
