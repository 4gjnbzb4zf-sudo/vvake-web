/**
 * Phone trust (ADR-0067, the app's lib/sessionReview.ts lines): the one calm line a phone-only session's flags call
 * for in the journal, or null. Never an accusation; the session stays in the journal and the streak either way.
 */
export interface TrustStrings {
  trustReduced: string;
  trustHeld: string;
  trustDuplicate: string;
  trustReview: string;
  trustCleared: string;
  indoorSteps: string;
  indoorBudget: string;
}

const ORDER: [string, keyof TrustStrings][] = [
  ["trust_cleared", "trustCleared"],
  ["trust_duplicate", "trustDuplicate"],
  ["trust_held", "trustHeld"],
  ["trust_reduced", "trustReduced"],
  ["trust_review", "trustReview"],
  ["move_indoor_budget", "indoorBudget"],
  ["indoor_budget", "indoorBudget"],
  ["indoor_steps", "indoorSteps"],
];

export function trustLine(flags: readonly string[], t: TrustStrings): string | null {
  for (const [flag, key] of ORDER) if (flags.includes(flag)) return t[key];
  return null;
}
