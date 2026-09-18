"use client";

import { useCallback, useState } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { DetailHeader, TopTabs } from "@/components/app-pages/shared/page-frame";
import { CatPhotoButton } from "@/components/app-pages/shared/photo-lightbox";
import { positionFromCat } from "@/lib/photo-position";
import { editCat } from "@/app/actions/cats";
import { useAuth } from "@/contexts/auth-context";
import { useCatDetail } from "@/contexts/cat-detail-context";

function sexGlyph(s: string | null | undefined): string | null {
  if (s === "Male") return "♂";
  if (s === "Female") return "♀";
  return null;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
}

const SEGMENT_TO_TAB = {
  general: "General",
  medical: "Medical",
  interventions: "Interventions",
} as const;

type Tab = (typeof SEGMENT_TO_TAB)[keyof typeof SEGMENT_TO_TAB];

/**
 * The cat identity card and tab bar, rendered by the [id] layout rather than by
 * each tab screen.
 *
 * It lives in the layout so that switching tabs does not tear it down: a
 * loading boundary can only replace what sits below it, so with this markup
 * inside the pages, any per-tab boundary blanked the cat's photo, name and the
 * tabs themselves on every switch. Here, only the tab body swaps.
 *
 * It also collapses three near-identical copies of this card into one.
 */
export function CatDetailHeader() {
  const { catId, cat, refresh } = useCatDetail();
  const { canManage } = useAuth();
  const segment = useSelectedLayoutSegment();
  const active: Tab =
    SEGMENT_TO_TAB[(segment ?? "general") as keyof typeof SEGMENT_TO_TAB] ??
    "General";

  const [error, setError] = useState<string | null>(null);
  // The switch shows the cat's stored value unless the manager has just flipped
  // it, in which case the optimistic value wins until the write settles. Holding
  // it as an override rather than a mirrored copy means there is no effect
  // syncing state to state — the cat is the source of truth throughout.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const isAdoptable = optimistic ?? cat?.is_adoptable ?? false;

  // Adoptable saves on click rather than waiting for Save — it is a single
  // decision managers flip from the list, not part of the edit form's batch.
  const handleToggleAdoptable = useCallback(async () => {
    if (!catId) return;
    const newVal = !isAdoptable;
    setOptimistic(newVal);
    setError(null);
    try {
      const result = await editCat({ id: catId, is_adoptable: newVal });
      if (result?.serverError) {
        setOptimistic(null);
        setError(result.serverError);
        return;
      }
    } catch (err) {
      console.error("Failed to toggle adoptable:", err);
      setOptimistic(null);
      setError(
        err instanceof Error ? err.message : "Failed to toggle adoptable.",
      );
    }
  }, [catId, isAdoptable]);

  const sex_glyph = sexGlyph(cat?.sex);
  // Sociability and the Adoptable toggle appear on General only, matching how
  // these screens have always rendered.
  const isGeneral = active === "General";

  return (
    <>
      <DetailHeader
        name={cat?.name || "Unnamed"}
        lastUpdated={formatDate(cat?.last_updated_at)}
        backHref="/dashboard/database"
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {/* Identity card */}
      <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-brand-dark/8">
        <div className="flex flex-col gap-5 p-5 tablet:flex-row tablet:items-center tablet:gap-6 tablet:p-6">
          <div className="h-32 w-32 shrink-0 self-center tablet:h-28 tablet:w-28 tablet:self-auto">
            <CatPhotoButton
              catId={catId ?? ""}
              photoUrl={cat?.photo_url}
              name={cat?.name}
              position={cat ? positionFromCat(cat) : null}
              canEdit={canManage}
              onChanged={refresh}
              className="h-full w-full rounded-2xl ring-1 ring-brand-dark/10"
              iconClassName="h-12 w-12 text-brand-green/30"
              sizes="128px"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-2xl font-bold leading-tight tracking-tight text-brand-dark truncate tablet:text-3xl">
                {cat?.name || "Unnamed"}
              </h2>
              {sex_glyph ? (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-green/12 px-1.5 text-sm font-bold text-brand-green">
                  {sex_glyph}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {cat?.color ? (
                <span className="inline-flex h-6 items-center rounded-full bg-brand-cream-dark/60 px-2.5 text-[11px] font-semibold text-brand-dark/75">
                  {cat.color}
                </span>
              ) : null}
              {cat?.age ? (
                <span className="inline-flex h-6 items-center rounded-full bg-brand-cream-dark/60 px-2.5 text-[11px] font-semibold text-brand-dark/75">
                  {cat.age}
                </span>
              ) : null}
              {isGeneral && cat?.sociability ? (
                <span className="inline-flex h-6 items-center rounded-full bg-brand-cream-dark/60 px-2.5 text-[11px] font-semibold text-brand-dark/75">
                  {cat.sociability}
                </span>
              ) : null}
            </div>

            <p className="mt-3 flex items-baseline gap-1.5 text-xs text-brand-dark/60">
              <span className="font-bold uppercase tracking-wider text-brand-green/80 text-[10px]">
                Last seen
              </span>
              <span className="font-semibold text-brand-dark/80">
                {cat?.spot_last_seen || "Unknown"}
              </span>
              {cat?.date_last_seen ? (
                <>
                  <span className="text-brand-dark/30">·</span>
                  <span className="tabular-nums">
                    {formatDate(cat.date_last_seen)}
                  </span>
                </>
              ) : null}
            </p>
          </div>

          {isGeneral ? (
            <div className="flex shrink-0 items-center justify-between gap-3 rounded-2xl bg-brand-cream-dark/40 px-4 py-2.5 tablet:flex-col tablet:items-end tablet:px-3 tablet:py-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-dark/60">
                Adoptable
              </span>
              <button
                type="button"
                onClick={canManage ? handleToggleAdoptable : undefined}
                disabled={!canManage}
                aria-pressed={isAdoptable}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  isAdoptable ? "bg-brand-orange" : "bg-brand-dark/15"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    isAdoptable ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ) : null}
        </div>

        <div className="border-t border-brand-dark/8 px-5 pt-2 tablet:px-6">
          <TopTabs active={active} />
        </div>
      </div>
    </>
  );
}
