"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { SelectCat } from "@/lib/validation/cats";
import { CatPhoto } from "@/components/app-pages/shared/cat-photo";
import { positionFromCat } from "@/lib/photo-position";
import {
  ChevronRightIcon,
  MoreHorizontalIcon,
} from "@/components/app-pages/shared/icons";

type Variant = "compact" | "default" | "wide";
type Action = "kebab" | "chevron" | "none";

type CatCardProps = {
  cat: Pick<
    SelectCat,
    | "id"
    | "name"
    | "sex"
    | "color"
    | "age"
    | "spot_last_seen"
    | "date_last_seen"
    | "last_updated_at"
    | "photo_url"
    | "photo_zoom"
    | "photo_offset_x"
    | "photo_offset_y"
    | "photo_rotation"
    | "cat_status"
    | "is_adoptable"
  >;
  region_name?: string | null;
  href?: string;
  variant?: Variant;
  /** Right-side affordance. `kebab` = options, `chevron` = navigate, `none` = nothing. */
  action?: Action;
  /** Optional override for the date label shown bottom-left. */
  dateLabel?: string;
  /** Custom chips (rendered after default chips). */
  extraChips?: ReactNode;
  hideAdoptableChip?: boolean;
  /**
   * Hides the specific-location line. Set on the public catalog: a precise spot
   * ("LEONG 1F") is an internal field for finding a cat during a census, not
   * something to publish about a live animal on a page search engines index.
   */
  hideLocation?: boolean;
  className?: string;
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${String(date.getFullYear()).slice(-2)}`;
}

function sexGlyph(sex: string | null | undefined): string | null {
  if (sex === "Male") return "♂";
  if (sex === "Female") return "♀";
  return null;
}

/** Status → accent rail color + chip color. */
function statusAccent(cat: CatCardProps["cat"]): {
  rail: string;
  chip: { label: string; cls: string } | null;
} {
  if (cat.cat_status === "Deceased") {
    return { rail: "bg-brand-dark", chip: { label: "Deceased", cls: "bg-brand-dark text-white" } };
  }
  if (cat.cat_status === "MIA") {
    return { rail: "bg-status-mia", chip: { label: "MIA", cls: "bg-status-mia text-white" } };
  }
  if (cat.cat_status === "Adopted") {
    return { rail: "bg-status-adopted", chip: { label: "Adopted", cls: "bg-status-adopted text-white" } };
  }
  if (cat.cat_status === "Fostered") {
    return { rail: "bg-brand-orange", chip: { label: "Fostered", cls: "bg-brand-orange text-white" } };
  }
  if (cat.is_adoptable) {
    return { rail: "bg-brand-green", chip: { label: "Adoptable", cls: "bg-brand-green text-white" } };
  }
  return { rail: "bg-brand-green", chip: null };
}

function Chip({ children, cls }: { children: ReactNode; cls?: string }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold tabular-nums ${
        cls ?? "bg-brand-cream-dark text-brand-dark/80"
      }`}
    >
      {children}
    </span>
  );
}

export function CatCard({
  cat,
  region_name,
  href,
  variant = "compact",
  action = "chevron",
  dateLabel,
  extraChips,
  hideAdoptableChip = false,
  hideLocation = false,
  className = "",
}: CatCardProps) {
  const { rail, chip: rawChip } = statusAccent(cat);
  const statusChip =
    hideAdoptableChip && rawChip?.label === "Adoptable" ? null : rawChip;
  const sex = sexGlyph(cat.sex);
  const isInteractive = !!href;

  const baseShell =
    "group relative flex overflow-hidden rounded-2xl bg-white ring-1 ring-brand-green/15 transition-all duration-200";
  const hoverShell = isInteractive
    ? "hover:-translate-y-0.5 hover:ring-brand-green/40 hover:shadow-[0_8px_24px_-12px_rgba(82,145,81,0.35)]"
    : "";

  // ── COMPACT (mobile list / dense row) ────────────────────────────────────
  if (variant === "compact") {
    const inner = (
      <div className={`${baseShell} ${hoverShell} ${className}`}>
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 w-1 ${rail}`}
        />
        <div className="flex w-full items-stretch gap-3 p-2.5 pl-3.5">
          <CatPhoto
            photoUrl={cat.photo_url}
            name={cat.name}
            position={positionFromCat(cat)}
            className="h-20 w-20 shrink-0 rounded-xl ring-1 ring-brand-green/10"
          />
          <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-heading text-lg font-bold leading-tight tracking-tight text-brand-dark truncate">
                  {cat.name || "Unnamed"}
                </h3>
                {sex ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-green/15 px-1 text-xs font-bold text-brand-green">
                    {sex}
                  </span>
                ) : null}
                {statusChip ? (
                  <Chip cls={statusChip.cls}>{statusChip.label}</Chip>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs font-medium text-brand-dark/60 truncate">
                {[cat.color, cat.age].filter(Boolean).join(" · ") || "Unknown"}
              </p>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-baseline gap-1.5 text-[11px] truncate">
                {hideLocation ? null : (
                  <>
                    <span className="font-semibold uppercase tracking-wider text-brand-green/80">
                      Loc
                    </span>
                    <span className="font-medium text-brand-dark/80 truncate">
                      {cat.spot_last_seen || "Unknown"}
                    </span>
                    <span className="text-brand-dark/30">·</span>
                  </>
                )}
                <span className="font-medium tabular-nums text-brand-dark/60">
                  {dateLabel ?? formatDate(cat.date_last_seen)}
                </span>
              </p>
              {action !== "none" ? (
                <ActionAffordance type={action} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
    return wrap(inner, href);
  }

  // ── DEFAULT (grid card, photo top) ───────────────────────────────────────
  if (variant === "default") {
    const inner = (
      <div className={`${baseShell} flex-col ${hoverShell} ${className}`}>
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 w-1 ${rail}`}
        />
        <div className="relative p-2 pl-3">
          <CatPhoto
            photoUrl={cat.photo_url}
            name={cat.name}
            position={positionFromCat(cat)}
            className="aspect-square w-full rounded-lg ring-1 ring-brand-green/10"
          />
          {statusChip ? (
            <span
              className={`absolute right-3 top-3 inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold backdrop-blur ${statusChip.cls}`}
            >
              {statusChip.label}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between px-3 pb-2.5 pt-1 pl-3.5">
          <div>
            <div className="flex items-start justify-between gap-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <h3 className="truncate font-heading text-base font-bold leading-tight tracking-tight text-brand-dark">
                    {cat.name || "Unnamed"}
                  </h3>
                  {sex ? (
                    <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-brand-green/15 px-1 text-[10px] font-bold text-brand-green">
                      {sex}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-[11px] font-medium text-brand-dark/60">
                  {[cat.color, cat.age].filter(Boolean).join(" · ") || "Unknown"}
                </p>
              </div>
              {action !== "none" ? <ActionAffordance type={action} /> : null}
            </div>
            {extraChips ? (
              <div className="mt-1 flex flex-wrap gap-1">{extraChips}</div>
            ) : null}
          </div>
          <p className="flex min-w-0 items-baseline gap-1 text-[10px]">
            <span className="shrink-0 font-semibold uppercase tracking-wider text-brand-green/80">
              Region
            </span>
            <span className="truncate font-medium text-brand-dark/75">
              {region_name || "—"}
            </span>
          </p>
        </div>
      </div>
    );
    return wrap(inner, href);
  }

  // ── WIDE (detail header / featured row) ─────────────────────────────────
  const inner = (
    <div className={`${baseShell} ${hoverShell} ${className}`}>
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${rail}`} />
      <div className="flex w-full items-stretch gap-4 p-3 pl-4">
        <CatPhoto
          photoUrl={cat.photo_url}
          name={cat.name}
          position={positionFromCat(cat)}
          className="h-32 w-32 shrink-0 rounded-xl ring-1 ring-brand-green/10"
          sizes="128px"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-2xl font-bold leading-tight tracking-tight text-brand-dark truncate">
                {cat.name || "Unnamed"}
              </h3>
              {sex ? (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-green/15 px-1.5 text-sm font-bold text-brand-green">
                  {sex}
                </span>
              ) : null}
              {statusChip ? (
                <Chip cls={statusChip.cls}>{statusChip.label}</Chip>
              ) : null}
            </div>
            <p className="mt-1 text-sm font-medium text-brand-dark/60 truncate">
              {[cat.color, cat.age].filter(Boolean).join(" · ") || "Unknown"}
            </p>
            {extraChips ? (
              <div className="mt-2 flex flex-wrap gap-1.5">{extraChips}</div>
            ) : null}
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div
              className={`grid ${hideLocation ? "grid-cols-1" : "grid-cols-2"} gap-x-4 gap-y-1 text-[11px]`}
            >
              {hideLocation ? null : (
                <Field label="Loc" value={cat.spot_last_seen || "Unknown"} />
              )}
              <Field
                label="Seen"
                value={dateLabel ?? formatDate(cat.last_updated_at)}
              />
            </div>
            {action !== "none" ? (
              <ActionAffordance type={action} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
  return wrap(inner, href);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-green/80">
        {label}
      </span>
      <span className="truncate text-xs font-semibold text-brand-dark/85">
        {value}
      </span>
    </div>
  );
}

function ActionAffordance({ type }: { type: Action }) {
  if (type === "kebab") {
    return (
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-dark/5 text-brand-dark/60 transition-colors group-hover:bg-brand-dark group-hover:text-white"
      >
        <MoreHorizontalIcon className="h-4 w-4" />
      </span>
    );
  }
  if (type === "chevron") {
    return (
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-dark/5 text-brand-dark/60 transition-all group-hover:translate-x-0.5 group-hover:bg-brand-orange group-hover:text-white"
      >
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </span>
    );
  }
  return null;
}

function wrap(node: ReactNode, href?: string) {
  if (href) {
    return (
      <Link href={href} className="block">
        {node}
      </Link>
    );
  }
  return node;
}
