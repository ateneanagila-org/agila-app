"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon, TrashIcon } from "@/components/app-pages/shared/icons";
import { CatPhoto } from "@/components/app-pages/shared/cat-photo";
import { positionFromCat } from "@/lib/photo-position";
import { CatEntryForm } from "@/components/app-pages/shared/cat-entry-form";
import {
  DeleteSessionDialog,
  FinishSessionDialog,
  RemoveCatDialog,
} from "@/components/app-pages/sessions/session-dialogs";
import {
  getSessionWithCats,
  editSession,
  removeSession,
  removeSessionCat,
} from "@/app/actions/sessions";
import type { SelectCat } from "@/lib/validation/cats";

type SessionCatEntry = { cat: SelectCat; sessionCatId: string };

export type CreateSessionInitialData = {
  session: {
    id: string;
    census_no: number | null;
    region_id: string;
    is_finished: boolean | null;
  };
  regionName: string | null;
  cats: SessionCatEntry[];
} | null;

type SessionsCreateScreenProps = {
  sessionId: string | null;
  initialData: CreateSessionInitialData;
};

export function SessionsCreateScreen({
  sessionId: initialSessionId,
  initialData,
}: SessionsCreateScreenProps) {
  const router = useRouter();

  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [censusNo, setCensusNo] = useState<number | null>(
    initialData?.session.census_no ?? null,
  );
  const [selectedRegionId, setSelectedRegionId] = useState(
    initialData?.session.region_id ?? "",
  );
  const [selectedRegionName, setSelectedRegionName] = useState(
    initialData?.regionName ?? "",
  );
  const [cats, setCats] = useState<SessionCatEntry[]>(initialData?.cats ?? []);
  const [removingCatId, setRemovingCatId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<SessionCatEntry | null>(
    null,
  );
  const [editingCat, setEditingCat] = useState<SelectCat | null>(null);
  // Full-screen spinner only when nothing was server-seeded.
  const [loading, setLoading] = useState(!initialData && !!initialSessionId);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Monotonic token so out-of-order reconciles can't clobber newer state. Bumped
  // on every load AND every optimistic mutation; a resolving load whose token is
  // stale is dropped (otherwise a slow reconcile from a prior action overwrites an
  // optimistic add/remove — the "cat flickers back in" bug).
  const loadSeq = useRef(0);

  /** Single-call (re)load of the whole session: session + region + cats. */
  const loadSession = useCallback(async (sid: string, showSpinner = false) => {
    const seq = ++loadSeq.current;
    if (showSpinner) setLoading(true);
    try {
      const result = await getSessionWithCats({ session_id: sid });
      if (seq !== loadSeq.current) return; // superseded by a newer load/mutation
      const data = result?.data;
      if (!data) {
        setError("Session not found.");
        return;
      }
      if (data.session.is_finished) {
        // Submitted sessions are immutable. Bounce back instead of rendering a
        // stale, editable form (covers the back-button / bfcache return path).
        window.location.replace("/dashboard/sessions");
        return;
      }
      setError(null);
      setSessionId(data.session.id);
      setCensusNo(data.session.census_no);
      setSelectedRegionId(data.session.region_id);
      setSelectedRegionName(data.regionName ?? "Unknown Location");
      setCats(data.cats as SessionCatEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  // First load only when the server did NOT seed data (e.g. soft client nav).
  useEffect(() => {
    if (initialSessionId && !initialData) {
      loadSession(initialSessionId, true);
    }
  }, [initialSessionId, initialData, loadSession]);

  // bfcache: clicking "back" can restore this screen from memory without re-running
  // the load effect, leaving a stale (possibly now-submitted) form. Re-hydrate on
  // restore so the is_finished redirect fires.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && initialSessionId) {
        loadSession(initialSessionId);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [initialSessionId, loadSession]);

  const handleDiscard = useCallback(async () => {
    if (!sessionId) {
      router.push("/dashboard/sessions");
      return;
    }
    setDiscarding(true);
    setError(null);
    try {
      const result = await removeSession.bind(null, sessionId)();
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      router.push("/dashboard/sessions");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to discard session.",
      );
    } finally {
      setDiscarding(false);
    }
  }, [sessionId, router]);

  const handleSubmitSession = useCallback(async () => {
    if (!sessionId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await editSession.bind(
        null,
        sessionId,
      )({ id: sessionId, is_finished: true });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      router.push("/dashboard/sessions");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit session.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, router]);

  // Empty sessions should not land in the manager review queue silently.
  const handleFinishClick = useCallback(() => {
    if (cats.length === 0) {
      setError("Add at least one cat before finishing the session.");
      return;
    }
    setShowFinish(true);
  }, [cats.length]);

  const handleOpenAddForm = useCallback(() => {
    if (!sessionId) {
      setError("Select a location first to create a session.");
      return;
    }
    setShowAddForm(true);
  }, [sessionId]);

  // Optimistic add: append the returned entry immediately (card shows before the
  // photo finishes uploading), then reconcile in the background to pick up the
  // canonical row (incl. photo_url). Edit/no-entry calls just reconcile.
  const handleCatSaved = useCallback(
    (added?: SessionCatEntry) => {
      if (added) {
        loadSeq.current++; // invalidate any in-flight reconcile before this insert
        setCats((prev) =>
          prev.some((c) => c.sessionCatId === added.sessionCatId)
            ? prev
            : [...prev, added],
        );
      }
      if (sessionId) loadSession(sessionId);
    },
    [sessionId, loadSession],
  );

  const handleConfirmRemove = useCallback(async () => {
    const entry = pendingRemove;
    if (!entry) return;
    setRemovingCatId(entry.sessionCatId);
    setError(null);
    // Optimistic: drop it now; restore on failure. Bump the token first so a
    // reconcile still in flight from a prior action can't re-add this row.
    loadSeq.current++;
    setCats((prev) => prev.filter((c) => c.sessionCatId !== entry.sessionCatId));
    setPendingRemove(null);
    try {
      const result = await removeSessionCat.bind(null, entry.sessionCatId)();
      if (result?.serverError) {
        // Guard rejected (e.g. session already submitted) — restore the row.
        setCats((prev) =>
          prev.some((c) => c.sessionCatId === entry.sessionCatId)
            ? prev
            : [...prev, entry],
        );
        setError(result.serverError);
        return;
      }
      // removeSessionCat already hard-deletes the now-orphaned Unsubmitted cat
      // server-side (blob + sheet row included); no extra removeCat call here.
      if (sessionId) await loadSession(sessionId);
    } catch (err) {
      setCats((prev) =>
        prev.some((c) => c.sessionCatId === entry.sessionCatId)
          ? prev
          : [...prev, entry],
      );
      setError(err instanceof Error ? err.message : "Failed to remove cat.");
    } finally {
      setRemovingCatId(null);
    }
  }, [pendingRemove, sessionId, loadSession]);

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

  return (
    <>
      <div className="flex flex-1 flex-col tablet:hidden">
        <div className="flex-1 space-y-3 px-4 py-4">
          {/* Location heading */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark/40">
              Location
            </p>
            <p className="font-heading text-xl font-bold text-brand-green">
              {selectedRegionName || "Loading…"}
            </p>
          </div>

          {/* Census No. + action buttons */}
          {sessionId ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-brand-green px-3 py-1.5 text-xs font-bold text-brand-yellow">
                Census No. {censusNo ?? "—"}
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowDiscard(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500"
                  aria-label="Delete session"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleFinishClick}
                  className="flex items-center gap-1 rounded-full bg-brand-orange px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
                >
                  Finish ›
                </button>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
            </div>
          ) : cats.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No cats yet. Tap + to add one.
            </div>
          ) : (
            <div className="space-y-2">
              {cats.map(({ cat, sessionCatId }) => (
                <div
                  key={cat.id}
                  className="overflow-hidden rounded-2xl bg-brand-green"
                >
                  <div className="flex h-24 items-stretch">
                    <button
                      type="button"
                      onClick={() => setEditingCat(cat)}
                      className="relative aspect-square h-full shrink-0 overflow-hidden bg-white/10"
                    >
                      <CatPhoto
                        photoUrl={cat.photo_url}
                        name={cat.name}
                        position={positionFromCat(cat)}
                        fit="cover"
                        className="absolute inset-0 h-full w-full"
                        iconClassName="h-10 w-10 text-white/40"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCat(cat)}
                      className="flex min-w-0 flex-1 items-start px-3.5 py-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-heading text-xl font-bold leading-tight text-brand-yellow truncate">
                          {cat.name || "Unnamed"}
                        </p>
                        <p className="mt-0.5 text-xs text-white/70 truncate">
                          {[cat.color, cat.age].filter(Boolean).join(" · ") ||
                            "—"}
                        </p>
                        <p className="mt-1 text-xs text-white/60 truncate">
                          {cat.spot_last_seen || "—"}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingRemove({ cat, sessionCatId })}
                      disabled={removingCatId === sessionCatId}
                      className="flex w-10 shrink-0 items-center justify-center bg-brand-dark/20 transition-colors hover:bg-red-500/70 disabled:opacity-40"
                      aria-label="Remove cat from session"
                    >
                      <TrashIcon className="h-4 w-4 text-white" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FAB */}
        <div className="pointer-events-none fixed bottom-20 right-4 z-10">
          <button
            type="button"
            onClick={handleOpenAddForm}
            className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange p-0 leading-none shadow-lg transition-opacity hover:opacity-90"
            aria-label="Add cat"
          >
            <PlusIcon className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>

      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Sessions
          </h1>
          <div className="flex items-center gap-2">
            {sessionId ? (
              <button
                type="button"
                onClick={() => setShowDiscard(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500"
                aria-label="Delete session"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            ) : null}
            <Link
              href="/dashboard/sessions"
              className="rounded-full bg-brand-dark px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Back <span className="ml-1">&#8249;</span>
            </Link>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground/60">
            Location:
          </span>
          <span className="font-heading text-xl font-bold text-brand-green">
            {selectedRegionName || "Loading…"}
          </span>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        ) : null}

        <section className="mt-4 overflow-hidden rounded-2xl bg-brand-green p-4 ring-1 ring-brand-green">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold tracking-tight text-white">
              Census No. {censusNo ?? "—"}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddForm}
                className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Add entry <span className="ml-1">+</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleFinishClick}
                className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit"}
                <span className="ml-1">&#8250;</span>
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="mt-4 flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
          </div>
        ) : !sessionId ? (
          <div className="mt-4 rounded-2xl bg-white p-8 text-center text-sm text-muted-foreground ring-1 ring-border">
            Select a location to start a session.
          </div>
        ) : cats.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-white p-8 text-center text-sm text-muted-foreground ring-1 ring-border">
            No cats in this session yet. Click &quot;Add entry&quot; to begin.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {cats.map(({ cat, sessionCatId }) => (
              <article
                key={`entry-${cat.id}`}
                className="overflow-hidden rounded-2xl bg-brand-green ring-1 ring-brand-green"
              >
                <div className="flex h-24 items-stretch">
                  <button
                    type="button"
                    onClick={() => setEditingCat(cat)}
                    className="relative aspect-square h-full shrink-0 overflow-hidden bg-white/10"
                  >
                    <CatPhoto
                      photoUrl={cat.photo_url}
                      name={cat.name}
                      position={positionFromCat(cat)}
                      fit="cover"
                      className="absolute inset-0 h-full w-full"
                      iconClassName="h-10 w-10 text-white/40"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCat(cat)}
                    className="flex min-w-0 flex-1 items-start px-4 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-heading text-xl font-bold leading-tight text-brand-yellow truncate">
                          {cat.name || "Unnamed"}
                        </p>
                        {sexSymbol(cat.sex) ? (
                          <span className={`text-xl ${sexColor(cat.sex)}`}>
                            {sexSymbol(cat.sex)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex gap-1.5">
                        {cat.color ? (
                          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                            {cat.color}
                          </span>
                        ) : null}
                        {cat.age ? (
                          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                            {cat.age}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-white/60 truncate">
                        {cat.spot_last_seen || "—"}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingRemove({ cat, sessionCatId })}
                    disabled={removingCatId === sessionCatId}
                    className="flex w-12 shrink-0 items-center justify-center bg-brand-dark/20 transition-colors hover:bg-red-500/70 disabled:opacity-40"
                    aria-label="Remove cat from session"
                  >
                    <TrashIcon className="h-4 w-4 text-white" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <FinishSessionDialog
        open={showFinish}
        onClose={() => setShowFinish(false)}
        onConfirm={handleSubmitSession}
        isLoading={submitting}
      />

      <DeleteSessionDialog
        open={showDiscard}
        onClose={() => setShowDiscard(false)}
        onConfirm={handleDiscard}
        isLoading={discarding}
      />

      <RemoveCatDialog
        open={pendingRemove !== null}
        catName={pendingRemove?.cat.name ?? null}
        onClose={() => setPendingRemove(null)}
        onConfirm={handleConfirmRemove}
        isLoading={removingCatId !== null}
      />

      {showAddForm ? (
        <CatEntryForm
          onClose={() => setShowAddForm(false)}
          onSave={handleCatSaved}
          sessionId={sessionId ?? undefined}
          regionId={selectedRegionId || undefined}
        />
      ) : null}

      {editingCat ? (
        <CatEntryForm
          initialCat={editingCat}
          onClose={() => setEditingCat(null)}
          onSave={() => {
            setEditingCat(null);
            handleCatSaved();
          }}
          sessionId={sessionId ?? undefined}
          regionId={selectedRegionId || undefined}
        />
      ) : null}
    </>
  );
}
