"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ChevronDownIcon,
} from "@/components/app-pages/shared/icons";
import {
  SessionFiltersDialog,
  SessionSortByDialog,
} from "@/components/app-pages/sessions/session-dialogs";
import { getSessions } from "@/app/actions/sessions";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import type { SelectSession } from "@/lib/validation/sessions";
import { useFilterSort } from "@/lib/hooks/use-filter-sort";
import { SESSIONS_CONFIG } from "@/lib/hooks/filter-sort-configs";

const PAGE_SIZE = 10;

export function SessionsScreen() {
  const { canManage } = useAuth();
  const [sessions, setSessions] = useState<SelectSession[]>([]);
  const [regionMap, setRegionMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);

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
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
    </div>
  );

  return (
    <>
      <div className="flex flex-1 flex-col tablet:hidden">
        {showAll ? (
          /* ── See All Sessions view ── */
          <div className="flex-1 space-y-3 px-4 py-4">
            {/* Top action buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-brand-green py-2.5 text-sm font-bold text-brand-green transition-opacity hover:opacity-80"
              >
                Census Report
              </button>
              {canManage ? (
                <Link
                  href="/dashboard/sessions/manager"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-orange py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                >
                  Review Sessions ⊙
                </Link>
              ) : null}
            </div>

            {/* My Sessions heading + Create New */}
            <div className="flex items-center justify-between">
              <p className="font-heading text-2xl font-bold text-brand-green">My Sessions</p>
              <Link
                href="/dashboard/sessions/create"
                className="flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Create New <span>+</span>
              </Link>
            </div>
            {/* Pink separator */}
            <div className="h-px bg-pink-200" />

            {/* Search / Filter / Sort pills */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Search <span className="text-base">🔍</span>
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(true)}
                className="flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Filter <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowSort(true)}
                className="flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Sort By <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Full sessions table */}
            <div className="overflow-hidden rounded-2xl bg-brand-green p-4">
              {/* Table header */}
              <div className="grid grid-cols-[auto_auto_1fr_auto] gap-x-3 border-b border-white/20 pb-2">
                <span className="text-xs font-bold text-brand-yellow">No.</span>
                <span className="text-xs font-bold text-brand-yellow">Date</span>
                <span className="text-xs font-bold text-brand-yellow">Location</span>
                <span className="text-xs font-bold text-brand-yellow">Status</span>
              </div>

              {loading ? (
                <LoadingIndicator />
              ) : filteredSessions.length === 0 ? (
                <div className="py-6 text-center text-xs text-white/50">No sessions found.</div>
              ) : (
                <div className="divide-y divide-white/10">
                  {filteredSessions
                    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                    .map((s, i) => (
                      <div key={s.id} className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-3 py-2.5">
                        <span className="text-xs font-semibold tabular-nums text-white">
                          {(page - 1) * PAGE_SIZE + i + 1}
                        </span>
                        <span className="text-xs tabular-nums text-white">
                          {formatDate(s.created_at)}
                        </span>
                        <span className="truncate text-xs text-white">
                          {regionMap[s.region_id] ?? "—"}
                        </span>
                        {/* Status badge */}
                        {!s.is_finished ? (
                          <Link
                            href={`/dashboard/sessions/create?sessionId=${s.id}`}
                            className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-brand-orange"
                          >
                            Continue ›
                          </Link>
                        ) : (
                          <span className="rounded-full border border-white/40 px-2.5 py-0.5 text-[10px] font-semibold text-white/80">
                            Reviewed
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Pagination row */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className="text-sm font-bold text-brand-green underline underline-offset-2"
              >
                Show less sessions
              </button>
              {filteredSessions.length > PAGE_SIZE ? (
                <div className="flex items-center gap-1 rounded-full border border-pink-200 bg-brand-pink/20 px-4 py-2 text-xs font-semibold text-brand-orange">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="disabled:opacity-40"
                  >
                    ‹
                  </button>
                  <span className="mx-1 tabular-nums">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredSessions.length)} / {filteredSessions.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(Math.ceil(filteredSessions.length / PAGE_SIZE), p + 1))}
                    disabled={page >= Math.ceil(filteredSessions.length / PAGE_SIZE)}
                    className="disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          /* ── Dashboard view ── */
          <div className="flex-1 space-y-3 px-4 py-4">
            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-green py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                Census Report
              </button>
              {canManage ? (
                <Link
                  href="/dashboard/sessions/manager"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-orange py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  Review Sessions
                </Link>
              ) : null}
            </div>

            {/* Recent Sessions */}
            <div className="flex items-center justify-between">
              <p className="font-heading text-xl font-bold text-brand-green">
                Recent Sessions
              </p>
              <Link
                href="/dashboard/sessions/create"
                className="flex items-center gap-1.5 rounded-full bg-brand-orange px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                Create New <span className="text-sm">+</span>
              </Link>
            </div>
            <div className="overflow-hidden rounded-2xl bg-brand-green p-4">
              <div className="space-y-2.5">
                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 border-b border-white/20 pb-2">
                  <span className="text-[11px] font-bold tracking-wide text-brand-yellow">No.</span>
                  <span className="text-[11px] font-bold tracking-wide text-brand-yellow">Location</span>
                  <span className="text-[11px] font-bold tracking-wide text-brand-yellow">Date</span>
                  <span className="text-[11px] font-bold tracking-wide text-brand-yellow">Status</span>
                </div>

                {loading ? (
                  <LoadingIndicator />
                ) : sessions.length === 0 ? (
                  <div className="py-4 text-center text-xs text-white/50">No sessions yet.</div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {sessions.slice(0, 5).map((s) => (
                      <div key={s.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 py-2">
                        <span className="text-xs font-semibold tabular-nums text-white">
                          {s.id.slice(0, 5)}
                        </span>
                        <span className="truncate text-xs text-white">
                          {regionMap[s.region_id] ?? "—"}
                        </span>
                        <span className="text-xs tabular-nums text-white">
                          {formatDate(s.created_at)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            s.is_finished
                              ? "bg-white/10 text-white"
                              : "bg-white text-brand-orange"
                          }`}
                        >
                          {s.is_finished ? "Reviewed" : "Continue ›"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { setShowAll(true); setPage(1); }}
                  className="text-xs font-bold text-brand-green underline underline-offset-2"
                >
                  Show all sessions
                </button>
              </div>
            </div>

            {/* Priority Locations */}
            <p className="font-heading text-xl font-bold text-brand-green">
              Priority Locations
            </p>
            <div className="overflow-hidden rounded-2xl bg-brand-green p-4">
              <div className="space-y-2.5">
                <div className="flex justify-between border-b border-white/20 pb-2">
                  <span className="text-[11px] font-bold tracking-wide text-brand-yellow">Name</span>
                  <span className="text-[11px] font-bold tracking-wide text-brand-yellow">Last Tracked</span>
                </div>

                <div className="divide-y divide-white/10">
                  {priorityLocations.map((loc) => (
                    <div key={loc.name} className="flex items-center justify-between py-2">
                      <span className="text-xs font-semibold text-white">{loc.name}</span>
                      <span className="text-xs tabular-nums text-white italic">{loc.daysSince} days ago</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FAB */}
        <div className="pointer-events-none fixed bottom-20 right-4 z-10">
          <Link
            href="/dashboard/sessions/create"
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange shadow-lg transition-opacity hover:opacity-90"
          >
            <span className="text-2xl font-bold leading-none text-white">+</span>
          </Link>
        </div>
      </div>

      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-brand-dark">
              Sessions
            </h1>
            <p className="mt-1 text-xs font-semibold text-brand-green">
              {sessions.length} total &middot; {summary[2].value} unfinished
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-brand-green bg-white px-4 py-2 text-sm font-bold text-brand-green transition-colors hover:bg-brand-mint"
            >
              Census Report
            </button>
            {canManage ? (
              <Link
                href="/dashboard/sessions/manager"
                className="rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                Review Sessions
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-3">
          {summary.map((item) => (
            <article
              key={item.label}
              className="rounded-2xl bg-brand-green px-5 py-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-yellow">
                {item.label}
              </p>
              <p className="mt-1 font-heading text-4xl font-bold leading-none tabular-nums text-white">
                {item.value}
              </p>
            </article>
          ))}
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl bg-white ring-1 ring-border">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="font-heading text-lg font-bold text-brand-dark">
              My Sessions
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowFilters(true)}
                className="flex items-center gap-1 rounded-full bg-brand-cream-dark px-3.5 py-1.5 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-mint"
              >
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}{" "}
                <ChevronDownIcon className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setShowSort(true)}
                className="flex items-center gap-1 rounded-full bg-brand-cream-dark px-3.5 py-1.5 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-mint"
              >
                Sort by <ChevronDownIcon className="h-3 w-3" />
              </button>
              <Link
                href="/dashboard/sessions/create"
                className="flex items-center gap-1 rounded-full bg-brand-orange px-3.5 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
              >
                Create New <span>+</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_1fr_1fr_auto_7rem] gap-x-3 border-b border-border bg-brand-cream px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-brand-dark/60">
            <span>Census No.</span>
            <span>Date</span>
            <span>Location</span>
            <span>Status</span>
            <span />
          </div>

          {loading ? (
            <LoadingIndicator />
          ) : filteredSessions.length === 0 ? (
            <div className="py-10 text-center text-sm text-brand-dark/50">
              No sessions yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredSessions.map((s) => (
                <div
                  key={s.id}
                  className="grid grid-cols-[1fr_1fr_1fr_auto_7rem] items-center gap-x-3 px-5 py-3 text-sm text-brand-dark"
                >
                  <span className="font-semibold tabular-nums">
                    {s.id.slice(0, 8)}
                  </span>
                  <span className="tabular-nums text-brand-dark/70">
                    {formatDate(s.created_at)}
                  </span>
                  <span className="truncate text-brand-dark/70">
                    {regionMap[s.region_id] ?? s.region_id.slice(0, 8)}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      s.is_finished
                        ? "bg-brand-mint text-brand-green"
                        : "bg-brand-pink text-brand-orange"
                    }`}
                  >
                    {sessionStatus(s)}
                  </span>
                  <span className="text-right">
                    {!s.is_finished ? (
                      <Link
                        href={`/dashboard/sessions/create?sessionId=${s.id}`}
                        className="inline-flex items-center rounded-full bg-brand-orange px-3 py-1 text-xs font-bold text-white transition-opacity hover:opacity-90"
                      >
                        Continue <span className="ml-0.5">&#8250;</span>
                      </Link>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <h2 className="mt-7 font-heading text-lg font-bold text-brand-dark">
          Priority Locations
        </h2>
        <p className="mt-0.5 text-xs text-brand-dark/60">
          Regions ranked by days since last census
        </p>

        <section className="mt-3 overflow-hidden rounded-2xl bg-white ring-1 ring-border">
          <div className="grid grid-cols-2 border-b border-border bg-brand-cream px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-brand-dark/60">
            <span>Location</span>
            <span>Days Since Last Census</span>
          </div>
          <div className="divide-y divide-border">
            {priorityLocations.length === 0 ? (
              <div className="py-8 text-center text-sm text-brand-dark/50">
                No data yet.
              </div>
            ) : (
              priorityLocations.map((loc) => (
                <div
                  key={`priority-${loc.name}`}
                  className="grid grid-cols-2 px-5 py-3 text-sm text-brand-dark"
                >
                  <span className="font-semibold">{loc.name}</span>
                  <span className="tabular-nums text-brand-dark/70">
                    {loc.daysSince} days
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <SessionFiltersDialog
        open={showFilters}
        onClose={() => setShowFilters(false)}
        categories={SESSIONS_CONFIG.filters}
        activeFilters={activeFilters}
        onToggle={toggleFilter}
        onClear={clearFilters}
        activeCount={activeFilterCount}
      />
      <SessionSortByDialog
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
