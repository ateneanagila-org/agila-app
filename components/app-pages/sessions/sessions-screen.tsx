"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  PlusCircleIcon,
  ChevronDownIcon,
  MenuIcon,
} from "@/components/app-pages/shared/icons";
import {
  FiltersDialog,
  SortByDialog,
} from "@/components/app-pages/shared/dialogs";
import { getSessions } from "@/app/actions/sessions";
import { createClient } from "@/lib/supabase/client";
import type { SelectSession } from "@/lib/validation/sessions";
import { useFilterSort } from "@/lib/hooks/use-filter-sort";
import { SESSIONS_CONFIG } from "@/lib/hooks/filter-sort-configs";

export function SessionsScreen() {
  const [sessions, setSessions] = useState<SelectSession[]>([]);
  const [regionMap, setRegionMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  const fetchRegions = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from("regions").select("id,name");
      if (!data) return;

      const map: Record<string, string> = {};
      for (const row of data) {
        if (row?.id && row?.name) {
          map[row.id] = row.name;
        }
      }
      setRegionMap(map);
    } catch (err) {
      console.error("Failed to fetch regions:", err);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSessions({});
      if (result?.data) {
        setSessions(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "—";
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
  };

  const sessionStatus = (s: SelectSession): string => {
    if (s.is_finished) return "Reviewed";
    return "Unfinished";
  };

  const {
    filtered: filteredSessions,
    activeFilters,
    toggleFilter,
    clearFilters,
    activeFilterCount,
    sortKey,
    setSortKey,
    sortOrder,
    setSortOrder,
  } = useFilterSort<SelectSession>(
    sessions,
    SESSIONS_CONFIG,
    (session, key) => {
      if (key === "status") return sessionStatus(session);
      return null;
    },
    (session, key) => {
      if (key === "created_at") return new Date(session.created_at);
      if (key === "location") return regionMap[session.region_id] ?? "";
      return null;
    },
  );

  /** Compute summary stats from sessions */
  const summary = useMemo(() => {
    const reviewed = sessions.filter((s) => s.is_finished).length;
    const unfinished = sessions.filter((s) => !s.is_finished).length;
    return [
      { label: "Reviewed", value: String(reviewed) },
      { label: "Submitted", value: String(reviewed) },
      { label: "Unfinished", value: String(unfinished) },
      { label: "For Review", value: String(unfinished) },
    ];
  }, [sessions]);

  /** Compute priority locations — regions sorted by days since last session */
  const priorityLocations = useMemo(() => {
    const regionLastSession = new Map<string, number>();
    for (const s of sessions) {
      const rid = s.region_id;
      const date = new Date(s.created_at).getTime();
      const existing = regionLastSession.get(rid);
      if (!existing || date > existing) {
        regionLastSession.set(rid, date);
      }
    }

    const now = Date.now();
    return Array.from(regionLastSession.entries())
      .map(([regionId, lastSeen]) => ({
        name: regionMap[regionId] ?? regionId.slice(0, 8),
        daysSince: Math.max(0, Math.floor((now - lastSeen) / 86400000)),
      }))
      .sort((a, b) => b.daysSince - a.daysSince)
      .slice(0, 5)
      .map((entry) => ({
        ...entry,
        daysSince: String(entry.daysSince),
      }));
  }, [sessions, regionMap]);

  const LoadingIndicator = () => (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
    </div>
  );

  return (
    <>
      <div className="flex flex-1 flex-col tablet:hidden">
        <div className="flex-1 space-y-4 px-4 py-4">
          <div className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold tracking-tight text-slate-900">
                Recent Sessions
              </p>
              <Link
                href="/sessions/create"
                className="flex items-center gap-1.5 rounded-full bg-stone-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-stone-700"
              >
                Create New
                <PlusCircleIcon className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 border-b border-slate-100 px-1 pb-2">
              <span className="text-[11px] font-medium tracking-wide text-slate-400">
                No.
              </span>
              <span className="text-[11px] font-medium tracking-wide text-slate-400">
                Location
              </span>
              <span className="text-[11px] font-medium tracking-wide text-slate-400">
                Status
              </span>
            </div>

            {loading ? (
              <LoadingIndicator />
            ) : sessions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No sessions yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {sessions.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    className="grid grid-cols-[auto_1fr_auto] gap-x-4 px-1 py-2"
                  >
                    <span className="text-xs font-semibold tabular-nums text-slate-900">
                      {s.id.slice(0, 6)}
                    </span>
                    <span className="text-xs text-slate-600 truncate">
                      {regionMap[s.region_id] ?? s.region_id.slice(0, 8)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {sessionStatus(s)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <span className="block text-xs font-medium text-slate-500">
              See all
            </span>
          </div>

          <div className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold tracking-tight text-slate-900">
                Priority Locations
              </p>
              <ChevronDownIcon className="h-4 w-4 text-slate-700" />
            </div>

            <div className="flex justify-between border-b border-slate-100 px-1 pb-2">
              <span className="text-[11px] font-medium tracking-wide text-slate-400">
                Name
              </span>
              <span className="text-[11px] font-medium tracking-wide text-slate-400">
                Days Since Last Tracked
              </span>
            </div>

            <div className="divide-y divide-slate-50">
              {priorityLocations.map((loc) => (
                <div key={loc.name} className="flex justify-between px-1 py-2">
                  <span className="text-xs font-semibold text-slate-900">
                    {loc.name}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-slate-700">
                    {loc.daysSince}
                  </span>
                </div>
              ))}
            </div>

            <span className="block text-xs font-medium text-slate-500">
              See all
            </span>
          </div>
        </div>

        <div className="flex justify-end px-4 pb-5">
          <Link
            href="/sessions/manager"
            className="flex items-center gap-1.5 rounded-full bg-stone-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-stone-700"
          >
            Manager View
            <MenuIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="hidden min-h-full w-full bg-slate-100 p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sessions
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-white px-4 py-1.5 text-sm text-slate-700 ring-1 ring-slate-100 transition-colors hover:bg-slate-50"
            >
              Census Report <span className="ml-1">&#128202;</span>
            </button>
            <Link
              href="/sessions/manager"
              className="rounded-full bg-white px-4 py-1.5 text-sm text-slate-700 ring-1 ring-slate-100 transition-colors hover:bg-slate-50"
            >
              Review Sessions <span className="ml-1">&#9711;</span>
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-3">
          {summary.map((item) => (
            <article
              key={item.label}
              className="rounded-2xl bg-white px-4 py-4 text-center ring-1 ring-slate-100"
            >
              <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900">
                {item.value}
              </p>
              <p className="mt-1 text-sm text-slate-600">{item.label}</p>
            </article>
          ))}
        </div>

        <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-100">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowFilters(true)}
                className="flex items-center gap-1 rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
              >
                Status{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}{" "}
                <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowSort(true)}
                className="flex items-center gap-1 rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
              >
                Sort by <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <Link
              href="/sessions/create"
              className="rounded-full bg-lime-300 px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-lime-400"
            >
              Add entry <span className="ml-1">+</span>
            </Link>
          </div>

          <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-x-2 border-b border-slate-100 px-3 pb-2 text-xs font-semibold tracking-wide text-slate-500">
            <span>Census No.</span>
            <span>Date</span>
            <span>Location</span>
            <span>Status</span>
            <span className="w-20" />
          </div>

          {loading ? (
            <LoadingIndicator />
          ) : (
            <div className="divide-y divide-slate-50 px-3">
              {filteredSessions.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">
                  No sessions yet.
                </div>
              ) : (
                filteredSessions.map((s) => (
                  <div
                    key={s.id}
                    className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-center gap-x-2 py-2.5 text-sm text-slate-700"
                  >
                    <span className="font-medium tabular-nums">
                      {s.id.slice(0, 8)}
                    </span>
                    <span className="tabular-nums">
                      {formatDate(s.created_at)}
                    </span>
                    <span className="truncate">
                      {regionMap[s.region_id] ?? s.region_id.slice(0, 8)}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        s.is_finished
                          ? "bg-green-50 text-green-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {sessionStatus(s)}
                    </span>
                    <span className="w-20 text-right">
                      {!s.is_finished ? (
                        <Link
                          href={`/sessions/create?sessionId=${s.id}`}
                          className="inline-flex items-center rounded-lg border border-lime-300 px-3 py-1 text-xs font-medium transition-colors hover:bg-lime-50"
                        >
                          Continue <span className="ml-1">&#8250;</span>
                        </Link>
                      ) : null}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        <h2 className="mt-6 text-xl font-bold tracking-tight text-slate-900">
          Priority List
        </h2>

        <section className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-slate-100">
          <div className="grid grid-cols-2 border-b border-slate-100 px-3 pb-2 text-xs font-semibold tracking-wide text-slate-500">
            <span>Tracked Locations</span>
            <span>Days Since Last Census</span>
          </div>
          <div className="divide-y divide-slate-50 px-3">
            {priorityLocations.map((loc) => (
              <div
                key={`priority-${loc.name}`}
                className="grid grid-cols-2 py-2.5 text-sm text-slate-700"
              >
                <span className="font-medium">{loc.name}</span>
                <span className="tabular-nums">{loc.daysSince}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <FiltersDialog
        open={showFilters}
        onClose={() => setShowFilters(false)}
        categories={SESSIONS_CONFIG.filters}
        activeFilters={activeFilters}
        onToggle={toggleFilter}
        onClear={clearFilters}
        activeCount={activeFilterCount}
      />
      <SortByDialog
        open={showSort}
        onClose={() => setShowSort(false)}
        options={SESSIONS_CONFIG.sortOptions}
        activeKey={sortKey}
        order={sortOrder}
        onSort={setSortKey}
        onOrder={setSortOrder}
      />
    </>
  );
}
