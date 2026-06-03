"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Pencil, Loader2, Check } from "lucide-react";
import { displayCatField } from "@/lib/utils";
import { CatPhoto } from "@/components/app-pages/shared/cat-photo";
import { ApproveCatDialog } from "@/components/app-pages/sessions/session-dialogs";
import { approveCat } from "@/app/actions/cats";
import type { CatWithRegion } from "@/lib/repo/cats.repo";
import { CENSUS_REPORT_URL } from "@/lib/constants";

export type ReviewItem = {
  cat: CatWithRegion;
  sessionId: string;
  sessionCatId: string;
};

type SessionsManagerScreenProps = {
  initialForReview: ReviewItem[];
};

export function SessionsManagerScreen({
  initialForReview,
}: SessionsManagerScreenProps) {
  const [forReview, setForReview] = useState<ReviewItem[]>(initialForReview);
  const loading = false;
  const [approvingItem, setApprovingItem] = useState<ReviewItem | null>(null);
  const [saving, setSaving] = useState(false);

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

  const handleApprove = useCallback(async () => {
    if (!approvingItem) return;
    setSaving(true);
    try {
      const result = await approveCat({ id: approvingItem.cat.id });
      if (!result?.serverError) {
        setForReview((prev) =>
          prev.filter((i) => i.sessionCatId !== approvingItem.sessionCatId),
        );
        setApprovingItem(null);
      }
    } catch (err) {
      console.error("Failed to approve:", err);
    } finally {
      setSaving(false);
    }
  }, [approvingItem]);

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "—";
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
  };

  const LoadingIndicator = () => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
    </div>
  );

  return (
    <>
      <div className="flex flex-1 flex-col tablet:hidden">
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
            <Link
              href="/dashboard/sessions"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-dark py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              My Sessions ›
            </Link>
          </div>

          {/* Heading + pending count */}
          <div className="flex items-center gap-2">
            <p className="font-heading text-2xl font-bold text-brand-green">
              For Review
            </p>
            {forReview.length > 0 ? (
              <span className="rounded-full border border-brand-orange px-2.5 py-0.5 text-xs font-bold text-brand-orange">
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
                <div
                  key={item.sessionCatId}
                  className="overflow-hidden rounded-2xl bg-brand-green"
                >
                  <div className="flex items-stretch gap-0">
                    {/* Full-height image column */}
                    <div className="flex w-28 shrink-0 items-center justify-center overflow-hidden bg-white/10">
                      <CatPhoto
                        photoUrl={item.cat.photo_url}
                        name={item.cat.name}
                        className="h-28 w-28 object-cover"
                        iconClassName="h-10 w-10 text-white/40"
                      />
                    </div>
                    {/* Info */}
                    <div className="flex min-w-0 flex-1 flex-col justify-between px-3.5 py-3 min-h-25">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-heading text-2xl font-bold leading-tight text-brand-yellow truncate">
                              {item.cat.name || "Unnamed"}
                            </span>
                            {sexSymbol(item.cat.sex) ? (
                              <span className="text-white text-lg leading-none ml-1">
                                {sexSymbol(item.cat.sex)}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm font-bold text-white truncate">
                            {displayCatField(item.cat.color)}
                            {item.cat.age ? ` ${item.cat.age}` : ""}
                          </p>
                          {item.cat.region_name ? (
                            <span className="mt-1 inline-block rounded-full bg-brand-dark/60 px-2 py-0.5 text-xs font-semibold text-white/80">
                              {item.cat.region_name}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setApprovingItem(item)}
                            aria-label={`Approve ${item.cat.name || "cat"}`}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
                          >
                            <Check size={18} strokeWidth={3} />
                          </button>
                          <Link
                            href={`/dashboard/sessions/approval/validation?catId=${item.cat.id}&sessionId=${item.sessionId}&sessionCatId=${item.sessionCatId}`}
                            aria-label={`Review ${item.cat.name || "cat"}`}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-dark text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
                          >
                            <Pencil size={15} />
                          </Link>
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-bold text-white truncate">
                        {item.cat.spot_last_seen || "—"} -{" "}
                        {formatDate(item.cat.last_updated_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-brand-dark">
            For Review
          </h1>
          <div className="flex items-center gap-2">
            <a
              href={CENSUS_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-brand-dark px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Census Report
            </a>
            <Link
              href="/dashboard/sessions"
              className="rounded-full bg-brand-dark px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              My Sessions <span className="ml-1">&#8249;</span>
            </Link>
          </div>
        </div>

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
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15">
                    <CatPhoto
                      photoUrl={item.cat.photo_url}
                      name={item.cat.name}
                      className="h-20 w-20 object-cover"
                      iconClassName="h-9 w-9 text-white/50"
                    />
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
                    <div className="mt-2 flex flex-wrap gap-1.5">
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
                      {item.cat.region_name ? (
                        <span className="rounded-full bg-brand-dark/50 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                          {item.cat.region_name}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm text-white/70">
                      Last seen: {item.cat.spot_last_seen || "—"} &middot;{" "}
                      {formatDate(item.cat.last_updated_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setApprovingItem(item)}
                      className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                    >
                      Approve <span className="ml-1">&#10003;</span>
                    </button>
                    <Link
                      href={`/dashboard/sessions/approval/validation?catId=${item.cat.id}&sessionId=${item.sessionId}&sessionCatId=${item.sessionCatId}`}
                      className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                    >
                      Review <Pencil size={13} className="ml-1 inline" />
                    </Link>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <ApproveCatDialog
        open={approvingItem !== null}
        onClose={() => setApprovingItem(null)}
        onConfirm={handleApprove}
        isLoading={saving}
      />
    </>
  );
}
