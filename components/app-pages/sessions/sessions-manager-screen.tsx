"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ImagePlaceholderIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";
import { getSessions, getSessionCats } from "@/app/actions/sessions";
import { getCats } from "@/app/actions/cats";
import type { SelectCat } from "@/lib/validation/cats";
import type {
  SelectSession,
  SelectSessionCat,
} from "@/lib/validation/sessions";

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
      // Get all sessions, then keep entries that are still unreviewed.
      const sessionsResult = await getSessions({});
      if (!sessionsResult?.data || sessionsResult.data.length === 0) {
        setForReview([]);
        return;
      }

      // For each unfinished session, get its cats
      const scPromises = sessionsResult.data.map((s: SelectSession) =>
        getSessionCats({ session_id: s.id }),
      );
      const scResults = await Promise.all(scPromises);
      const allSessionCats = scResults
        .filter((r) => r?.data)
        .flatMap((r) => r!.data!);

      if (allSessionCats.length === 0) {
        setForReview([]);
        return;
      }

      // Resolve each to a full cat object
      const catPromises = allSessionCats.map((sc: SelectSessionCat) =>
        getCats({ id: sc.cat_id }),
      );
      const catResults = await Promise.all(catPromises);

      const resolved = catResults
        .map((r, index) => {
          const cat = r?.data?.[0];
          const sessionCat = allSessionCats[index];
          if (!cat || !sessionCat) return null;

          if (cat.entry_status !== "Unreviewed") return null;

          return {
            cat,
            sessionId: sessionCat.session_id,
            sessionCatId: sessionCat.id,
          } as ReviewItem;
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
      <div className="flex flex-1 flex-col px-4 py-4 tablet:hidden">
        <div className="flex-1 space-y-4">
          <Link
            href="/sessions"
            className="flex w-full items-center justify-between rounded-xl bg-brand-green px-4 py-3 transition-opacity hover:opacity-90"
          >
            <span className="text-sm font-semibold tracking-tight text-white">
              Current Census Reports
            </span>
            <span className="text-white/70">&#8599;</span>
          </Link>

          <div>
            <p className="mb-2.5 text-sm font-bold tracking-tight text-white">
              For Review
            </p>
            {loading ? (
              <LoadingIndicator />
            ) : forReview.length === 0 ? (
              <div className="py-6 text-center text-sm text-white/50">
                No cats pending review.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl bg-brand-green">
                {forReview.map((item, i) => (
                  <Link
                    key={item.sessionCatId}
                    href={`/sessions/approval/validation?catId=${item.cat.id}&sessionId=${item.sessionId}&sessionCatId=${item.sessionCatId}`}
                    className="block"
                  >
                    <div className="flex items-start gap-3 px-3.5 py-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
                        <ImagePlaceholderIcon className="h-5 w-5 text-white/50" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold tracking-tight text-white">
                            {item.cat.name || "Unnamed"}
                          </span>
                          {sexSymbol(item.cat.sex) ? (
                            <span
                              className={`text-sm ${sexColor(item.cat.sex)}`}
                            >
                              {sexSymbol(item.cat.sex)}
                            </span>
                          ) : null}
                          <span className="ml-auto text-white/70">
                            &#8250;
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-white/70">
                          {item.cat.color || "Unknown"}
                        </p>
                        <p className="text-xs text-white/70">
                          {item.cat.age || "Unknown"}
                        </p>
                        <p className="mt-1.5 text-[11px] font-medium text-white/60">
                          {item.cat.spot_last_seen || "—"} &middot;{" "}
                          {formatDate(item.cat.last_updated_at)}
                        </p>
                      </div>
                    </div>
                    {i < forReview.length - 1 ? (
                      <div className="mx-3.5 border-b border-white/10" />
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pb-5 pt-4">
          <Link
            href="/sessions"
            className="rounded-full bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90"
          >
            My Sessions
          </Link>
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
                    href={`/sessions/approval/validation?catId=${item.cat.id}&sessionId=${item.sessionId}&sessionCatId=${item.sessionCatId}`}
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
