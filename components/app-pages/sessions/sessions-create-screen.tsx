"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ImagePlaceholderIcon,
  PlusCircleIcon,
  ChevronDownIcon,
} from "@/components/app-pages/shared/icons";
import { CatEntryForm } from "@/components/app-pages/shared/cat-entry-form";
import { useAuth } from "@/contexts/auth-context";
import {
  createSession,
  getSessionCats,
  getSessions,
  editSession,
} from "@/app/actions/sessions";
import { getCats } from "@/app/actions/cats";
import { createClient } from "@/lib/supabase/client";
import type { SelectCat } from "@/lib/validation/cats";
import type { SelectSessionCat } from "@/lib/validation/sessions";

type RegionOption = {
  id: string;
  name: string;
};

export function SessionsCreateScreen() {
  const searchParams = useSearchParams();
  const existingSessionId = searchParams.get("sessionId");

  const { userData } = useAuth();
  const userId = userData?.supabaseUser?.id;

  const [sessionId, setSessionId] = useState<string | null>(existingSessionId);
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [selectedRegionName, setSelectedRegionName] = useState("");
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([]);
  const [cats, setCats] = useState<SelectCat[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRegions = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("regions")
        .select("id,name");

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      const options = (data ?? [])
        .filter((row): row is RegionOption => Boolean(row?.id && row?.name))
        .sort((a, b) => a.name.localeCompare(b.name));

      setRegionOptions(options);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load locations.",
      );
    }
  }, []);

  /** Fetch session cats and resolve to full cat objects */
  const fetchSessionCats = useCallback(async (sid: string) => {
    try {
      const scResult = await getSessionCats({ session_id: sid });
      if (scResult?.data && scResult.data.length > 0) {
        const catIds = scResult.data.map((sc: SelectSessionCat) => sc.cat_id);
        // Fetch each cat
        const catPromises = catIds.map((cid: string) => getCats({ id: cid }));
        const catResults = await Promise.all(catPromises);
        const resolved = catResults
          .filter((r) => r?.data && r.data.length > 0)
          .map((r) => r!.data![0]);
        setCats(resolved);
      } else {
        setCats([]);
      }
    } catch (err) {
      console.error("Failed to fetch session cats:", err);
    }
  }, []);

  const hydrateExistingSession = useCallback(
    async (sid: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await getSessions({ id: sid });
        const existing = result?.data?.[0];
        if (!existing) {
          setError("Session not found.");
          return;
        }

        setSessionId(existing.id);
        setSelectedRegionId(existing.region_id);
        await fetchSessionCats(existing.id);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load session.",
        );
      } finally {
        setLoading(false);
      }
    },
    [fetchSessionCats],
  );

  useEffect(() => {
    loadRegions();
  }, [loadRegions]);

  /** Load existing session data if we have a sessionId */
  useEffect(() => {
    if (existingSessionId) {
      hydrateExistingSession(existingSessionId);
    }
  }, [existingSessionId, hydrateExistingSession]);

  useEffect(() => {
    if (!selectedRegionId) {
      setSelectedRegionName("");
      return;
    }

    const option = regionOptions.find(
      (region) => region.id === selectedRegionId,
    );
    setSelectedRegionName(option ? option.name : selectedRegionId.slice(0, 8));
  }, [selectedRegionId, regionOptions]);

  /** Create a new session when location is selected */
  const handleLocationSelect = useCallback(
    async (regionId: string) => {
      setSelectedRegionId(regionId);
      setError(null);

      if (sessionId) return; // Already have a session
      if (!regionId) return;
      if (!userId) {
        setError("Unable to identify current user.");
        return;
      }

      setLoading(true);
      try {
        const result = await createSession({
          region_id: regionId,
          user_id: userId,
        });

        if (result?.serverError) {
          setError(result.serverError);
          return;
        }

        const newSession = result?.data;
        if (!newSession?.id) {
          setError("Session was created but no ID was returned.");
          return;
        }

        setSessionId(newSession.id);
        await fetchSessionCats(newSession.id);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create session.",
        );
      } finally {
        setLoading(false);
      }
    },
    [sessionId, userId, fetchSessionCats],
  );

  const handleSubmitSession = useCallback(async () => {
    if (!sessionId) return;
    setSubmitting(true);
    setError(null);
    try {
      const boundEdit = editSession.bind(null, sessionId);
      const result = await boundEdit({ is_finished: true });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      // Navigate back
      window.location.href = "/sessions";
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

  return (
    <>
      <div className="flex flex-1 flex-col px-4 py-4 tablet:hidden">
        <div className="flex-1 space-y-4">
          <div className="relative rounded-xl bg-brand-green px-4 py-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold tracking-tight text-white">
                  {selectedRegionName || "Select Location"}
                </p>
                <p className="text-xs text-white/70">
                  Census No. {sessionId ? sessionId.slice(0, 8) : "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="px-1 text-xs tracking-widest text-white/70"
                aria-label="More options"
              >
                &bull;&bull;&bull;
              </button>
            </div>

            {menuOpen ? (
              <div className="absolute right-4 top-10 z-10 min-w-30 rounded-xl border border-white/20 bg-brand-green py-1 shadow-lg">
                {["Details", "Finish", "Save"].map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => {
                      setMenuOpen(false);
                      if (opt === "Finish") handleSubmitSession();
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative rounded-xl bg-brand-green px-4 py-3">
            <label className="text-xs font-semibold tracking-wide text-white/70">
              Location
            </label>
            <div className="relative mt-1.5">
              <select
                value={selectedRegionId}
                onChange={(e) => handleLocationSelect(e.target.value)}
                disabled={!!sessionId || loading}
                className="h-9 w-full appearance-none rounded-full bg-white/15 px-4 pr-9 text-sm text-white ring-1 ring-white/20 disabled:opacity-60"
              >
                <option value="">Select...</option>
                {regionOptions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
            </div>
          </div>

          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
            </div>
          ) : !sessionId ? (
            <div className="py-8 text-center text-sm text-white/50">
              Select a location to start a session.
            </div>
          ) : cats.length === 0 ? (
            <div className="py-8 text-center text-sm text-white/50">
              No cats in this session yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-brand-green">
              {cats.map((cat, i) => (
                <div key={cat.id}>
                  <div className="flex items-start gap-3 px-3.5 py-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
                      <ImagePlaceholderIcon className="h-5 w-5 text-white/50" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold tracking-tight text-white">
                          {cat.name || "Unnamed"}
                        </span>
                        {sexSymbol(cat.sex) ? (
                          <span className={`text-sm ${sexColor(cat.sex)}`}>
                            {sexSymbol(cat.sex)}
                          </span>
                        ) : null}
                        <span className="ml-auto text-xs tracking-widest text-white/70">
                          &bull;&bull;&bull;
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-white/70">
                        {cat.color || "Unknown"}
                      </p>
                      <p className="text-xs text-white/70">
                        {cat.age || "Unknown"}
                      </p>
                    </div>
                  </div>
                  {i < cats.length - 1 ? (
                    <div className="mx-3.5 border-b border-white/10" />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end px-4 pb-5">
          <button
            type="button"
            onClick={handleOpenAddForm}
            className="flex items-center gap-2 rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90"
          >
            Add Entry
            <PlusCircleIcon className="h-4 w-4" />
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
              href="/sessions"
              className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Back <span className="ml-1">&#8249;</span>
            </Link>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <label className="flex w-full max-w-72 items-center gap-2 text-sm font-semibold text-foreground">
            <span>Location:</span>
            <div className="relative flex-1">
              <select
                value={selectedRegionId}
                onChange={(e) => handleLocationSelect(e.target.value)}
                disabled={!!sessionId || loading}
                className="h-9 w-full appearance-none rounded-full bg-white px-4 pr-9 text-sm text-foreground ring-1 ring-border disabled:opacity-60"
              >
                <option value="">Select...</option>
                {regionOptions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </label>
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
            {cats.map((cat) => (
              <article
                key={`entry-${cat.id}`}
                className="rounded-2xl bg-brand-green p-4 ring-1 ring-brand-green"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                    <ImagePlaceholderIcon className="h-9 w-9 text-white/50" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading text-xl font-bold tracking-tight text-white">
                        {cat.name || "Unnamed"}
                      </h3>
                      {sexSymbol(cat.sex) ? (
                        <span className={`text-xl ${sexColor(cat.sex)}`}>
                          {sexSymbol(cat.sex)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex gap-1.5">
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
                    <p className="mt-3 text-sm text-white/70">
                      Last seen: {cat.spot_last_seen || "—"} &middot;{" "}
                      {formatDate(cat.last_updated_at)}
                    </p>
                  </div>
                  <Link
                    href={`/database/general?id=${cat.id}`}
                    className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  >
                    Edit <span className="ml-1">&#9998;</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {showAddForm ? (
        <CatEntryForm
          onClose={() => setShowAddForm(false)}
          onSave={handleCatSaved}
          sessionId={sessionId ?? undefined}
          regionId={selectedRegionId || undefined}
        />
      ) : null}
    </>
  );
}
