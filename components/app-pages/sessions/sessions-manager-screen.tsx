"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ImagePlaceholderIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";
import { getSessionCats } from "@/app/actions/sessions";
import { getCats } from "@/app/actions/cats";
import type { SelectCat } from "@/lib/validation/cats";
import type { SelectSessionCat } from "@/lib/validation/sessions";

type ReviewItem = {
  cat: SelectCat;
  sessionId: string;
  sessionCatId: string;
};

export function SessionsManagerScreen() {
  const [forReview, setForReview] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  /** Fetch cats from unfinished sessions (pending review) */
  const fetchPendingCats = useCallback(async () => {
    setLoading(true);
    try {
      // Parallel: get all unreviewed cats + all session-cat links
      const [catsResult, sessionCatsResult] = await Promise.all([
        getCats({ entry_status: "Unreviewed" }),
        getSessionCats({}),
      ]);

      const unreviewedCats = catsResult?.data ?? [];
      const allSessionCats = sessionCatsResult?.data ?? [];

      // Build cat_id → sessionCat lookup
      const scByCatId = new Map<string, SelectSessionCat>();
      for (const sc of allSessionCats) {
        scByCatId.set(sc.cat_id, sc);
      }

      const resolved = unreviewedCats
        .map((cat) => {
          const sc = scByCatId.get(cat.id);
          if (!sc) return null;
          return { cat, sessionId: sc.session_id, sessionCatId: sc.id } as ReviewItem;
        })
        .filter((item): item is ReviewItem => item !== null);

      setForReview(resolved);
    } catch (err) {
      console.error("Failed to fetch pending cats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingCats();
  }, [fetchPendingCats]);

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

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "—";
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
  };

  const LoadingIndicator = () => (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
    </div>
  );

  return (
    <>
      <div className="flex flex-1 flex-col tablet:hidden">
        <div className="flex-1 space-y-3 px-4 py-4">
          {/* Top action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-brand-green py-2.5 text-sm font-bold text-brand-green transition-opacity hover:opacity-80"
            >
              Census Report
            </button>
            <Link
              href="/dashboard/sessions"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-orange py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Review Sessions ⊙
            </Link>
          </div>

          {/* Heading + pending count */}
          <div className="flex items-center gap-2">
            <p className="font-heading text-2xl font-bold text-foreground">For Review</p>
            {forReview.length > 0 ? (
              <span className="rounded-full bg-brand-orange px-2.5 py-0.5 text-xs font-bold text-white">
                {forReview.length} pending
              </span>
            ) : null}
          </div>

          {loading ? (
            <LoadingIndicator />
          ) : forReview.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No cats pending review.
            </div>
          ) : (
            <div className="space-y-2">
              {forReview.map((item) => (
                <Link
                  key={item.sessionCatId}
                  href={`/dashboard/sessions/approval/validation?catId=${item.cat.id}&sessionId=${item.sessionId}&sessionCatId=${item.sessionCatId}`}
                  className="block overflow-hidden rounded-2xl bg-brand-green transition-opacity hover:opacity-90"
                >
                  <div className="flex items-stretch gap-0">
                    {/* Full-height image column */}
                    <div className="flex w-24 shrink-0 items-center justify-center bg-white/10">
                      <ImagePlaceholderIcon className="h-10 w-10 text-white/40" />
                    </div>
                    {/* Info */}
                    <div className="min-w-0 flex-1 px-3.5 py-3">
                      <p className="font-heading text-xl font-bold leading-tight text-brand-yellow">
                        {item.cat.name || "Unnamed"}
                        {sexSymbol(item.cat.sex) ? (
                          <span className="ml-1 text-white/80">{sexSymbol(item.cat.sex)}</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-white/70">
                        {item.cat.color || "Unknown"}{item.cat.age ? ` Size/${item.cat.age}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-white/60">
                        {item.cat.spot_last_seen || "—"} &middot; {formatDate(item.cat.last_updated_at)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
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

        <section className="mt-4 overflow-hidden rounded-2xl bg-brand-green p-4 ring-1 ring-brand-green">
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search"
                className="h-9 w-full rounded-full bg-white/15 px-4 pr-10 text-sm text-white outline-none placeholder:text-white/60"
              />
              <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
            </div>
            <button
              type="button"
              className="flex items-center gap-1 rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Sort by <span className="ml-1">&#9662;</span>
            </button>
          </div>
        </section>

        <div className="mt-4 space-y-3">
          {loading ? (
            <LoadingIndicator />
          ) : forReview.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-400 ring-1 ring-border">
              No cats pending review.
            </div>
          ) : (
            forReview.map((item) => (
              <article
                key={`review-${item.sessionCatId}`}
                className="rounded-2xl bg-brand-green p-4 ring-1 ring-brand-green transition-opacity hover:opacity-90"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                    <ImagePlaceholderIcon className="h-9 w-9 text-white/50" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading text-xl font-bold tracking-tight text-white">
                        {item.cat.name || "Unnamed"}
                      </h3>
                      {sexSymbol(item.cat.sex) ? (
                        <span className={`text-xl ${sexColor(item.cat.sex)}`}>
                          {sexSymbol(item.cat.sex)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      {item.cat.color ? (
                        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                          {item.cat.color}
                        </span>
                      ) : null}
                      {item.cat.age ? (
                        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                          {item.cat.age}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm text-white/70">
                      Last seen: {item.cat.spot_last_seen || "—"} &middot;{" "}
                      {formatDate(item.cat.last_updated_at)}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/sessions/approval/validation?catId=${item.cat.id}&sessionId=${item.sessionId}&sessionCatId=${item.sessionCatId}`}
                    className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  >
                    Review <span className="ml-1">&#9998;</span>
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </>
  );
}
