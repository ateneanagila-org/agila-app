"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  TrashIcon,
} from "@/components/app-pages/shared/icons";
import {
  SessionFiltersDialog,
  SessionSortByDialog,
  CreateSessionDialog,
  DeleteSessionDialog,
} from "@/components/app-pages/sessions/session-dialogs";
import {
  getSessions,
  getSessionCats,
  getSessionUsers,
  createSession,
  removeSession,
} from "@/app/actions/sessions";
import { getCats } from "@/app/actions/cats";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import type { SelectSession } from "@/lib/validation/sessions";
import { useFilterSort } from "@/lib/hooks/use-filter-sort";
import { SESSIONS_CONFIG } from "@/lib/hooks/filter-sort-configs";

const PAGE_SIZE = 10;

const CENSUS_REPORT_URL = "#"; // TODO: replace with actual Google Docs folder URL

type SessionStatus = "Unfinished" | "Submitted" | "Reviewed";

export function SessionsScreen() {
  const { canManage, userData } = useAuth();
  const userId = userData?.supabaseUser?.id;
  const router = useRouter();
  const [sessions, setSessions] = useState<SelectSession[]>([]);
  const [allSessions, setAllSessions] = useState<SelectSession[]>([]);
  const [statusBySession, setStatusBySession] = useState<
    Record<string, SessionStatus>
  >({});
  const [unreviewedCatCount, setUnreviewedCatCount] = useState(0);
  const [regionMap, setRegionMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const [showMoreLocations, setShowMoreLocations] = useState(false);
  const [desktopPage, setDesktopPage] = useState(1);

  // Create session dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSessionRegionId, setNewSessionRegionId] = useState("");
  const [creatingSession, setCreatingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regionOptions, setRegionOptions] = useState<{ id: string; name: string }[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRegions = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from("regions").select("id,name");
      if (!data) return;

      const map: Record<string, string> = {};
      const options: { id: string; name: string }[] = [];
      for (const row of data) {
        if (row?.id && row?.name) {
          map[row.id] = row.name;
          options.push({ id: row.id, name: row.name });
        }
      }
      setRegionMap(map);
      setRegionOptions(options);
    } catch (err) {
      console.error("Failed to fetch regions:", err);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // 1. Sessions linked to current user via session_users
      const linkRes = await getSessionUsers({ user_id: userId });
      const myIds = new Set(
        (linkRes?.data ?? []).map((su) => su.session_id),
      );
      if (myIds.size === 0) {
        setSessions([]);
        setAllSessions([]);
        setStatusBySession({});
        setUnreviewedCatCount(0);
        return;
      }

      // 2. All non-system sessions, filter to mine
      const sessionsRes = await getSessions({});
      const all = sessionsRes?.data ?? [];
      setAllSessions(all);
      const mine = all.filter((s) => myIds.has(s.id));
      setSessions(mine);

      // 3. Derive status per session via session_cats + cats.entry_status
      const [scRes, unreviewedRes] = await Promise.all([
        getSessionCats({}),
        getCats({ entry_status: "Unreviewed" }),
      ]);
      const unreviewedIds = new Set(
        (unreviewedRes?.data ?? []).map((c) => c.id),
      );
      setUnreviewedCatCount(unreviewedIds.size);

      const catIdsBySession = new Map<string, string[]>();
      for (const sc of scRes?.data ?? []) {
        const list = catIdsBySession.get(sc.session_id) ?? [];
        list.push(sc.cat_id);
        catIdsBySession.set(sc.session_id, list);
      }

      const statusMap: Record<string, SessionStatus> = {};
      const countMap: Record<string, number> = {};
      for (const s of mine) {
        const catIds = catIdsBySession.get(s.id) ?? [];
        countMap[s.id] = catIds.length;
        if (!s.is_finished) {
          statusMap[s.id] = "Unfinished";
          continue;
        }
        const hasUnreviewed = catIds.some((id) => unreviewedIds.has(id));
        statusMap[s.id] = hasUnreviewed ? "Submitted" : "Reviewed";
      }
      setStatusBySession(statusMap);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

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

  const sessionStatus = (s: SelectSession): SessionStatus =>
    statusBySession[s.id] ?? (s.is_finished ? "Submitted" : "Unfinished");

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
    let reviewed = 0;
    let submitted = 0;
    let unfinished = 0;
    for (const s of sessions) {
      const st = statusBySession[s.id] ?? (s.is_finished ? "Submitted" : "Unfinished");
      if (st === "Reviewed") reviewed += 1;
      else if (st === "Submitted") submitted += 1;
      else unfinished += 1;
    }
    return [
      { label: "Reviewed", value: String(reviewed) },
      { label: "Submitted", value: String(submitted) },
      { label: "Unfinished", value: String(unfinished) },
      { label: "For Review", value: String(unreviewedCatCount) },
    ];
  }, [sessions, statusBySession, unreviewedCatCount]);

  /** Compute priority locations — every region, sorted by days since last session (global).
   *  Regions with no session show "Unknown" days. */
  const priorityLocations = useMemo(() => {
    const regionLastSession = new Map<string, number>();
    for (const s of allSessions) {
      const rid = s.region_id;
      const date = new Date(s.created_at).getTime();
      const existing = regionLastSession.get(rid);
      if (!existing || date > existing) {
        regionLastSession.set(rid, date);
      }
    }

    const now = Date.now();
    const entries = Object.entries(regionMap).map(([regionId, name]) => {
      const lastSeen = regionLastSession.get(regionId);
      const daysSince =
        lastSeen != null
          ? Math.max(0, Math.floor((now - lastSeen) / 86400000))
          : null;
      return { name, daysSince };
    });

    return entries
      .sort((a, b) => {
        // Unknown (null) → highest priority (sort first)
        if (a.daysSince == null && b.daysSince == null) return 0;
        if (a.daysSince == null) return -1;
        if (b.daysSince == null) return 1;
        return b.daysSince - a.daysSince;
      })
      .map((entry) => ({
        name: entry.name,
        daysSince: entry.daysSince == null ? "Unknown" : String(entry.daysSince),
      }));
  }, [allSessions, regionMap]);

  const handleCreateSession = useCallback(async () => {
    if (!newSessionRegionId || !userId) return;
    setCreatingSession(true);
    try {
      const result = await createSession({ region_id: newSessionRegionId, user_id: userId });
      if (result?.serverError) { setError(result.serverError); return; }
      const newSession = result?.data;
      if (!newSession?.id) return;
      setShowCreateDialog(false);
      setNewSessionRegionId("");
      router.push(`/dashboard/sessions/create?sessionId=${newSession.id}`);
    } finally {
      setCreatingSession(false);
    }
  }, [newSessionRegionId, userId, router]);

  const handleDeleteSession = useCallback(async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await removeSession.bind(null, pendingDeleteId)();
      setSessions((prev) => prev.filter((s) => s.id !== pendingDeleteId));
      setPendingDeleteId(null);
    } catch (err) {
      console.error("Failed to delete session:", err);
    } finally {
      setDeleting(false);
    }
  }, [pendingDeleteId]);

  // Reset desktop page when filters change to avoid empty table state
  useEffect(() => { setDesktopPage(1); }, [filteredSessions]);

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
              <a
                href={CENSUS_REPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-dark py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Census Report
              </a>
              {canManage ? (
                <Link
                  href="/dashboard/sessions/manager"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-dark py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                >
                  Review Sessions ⊙
                </Link>
              ) : null}
            </div>

            {/* My Sessions heading + Create New */}
            <div className="flex items-center justify-between">
              <p className="font-heading text-2xl font-bold text-brand-green">My Sessions</p>
              <button
                type="button"
                onClick={() => setShowCreateDialog(true)}
                className="flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Create New <span>+</span>
              </button>
            </div>
            {/* Pink separator */}
            <div className="h-px bg-pink-200" />

            {/* Search / Filter / Sort pills */}
            <div className="flex flex-wrap gap-2">
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
            <div className="overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-brand-dark/8">
              {/* Table header */}
              <div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-x-3 border-b border-brand-dark/10 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">No.</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">Date</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">Location</span>
                <span />
                <span />
              </div>

              {loading ? (
                <LoadingIndicator />
              ) : filteredSessions.length === 0 ? (
                <div className="py-6 text-center text-xs text-brand-dark/50">No sessions found.</div>
              ) : (
                <div className="divide-y divide-brand-dark/8">
                  {filteredSessions
                    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                    .map((s, i) => (
                      <div key={s.id} className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-x-3 py-2.5">
                        <span className="text-xs font-semibold tabular-nums text-brand-dark">
                          {(page - 1) * PAGE_SIZE + i + 1}
                        </span>
                        <span className="text-xs tabular-nums text-brand-dark/70">
                          {formatDate(s.created_at)}
                        </span>
                        <span className="truncate text-xs text-brand-dark/70">
                          {regionMap[s.region_id] ?? "—"}
                        </span>
                        {sessionStatus(s) === "Unfinished" ? (
                          <Link
                            href={`/dashboard/sessions/create?sessionId=${s.id}`}
                            className="rounded-full bg-brand-orange px-2.5 py-0.5 text-[10px] font-bold text-white"
                          >
                            Continue ›
                          </Link>
                        ) : (
                          <span />
                        )}
                        {sessionStatus(s) === "Unfinished" ? (
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(s.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-brand-dark/40 transition-colors hover:bg-red-50 hover:text-red-500"
                            aria-label="Delete session"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span />
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
              <a
                href={CENSUS_REPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-dark py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                Census Report
              </a>
              {canManage ? (
                <Link
                  href="/dashboard/sessions/manager"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-dark py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
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
              <button
                type="button"
                onClick={() => setShowCreateDialog(true)}
                className="flex items-center gap-1.5 rounded-full bg-brand-orange px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                Create New <span className="text-sm">+</span>
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-brand-dark/8">
              <div className="space-y-2.5">
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 border-b border-brand-dark/10 pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">No.</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">Location</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">Date</span>
                  <span />
                  <span />
                </div>

                {loading ? (
                  <LoadingIndicator />
                ) : sessions.length === 0 ? (
                  <div className="py-4 text-center text-xs text-brand-dark/50">No sessions yet.</div>
                ) : (
                  <div className="divide-y divide-brand-dark/8">
                    {sessions.slice(0, 5).map((s) => (
                      <div key={s.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-3 py-2">
                        <span className="text-xs font-semibold tabular-nums text-brand-dark">
                          {s.id.slice(0, 5)}
                        </span>
                        <span className="truncate text-xs text-brand-dark/70">
                          {regionMap[s.region_id] ?? "—"}
                        </span>
                        <span className="text-xs tabular-nums text-brand-dark/70">
                          {formatDate(s.created_at)}
                        </span>
                        {sessionStatus(s) === "Unfinished" ? (
                          <Link
                            href={`/dashboard/sessions/create?sessionId=${s.id}`}
                            className="rounded-full bg-brand-orange px-2 py-0.5 text-[10px] font-bold text-white"
                          >
                            Continue ›
                          </Link>
                        ) : (
                          <span />
                        )}
                        {sessionStatus(s) === "Unfinished" ? (
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(s.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-brand-dark/40 transition-colors hover:bg-red-50 hover:text-red-500"
                            aria-label="Delete session"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span />
                        )}
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
            <div className="overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-brand-dark/8">
              <div className="space-y-2.5">
                <div className="flex justify-between border-b border-brand-dark/10 pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">Name</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">Last Tracked</span>
                </div>

                <div className="divide-y divide-brand-dark/8">
                  {(showMoreLocations ? priorityLocations : priorityLocations.slice(0, 5)).map((loc) => (
                    <div key={loc.name} className="flex items-center justify-between py-2">
                      <span className="text-xs font-semibold text-brand-dark">{loc.name}</span>
                      <span className="text-xs tabular-nums italic text-brand-dark/65">
                        {loc.daysSince === "Unknown" ? "Unknown" : `${loc.daysSince} days ago`}
                      </span>
                    </div>
                  ))}
                </div>
                {priorityLocations.length > 5 ? (
                  <button
                    type="button"
                    onClick={() => setShowMoreLocations((s) => !s)}
                    className="pt-1 text-xs font-bold text-brand-green underline underline-offset-2"
                  >
                    {showMoreLocations ? "Show less" : "More"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}

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
            <a
              href={CENSUS_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-brand-dark px-4 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Census Report
            </a>
            {canManage ? (
              <Link
                href="/dashboard/sessions/manager"
                className="rounded-full bg-brand-dark px-4 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                Review Sessions ⊙
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
            <h2 className="font-heading text-lg font-bold text-brand-green">
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
              <button
                type="button"
                onClick={() => setShowCreateDialog(true)}
                className="flex items-center gap-1 rounded-full bg-brand-orange px-3.5 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
              >
                Create New <span>+</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto_2rem] gap-x-3 border-b border-border bg-brand-cream px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-brand-dark/60">
            <span>Census No.</span>
            <span>Date</span>
            <span>Location</span>
            <span>Status</span>
            <span />
            <span />
          </div>

          {loading ? (
            <LoadingIndicator />
          ) : sessions.length === 0 ? (
            <div className="py-10 text-center text-sm text-brand-dark/50">
              No sessions yet.
            </div>
          ) : showAll ? (
            <>
              {filteredSessions.length === 0 ? (
                <div className="py-10 text-center text-sm text-brand-dark/50">
                  No sessions match the current filters.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredSessions
                    .slice((desktopPage - 1) * PAGE_SIZE, desktopPage * PAGE_SIZE)
                    .map((s) => {
                      const st = sessionStatus(s);
                      const badgeClass =
                        st === "Reviewed"
                          ? "bg-brand-mint text-brand-green"
                          : st === "Submitted"
                            ? "bg-brand-cream-dark text-brand-dark"
                            : "bg-brand-pink text-brand-orange";
                      return (
                        <div
                          key={s.id}
                          className="grid grid-cols-[1fr_1fr_1fr_auto_auto_2rem] items-center gap-x-3 px-5 py-3 text-sm text-brand-dark"
                        >
                          <span className="font-semibold tabular-nums">{s.id.slice(0, 5)}</span>
                          <span className="tabular-nums text-brand-dark/70">{formatDate(s.created_at)}</span>
                          <span className="truncate text-brand-dark/70">{regionMap[s.region_id] ?? s.region_id.slice(0, 5)}</span>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badgeClass}`}>
                            {st}
                          </span>
                          {st === "Unfinished" ? (
                            <Link
                              href={`/dashboard/sessions/create?sessionId=${s.id}`}
                              className="inline-flex items-center rounded-full bg-brand-orange px-3 py-1 text-xs font-bold text-white transition-opacity hover:opacity-90"
                            >
                              Continue <span className="ml-0.5">&#8250;</span>
                            </Link>
                          ) : (
                            <span />
                          )}
                          {st === "Unfinished" ? (
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(s.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-full text-brand-dark/40 transition-colors hover:bg-red-50 hover:text-red-500"
                              aria-label="Delete session"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          ) : (
                            <span />
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <button
                  type="button"
                  onClick={() => setShowAll(false)}
                  className="text-sm font-bold text-brand-green underline underline-offset-2"
                >
                  Show less sessions
                </button>
                {filteredSessions.length > PAGE_SIZE ? (
                  <div className="flex items-center gap-1 text-xs font-semibold text-brand-dark/70">
                    <button
                      type="button"
                      onClick={() => setDesktopPage((p) => Math.max(1, p - 1))}
                      disabled={desktopPage === 1}
                      className="disabled:opacity-40"
                    >
                      ‹
                    </button>
                    <span className="mx-1 tabular-nums">
                      {(desktopPage - 1) * PAGE_SIZE + 1}–{Math.min(desktopPage * PAGE_SIZE, filteredSessions.length)} / {filteredSessions.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDesktopPage((p) => Math.min(Math.ceil(filteredSessions.length / PAGE_SIZE), p + 1))}
                      disabled={desktopPage >= Math.ceil(filteredSessions.length / PAGE_SIZE)}
                      className="disabled:opacity-40"
                    >
                      ›
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="divide-y divide-border">
                {sessions.slice(0, 5).map((s) => {
                  const st = sessionStatus(s);
                  const badgeClass =
                    st === "Reviewed"
                      ? "bg-brand-mint text-brand-green"
                      : st === "Submitted"
                        ? "bg-brand-cream-dark text-brand-dark"
                        : "bg-brand-pink text-brand-orange";
                  return (
                    <div
                      key={s.id}
                      className="grid grid-cols-[1fr_1fr_1fr_auto_auto_2rem] items-center gap-x-3 px-5 py-3 text-sm text-brand-dark"
                    >
                      <span className="font-semibold tabular-nums">{s.id.slice(0, 5)}</span>
                      <span className="tabular-nums text-brand-dark/70">{formatDate(s.created_at)}</span>
                      <span className="truncate text-brand-dark/70">{regionMap[s.region_id] ?? s.region_id.slice(0, 5)}</span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badgeClass}`}>
                        {st}
                      </span>
                      {st === "Unfinished" ? (
                        <Link
                          href={`/dashboard/sessions/create?sessionId=${s.id}`}
                          className="inline-flex items-center rounded-full bg-brand-orange px-3 py-1 text-xs font-bold text-white transition-opacity hover:opacity-90"
                        >
                          Continue <span className="ml-0.5">&#8250;</span>
                        </Link>
                      ) : (
                        <span />
                      )}
                      {st === "Unfinished" ? (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(s.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-brand-dark/40 transition-colors hover:bg-red-50 hover:text-red-500"
                          aria-label="Delete session"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border px-5 py-3">
                <button
                  type="button"
                  onClick={() => { setShowAll(true); setDesktopPage(1); }}
                  className="text-sm font-bold text-brand-green underline underline-offset-2"
                >
                  Show all sessions
                </button>
              </div>
            </>
          )}
        </section>

        <h2 className="mt-7 font-heading text-lg font-bold text-brand-green">
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
              <>
                {(showMoreLocations ? priorityLocations : priorityLocations.slice(0, 5)).map((loc) => (
                  <div
                    key={`priority-${loc.name}`}
                    className="grid grid-cols-2 px-5 py-3 text-sm text-brand-dark"
                  >
                    <span className="font-semibold">{loc.name}</span>
                    <span className="tabular-nums text-brand-dark/70">
                      {loc.daysSince === "Unknown" ? "Unknown" : `${loc.daysSince} days ago`}
                    </span>
                  </div>
                ))}
                {priorityLocations.length > 5 ? (
                  <div className="px-5 py-2">
                    <button
                      type="button"
                      onClick={() => setShowMoreLocations((s) => !s)}
                      className="pt-1 text-xs font-bold text-brand-green underline underline-offset-2"
                    >
                      {showMoreLocations ? "Show less" : "More"}
                    </button>
                  </div>
                ) : null}
              </>
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
      {error ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
        </div>
      ) : null}
      <CreateSessionDialog
        open={showCreateDialog}
        onClose={() => { setShowCreateDialog(false); setError(null); }}
        regionId={newSessionRegionId}
        onRegionChange={setNewSessionRegionId}
        regionOptions={regionOptions}
        onCreate={handleCreateSession}
        creating={creatingSession}
      />
      <DeleteSessionDialog
        open={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={handleDeleteSession}
        isLoading={deleting}
      />
    </>
  );
}
