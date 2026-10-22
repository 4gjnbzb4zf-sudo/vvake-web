/**
 * Coach plans (monorepo ADR-0051): the planned prices, USD, shown with "Coming soon" on vvake.com/<lang>/plans/. The same
 * defaults as the API ([vars.COACH_PLANS], game-core coachPlans.ts); they pass the founder's pricing rule (our margin
 * is at least the store's cut) at $0.08 a live minute.
 */
export const COACH_PLAN_PRICES = { plus: 6.99, premium: 11.99 } as const;
/**
 * What each plan includes (the API's defaults): live coach minutes a week, new cloud-voice characters a day, and coach
 * calls (VVake Coach Plus up to 3 a week, "normal"; VVake Coach Premium up to 1 a day, "chatty").
 */
export const COACH_PLAN_LIMITS = {
  plus: { liveMinutesWeek: 5, voiceCharsDay: 1000, calls: 3 },
  premium: { liveMinutesWeek: 15, voiceCharsDay: 2000, calls: 1 },
} as const;
export const COACH_PACKS = [
  { minutes: 5, usd: 1.49 },
  { minutes: 10, usd: 2.49 },
  { minutes: 15, usd: 3.49 },
] as const;
