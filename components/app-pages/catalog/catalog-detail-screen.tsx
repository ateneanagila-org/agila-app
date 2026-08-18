import Link from "next/link";
import { displayCatField } from "@/lib/utils";
import { CatPhotoButton } from "@/components/app-pages/shared/photo-lightbox";
import { positionFromCat } from "@/lib/photo-position";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
} from "@/components/app-pages/shared/icons";

import type { SelectCatHealthRecord } from "@/lib/validation/cats";
import type { CatWithRegion } from "@/lib/repo/cats.repo";
import {
  getVaccinationState,
  VACCINATION_LABELS,
  vaccinationTone,
} from "@/lib/vaccination";
import {
  neuteredState,
  conditionFlags,
  triStateLabel,
  triStateTone,
} from "@/lib/health-display";
import { HealthBadge } from "@/components/app-pages/shared/health-badge";

type CatalogDetailScreenProps = {
  cat: CatWithRegion;
  healthRecord: SelectCatHealthRecord | null;
  adoptFosterUrl: string;
};

function sexGlyph(s: string | null | undefined): string | null {
  if (s === "Male") return "♂";
  if (s === "Female") return "♀";
  return null;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-dark/50">
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-brand-dark">
        {value || "—"}
      </span>
    </div>
  );
}

export function CatalogDetailScreen({
  cat,
  healthRecord,
  adoptFosterUrl,
}: CatalogDetailScreenProps) {
  const sex = sexGlyph(cat.sex);
  const neutered = neuteredState(healthRecord?.is_neutered);
  const { sick, injured } = conditionFlags(healthRecord?.condition);
  const vaccinationState = getVaccinationState(
    healthRecord?.vaccination_date ?? null,
  );

  const profileFields: { label: string; value: React.ReactNode }[] = [
    {
      label: "Sex",
      value: cat.sex ? (sex ? `${cat.sex} ${sex}` : cat.sex) : "Unknown",
    },
    { label: "Size / Age", value: displayCatField(cat.age) },
    { label: "Color", value: displayCatField(cat.color) },
    { label: "Sociability", value: displayCatField(cat.sociability) },
    { label: "Region", value: cat.region_name ?? "—" },
  ];

  const healthFields: { label: string; value: React.ReactNode }[] = [
    {
      label: "Neutered",
      value: <HealthBadge label={triStateLabel(neutered)} tone={triStateTone(neutered)} />,
    },
    {
      label: "Vaccinated",
      value: (
        <HealthBadge
          label={VACCINATION_LABELS[vaccinationState]}
          tone={vaccinationTone(vaccinationState)}
        />
      ),
    },
    {
      label: "Sick",
      value: <HealthBadge label={triStateLabel(sick)} tone={triStateTone(sick)} />,
    },
    {
      label: "Injured",
      value: <HealthBadge label={triStateLabel(injured)} tone={triStateTone(injured)} />,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-14 tablet:px-8 tablet:pt-8 tablet:pb-20">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-dark/60 transition-colors hover:text-brand-dark"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back
        </Link>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-orange">
          Adopt &middot; Foster
        </span>
      </div>

      {/* Hero — photo + meta + apply CTA */}
      <div className="grid gap-6 tablet:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] tablet:items-start tablet:gap-10">
        <div className="relative">
          <CatPhotoButton
            catId={cat.id}
            photoUrl={cat.photo_url}
            name={cat.name}
            position={positionFromCat(cat)}
            canEdit={false}
            className="aspect-square w-full rounded-3xl ring-1 ring-brand-dark/10"
            iconClassName="h-16 w-16 text-brand-green/30"
            sizes="(min-width: 768px) 50vw, 100vw"
          />
        </div>

        <div className="flex flex-col">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange">
            Meet
          </p>
          <h1 className="mt-1 font-heading text-4xl font-bold leading-[1.05] tracking-tight text-brand-dark tablet:text-5xl">
            {cat.name || "Unnamed"}
            {sex ? (
              <span className="ml-2 align-middle text-2xl font-bold text-brand-green tablet:text-3xl">
                {sex}
              </span>
            ) : null}
          </h1>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {cat.color ? (
              <span className="inline-flex h-7 items-center rounded-full bg-brand-cream-dark/60 px-3 text-xs font-semibold text-brand-dark/80">
                {cat.color}
              </span>
            ) : null}
            {cat.age ? (
              <span className="inline-flex h-7 items-center rounded-full bg-brand-cream-dark/60 px-3 text-xs font-semibold text-brand-dark/80">
                {cat.age}
              </span>
            ) : null}
            {cat.sociability ? (
              <span className="inline-flex h-7 items-center rounded-full bg-brand-cream-dark/60 px-3 text-xs font-semibold text-brand-dark/80">
                {cat.sociability}
              </span>
            ) : null}
          </div>

          {/* Date only — never the specific spot. A precise location is an
              internal field for finding a cat during a census; publishing it for
              a live animal on a search-indexed page is not something the public
              needs. The region shown elsewhere is as granular as this gets. */}
          {cat.date_last_seen || cat.last_updated_at ? (
            <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-brand-dark/65">
              {cat.date_last_seen ? (
                <>
                  <span className="font-bold uppercase tracking-wider text-brand-green/80 text-[11px]">
                    Last seen
                  </span>
                  <span className="font-semibold tabular-nums text-brand-dark/80">
                    {new Date(cat.date_last_seen).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </>
              ) : null}
              {cat.last_updated_at ? (
                <span className="text-xs tabular-nums text-brand-dark/50">
                  · updated{" "}
                  {new Date(cat.last_updated_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              ) : null}
            </p>
          ) : null}

          <a
            href={adoptFosterUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex items-center justify-center gap-2 self-start rounded-full bg-brand-orange px-7 py-3 text-sm font-bold tracking-wide text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            Apply to Adopt/Foster
            <ExternalLinkIcon className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Detail sections */}
      <div className="mt-12 grid gap-5 tablet:grid-cols-2 tablet:gap-6">
        <section className="rounded-3xl bg-white p-5 ring-1 ring-brand-dark/8 tablet:p-6">
          <h2 className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">
            Profile
          </h2>
          <div className="mt-3 divide-y divide-brand-dark/8">
            {profileFields.map((f) => (
              <DetailRow key={f.label} label={f.label} value={f.value} />
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 ring-1 ring-brand-dark/8 tablet:p-6">
          <h2 className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">
            Health
          </h2>
          <div className="mt-3 divide-y divide-brand-dark/8">
            {healthFields.map((f) => (
              <DetailRow key={f.label} label={f.label} value={f.value} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
