"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  PlusCircleIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/app-pages/shared/icons";
import { CatPhoto } from "@/components/app-pages/shared/cat-photo";
import { CatEntryForm } from "@/components/app-pages/shared/cat-entry-form";
import {
  DiscardSessionDialog,
  FinishSessionDialog,
} from "@/components/app-pages/sessions/session-dialogs";
import {
  getSessionCats,
  getSessions,
  editSession,
  removeSession,
  removeSessionCat,
} from "@/app/actions/sessions";
import { getCats } from "@/app/actions/cats";
import { createClient } from "@/lib/supabase/client";
import type { SelectCat } from "@/lib/validation/cats";
import type { SelectSessionCat } from "@/lib/validation/sessions";

type SessionCatEntry = { cat: SelectCat; sessionCatId: string };

export function SessionsCreateScreen() {
  const searchParams = useSearchParams();
  const existingSessionId = searchParams.get("sessionId");

  const [sessionId, setSessionId] = useState<string | null>(existingSessionId);
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [selectedRegionName, setSelectedRegionName] = useState("");
  const [cats, setCats] = useState<SessionCatEntry[]>([]);
  const [removingCatId, setRemovingCatId] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<SelectCat | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Fetch session cats and resolve to full cat objects */
  const fetchSessionCats = useCallback(async (sid: string) => {
    try {
      const scResult = await getSessionCats({ session_id: sid });
      const sessionCats = scResult?.data ?? [];
      if (sessionCats.length === 0) { setCats([]); return; }
      const catPromises = sessionCats.map((sc: SelectSessionCat) => getCats({ id: sc.cat_id }));
      const catResults = await Promise.all(catPromises);
      const entries: SessionCatEntry[] = catResults
        .map((r, i) => {
          const cat = r?.data?.[0] as SelectCat | undefined;
          if (!cat) return null;
          return { cat, sessionCatId: sessionCats[i].id };
        })
        .filter((e): e is SessionCatEntry => e !== null);
      setCats(entries);
    } catch (err) {
      console.error("Failed to fetch session cats:", err);
    }
  }, []);

  const hydrateExistingSession = useCallback(
    async (sid: string) => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const [sessionResult, regionsResult] = await Promise.all([
          getSessions({ id: sid }),
          supabase.from("regions").select("id,name"),
        ]);
        const existing = sessionResult?.data?.[0];
        if (!existing) { setError("Session not found."); return; }
        setSessionId(existing.id);
        setSelectedRegionId(existing.region_id);
        const regionName =
          (regionsResult.data ?? []).find((r) => r.id === existing.region_id)?.name ?? "Unknown Location";
        setSelectedRegionName(regionName);
        await fetchSessionCats(existing.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load session.");
      } finally {
        setLoading(false);
      }
    },
    [fetchSessionCats],
  );

  /** Load existing session data if we have a sessionId */
  useEffect(() => {
    if (existingSessionId) {
      hydrateExistingSession(existingSessionId);
    }
  }, [existingSessionId, hydrateExistingSession]);

  const handleSave = useCallback(() => {
    // Session row + cats already persisted incrementally; "Save" just exits.
    window.location.href = "/dashboard/sessions";
  }, []);

  const handleDiscard = useCallback(async () => {
    if (!sessionId) {
      window.location.href = "/dashboard/sessions";
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
      window.location.href = "/dashboard/sessions";
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to discard session.",
      );
    } finally {
      setDiscarding(false);
    }
  }, [sessionId]);

  const handleSubmitSession = useCallback(async () => {
    if (!sessionId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await editSession.bind(null, sessionId)({ id: sessionId, is_finished: true });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      // Navigate back
      window.location.href = "/dashboard/sessions";
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit session.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [sessionId]);

  const handleOpenAddForm = useCallback(() => {
    if (!sessionId) {
      setError("Select a location first to create a session.");
      return;
    }
    setShowAddForm(true);
  }, [sessionId]);

  const handleCatSaved = useCallback(() => {
    if (sessionId) {
      fetchSessionCats(sessionId);
    }
  }, [sessionId, fetchSessionCats]);

  const handleRemoveCat = useCallback(async (sessionCatId: string) => {
    setRemovingCatId(sessionCatId);
    try {
      await removeSessionCat.bind(null, sessionCatId)();
      if (sessionId) await fetchSessionCats(sessionId);
    } finally {
      setRemovingCatId(null);
    }
  }, [sessionId, fetchSessionCats]);

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
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark/40">Location</p>
            <p className="font-heading text-xl font-bold text-brand-green">{selectedRegionName || "Loading…"}</p>
          </div>

          {/* Census No. + action buttons */}
          {sessionId ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-brand-green px-3 py-1.5 text-xs font-bold text-brand-yellow">
                Census No. {sessionId.slice(0, 8)}
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowDiscard(true)}
                  className="flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-opacity hover:opacity-80"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-1 rounded-full border border-brand-green bg-white px-3 py-1.5 text-xs font-semibold text-brand-green transition-opacity hover:opacity-80"
                >
                  Save 💾
                </button>
                <button
                  type="button"
                  onClick={() => setShowFinish(true)}
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
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
            </div>
          ) : cats.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No cats yet. Tap + to add one.
            </div>
          ) : (
            <div className="space-y-2">
              {cats.map(({ cat, sessionCatId }) => (
                <div key={cat.id} className="overflow-hidden rounded-2xl bg-brand-green">
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => setEditingCat(cat)}
                      className="flex w-24 shrink-0 items-center justify-center overflow-hidden bg-white/10"
                    >
                      <CatPhoto photoUrl={cat.photo_url} name={cat.name} className="h-24 w-24 object-cover" iconClassName="h-10 w-10 text-white/40" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCat(cat)}
                      className="flex min-w-0 flex-1 items-start px-3.5 py-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-heading text-xl font-bold leading-tight text-brand-yellow truncate">{cat.name || "Unnamed"}</p>
                        <p className="mt-0.5 text-xs text-white/70 truncate">{[cat.color, cat.age].filter(Boolean).join(" · ") || "—"}</p>
                        <p className="mt-1 text-xs text-white/60 truncate">{cat.spot_last_seen || "—"}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveCat(sessionCatId)}
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
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange shadow-lg transition-opacity hover:opacity-90"
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
            <button
              type="button"
              className="rounded-full bg-brand-green px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Census Report <span className="ml-1">📊</span>
            </button>
            <Link
              href="/dashboard/sessions"
              className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Back <span className="ml-1">&#8249;</span>
            </Link>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground/60">Location:</span>
          <span className="font-heading text-xl font-bold text-brand-green">{selectedRegionName || "Loading…"}</span>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        ) : null}

        <section className="mt-4 overflow-hidden rounded-2xl bg-brand-green p-4 ring-1 ring-brand-green">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold tracking-tight text-white">
              Census No. {sessionId ? sessionId.slice(0, 8) : "—"}
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
                onClick={handleSubmitSession}
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
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
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
                <div className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => setEditingCat(cat)}
                    className="flex w-24 shrink-0 items-center justify-center overflow-hidden bg-white/10"
                  >
                    <CatPhoto photoUrl={cat.photo_url} name={cat.name} className="h-24 w-24 object-cover" iconClassName="h-10 w-10 text-white/40" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCat(cat)}
                    className="flex min-w-0 flex-1 items-start px-4 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-heading text-xl font-bold leading-tight text-brand-yellow truncate">{cat.name || "Unnamed"}</p>
                        {sexSymbol(cat.sex) ? (
                          <span className={`text-xl ${sexColor(cat.sex)}`}>{sexSymbol(cat.sex)}</span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex gap-1.5">
                        {cat.color ? <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">{cat.color}</span> : null}
                        {cat.age ? <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">{cat.age}</span> : null}
                      </div>
                      <p className="mt-2 text-xs text-white/60 truncate">{cat.spot_last_seen || "—"}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveCat(sessionCatId)}
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

      <DiscardSessionDialog
        open={showDiscard}
        onClose={() => setShowDiscard(false)}
        onConfirm={handleDiscard}
        isLoading={discarding}
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
          regionId={selectedRegionId || undefined}
        />
      ) : null}
    </>
  );
}
