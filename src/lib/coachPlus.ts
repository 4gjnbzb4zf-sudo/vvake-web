/**
 * Is VVake Coach Plus on for this account? (ADR-0051: VVake Coach Plus and Coach Premium; early testers get Premium.)
 * Plus is active while `plusUntil` is in the future; Premium and early testers are Plus too. An API that sends no
 * `plusUntil` falls back to the plan or tier ("plus", "premium", or "pro" before the rename). Pure (coachPlus.test.ts).
 */
export interface PlusFields {
  plan?: string | null;
  plusUntil?: string | null;
  tier?: string | null;
  earlyTester?: boolean | null;
}

const PAID = new Set(["plus", "premium", "pro"]);

export function coachPlusActive(me: PlusFields | null | undefined, now: number = Date.now()): boolean {
  if (!me) return false;
  if (me.earlyTester === true) return true;
  if (me.plusUntil) {
    const t = Date.parse(me.plusUntil);
    if (Number.isFinite(t)) return t > now;
  }
  return PAID.has(me.tier ?? "") || PAID.has(me.plan ?? "");
}

// ── Plan names (founder 2026-10-27: Premium says Premium everywhere, Plus says Plus) ─────────────────────────────

export type CoachTierKey = "free" | "plus" | "premium";

/** The names people see (ADR-0051 amendment, 2026-10-22): brand names, the same in English and French. */
export const COACH_TIER_NAMES: Readonly<Record<CoachTierKey, { name: string; short: string }>> = {
  free: { name: "Free", short: "Free" },
  plus: { name: "VVake Coach Plus", short: "Coach Plus" },
  premium: { name: "VVake Coach Premium", short: "Coach Premium" },
};

/** A tier from the API: the legacy "pro" (before 2026-10-22) is "premium"; anything unknown is null. Mirrors game-core. */
export function normalizeTier(t: unknown): CoachTierKey | null {
  const s = typeof t === "string" ? t.toLowerCase() : t;
  if (s === "pro" || s === "premium") return "premium";
  if (s === "plus" || s === "free") return s;
  return null;
}

/** The paid plan a line about "your plan" names: Premium for Premium, else Plus (the lowest paid plan). Mirrors game-core. */
export function ownPlanTier(t: unknown): "plus" | "premium" {
  return normalizeTier(t) === "premium" ? "premium" : "plus";
}

/**
 * A plan's name: "VVake Coach Premium", or "Coach Premium" (short). Free is "Gratuit" in French. Unknown reads as Free.
 * Mirrors game-core's coachTierName (packages/game-core/src/coachPlans.ts).
 */
export function coachTierName(tier: unknown, lang: string = "en", form: "name" | "short" = "name"): string {
  const t = normalizeTier(tier) ?? "free";
  if (t === "free") return lang === "fr" ? "Gratuit" : "Free";
  return COACH_TIER_NAMES[t][form];
}

/**
 * The account's plan from /v1/me: Premium for the tier "premium" (or "pro"), a "premium" plan, or an early tester
 * (testers get Premium for the beta); Plus for the tier or plan "plus", or Plus on by date; else free.
 */
export function accountTier(me: PlusFields | null | undefined, now: number = Date.now()): CoachTierKey {
  if (!me) return "free";
  const t = normalizeTier(me.tier) ?? normalizeTier(me.plan);
  if (t === "premium" || me.earlyTester === true) return "premium";
  if (t === "plus") return "plus";
  return coachPlusActive(me, now) ? "plus" : "free";
}

/**
 * The name of the person's own plan for a line about it ("{plan} until…", "With {plan} every line…"): their plan
 * when they have one (testers: Premium), else Plus, for upsell lines a free account sees.
 */
export function ownPlanName(me: PlusFields | null | undefined, form: "name" | "short" = "name", now: number = Date.now()): string {
  return COACH_TIER_NAMES[ownPlanTier(accountTier(me, now))][form];
}
