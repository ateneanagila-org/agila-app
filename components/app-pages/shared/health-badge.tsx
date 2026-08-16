import type { BadgeTone } from "@/lib/health-display";

const TONE_CLASSES: Record<BadgeTone, string> = {
  affirmative: "bg-brand-green/12 text-brand-green",
  muted: "bg-brand-dark/8 text-brand-dark/50",
  unknown: "bg-brand-dark/5 text-brand-dark/40",
};

/**
 * Takes a label and a tone rather than a state, because the health rows do not
 * share one vocabulary — Neutered/Sick/Injured are yes/no/unknown while
 * Vaccinated is unknown/vaccinated/expired. Each domain module maps its own
 * states to a tone.
 */
export function HealthBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-bold tracking-wide ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}
