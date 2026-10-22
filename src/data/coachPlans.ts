/**
 * Coach plans (monorepo ADR-0051): the planned prices, USD, shown with "Coming soon" on vvake.com/<lang>/plans/. The same
 * defaults as the API ([vars.COACH_PLANS], game-core coachPlans.ts); they pass the founder's pricing rule (our margin
 * is at least the store's cut) at $0.08 a live minute.
 */
export const COACH_PLAN_PRICES = { plus: 6.99, premium: 11.99 } as const;
export const COACH_PACKS = [
  { minutes: 5, usd: 1.49 },
  { minutes: 10, usd: 2.49 },
  { minutes: 15, usd: 3.49 },
] as const;
