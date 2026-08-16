import { CATHEALTHRECORD_CONDITION_VALUES } from "@/lib/db/enums";

export type TriState = "yes" | "no" | "unknown";

/**
 * Declared here, not in the badge component, so both this module and
 * lib/vaccination.ts can map their own states to a tone without importing a
 * component — and so the badge imports from lib/, never the reverse.
 */
export type BadgeTone = "affirmative" | "muted" | "unknown";

export function triStateLabel(state: TriState): string {
  return state === "yes" ? "Yes" : state === "no" ? "No" : "Unknown";
}

export function triStateToValue(label: string): boolean | null {
  return label === "Yes" ? true : label === "No" ? false : null;
}

export function triStateTone(state: TriState): BadgeTone {
  return state === "yes" ? "affirmative" : state === "no" ? "muted" : "unknown";
}

export function neuteredState(value: boolean | null | undefined): TriState {
  return value === true ? "yes" : value === false ? "no" : "unknown";
}

/**
 * `condition` is a single enum whose four values exhaustively cover both
 * booleans, so "Healthy" is a positively recorded "not sick, not injured" —
 * not an inference from absence. Only null is genuinely unknown.
 *
 * Compared exactly rather than by substring: the previous `.includes("Sick")`
 * coupled display logic to enum spelling, so a renamed value or anything
 * containing the word would break it with no type error.
 */
export function conditionFlags(
  condition: string | null | undefined,
): { sick: TriState; injured: TriState } {
  const known = (CATHEALTHRECORD_CONDITION_VALUES as readonly string[]).includes(
    condition ?? "",
  );
  if (!known) return { sick: "unknown", injured: "unknown" };
  return {
    sick: condition === "Sick" || condition === "Sick and Injured" ? "yes" : "no",
    injured: condition === "Injured" || condition === "Sick and Injured" ? "yes" : "no",
  };
}
