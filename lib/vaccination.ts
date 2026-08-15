import { monthsSince } from "@/lib/utils";

/**
 * Vaccination state derivation.
 *
 * The database stores exactly one untyped `cat_health_records.vaccination_date`
 * (sheet col Q, "Date of Vaccination"). There is no vaccine type and no dose
 * number, and in practice the value is a TNVR clinic date — 68 of the 71
 * populated rows equal that cat's neuter date.
 *
 * The 12-month window below is therefore AGILA's own annual TNVR cadence, not a
 * clinical titre. It is deliberately confined to this module and surfaced only as
 * a state label and a filter option — never as an alarm chip or a per-cat verdict
 * rendered over the animal. If a vaccine-type field ever arrives, this is the one
 * place to revisit.
 */

export const VACCINATION_EXPIRY_MONTHS = 12;

export type VaccinationState = "unknown" | "vaccinated" | "expired";

export const VACCINATION_LABELS: Record<VaccinationState, string> = {
  unknown: "Unknown",
  vaccinated: "Vaccinated",
  expired: "Expired",
};

/** Filter options, ordered most-to-least actionable. */
export const VACCINATION_FILTER_OPTIONS = [
  VACCINATION_LABELS.vaccinated,
  VACCINATION_LABELS.expired,
  VACCINATION_LABELS.unknown,
] as const;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * `unknown` means no usable date — never "not vaccinated". 83% of live cats have
 * no date at all, so conflating absence with a negative would misreport most of
 * the census.
 */
export function getVaccinationState(
  value: Date | string | null | undefined,
  now: Date = new Date(),
): VaccinationState {
  const date = toDate(value);
  if (!date) return "unknown";

  const months = monthsSince(date, now);

  // Closed boundary: exactly VACCINATION_EXPIRY_MONTHS still counts as current.
  // But "exactly" means the day of month must match too. When months == 12 but
  // we've passed the day (e.g., Aug 14 → Aug 15 next year), we're past the window.
  if (months < VACCINATION_EXPIRY_MONTHS) {
    return "vaccinated";
  }
  if (months === VACCINATION_EXPIRY_MONTHS && now.getDate() === date.getDate()) {
    return "vaccinated";
  }
  return "expired";
}
