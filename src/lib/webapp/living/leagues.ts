// Copied from VVFit packages/game-core/src/leagues.ts (52bdd17f 2026-10-28) by scripts/sync-living-core.ts. Do not edit: re-sync.
/**
 * Weekly leagues (habit engine): cohorts of ~30 movers, top ranks promote, bottom ranks demote.
 * Adapted for fitness: the score rewards showing up and beating your own baseline, and is capped
 * so extra days or extreme volume never pay (rest days are protected).
 */
export const LEAGUE_TIERS = ["warmup", "jog", "tempo", "threshold", "peak", "legend"] as const;
export type LeagueTier = (typeof LEAGUE_TIERS)[number];

export interface WeeklyActivity {
  /** Days with at least one valid session this week (0–7). */
  activeDays: number;
  /** Pool-eligible effort this week. */
  effort: number;
  /** The user's own 4-week average weekly effort (0 for new users). */
  baselineEffort: number;
}

export interface LeagueScoreConfig {
  /** Active days beyond this earn nothing extra: 2 rest days a week are protected. */
  maxCountedDays: number;
  pointsPerDay: number;
  /** Progress ratio (effort ÷ baseline) is capped here. */
  maxProgressRatio: number;
  pointsPerProgress: number;
}

export const DEFAULT_LEAGUE_SCORE: LeagueScoreConfig = {
  maxCountedDays: 5,
  pointsPerDay: 20,
  maxProgressRatio: 1.5,
  pointsPerProgress: 100,
};

/**
 * Consistency (up to 5 days × 20) + progress vs own baseline (up to 1.5 × 100) = max 250.
 * New users are scored on consistency plus a neutral progress of 1.0 while their baseline builds.
 */
export function weeklyLeagueScore(a: WeeklyActivity, cfg: LeagueScoreConfig = DEFAULT_LEAGUE_SCORE): number {
  const days = Math.min(Math.max(0, Math.floor(a.activeDays)), cfg.maxCountedDays);
  const ratio = a.baselineEffort > 0 ? Math.max(0, a.effort) / a.baselineEffort : a.effort > 0 ? 1 : 0;
  const progress = Math.min(ratio, cfg.maxProgressRatio);
  return Math.round(days * cfg.pointsPerDay + progress * cfg.pointsPerProgress);
}

export interface LeagueMember {
  id: string;
  score: number;
}

export interface LeagueRules {
  promote: number;
  demote: number;
}

export const DEFAULT_LEAGUE_RULES: LeagueRules = { promote: 7, demote: 5 };

export type LeagueOutcome = "promoted" | "stayed" | "demoted";

export interface LeagueResult {
  id: string;
  rank: number;
  outcome: LeagueOutcome;
  nextTier: LeagueTier;
}

/**
 * Ranks a cohort and decides moves. Members with a score of 0 (no activity) never promote.
 * Nobody demotes from the lowest tier or promotes past the top; ties break by id for determinism.
 */
export function resolveLeague(
  members: readonly LeagueMember[],
  tier: LeagueTier,
  rules: LeagueRules = DEFAULT_LEAGUE_RULES,
  /** Members resting (a sick / injured / time-off pause, or a recovery week): never demoted (journey.md §leagues). */
  protect: ReadonlySet<string> = new Set(),
): LeagueResult[] {
  const tierIndex = LEAGUE_TIERS.indexOf(tier);
  const sorted = [...members].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return sorted.map((m, i) => {
    const rank = i + 1;
    let outcome: LeagueOutcome = "stayed";
    if (rank <= rules.promote && m.score > 0 && tierIndex < LEAGUE_TIERS.length - 1) outcome = "promoted";
    else if (rank > sorted.length - rules.demote && tierIndex > 0 && !protect.has(m.id)) outcome = "demoted";
    const next = outcome === "promoted" ? tierIndex + 1 : outcome === "demoted" ? tierIndex - 1 : tierIndex;
    return { id: m.id, rank, outcome, nextTier: LEAGUE_TIERS[next]! };
  });
}

// ── Cohorts (wired by the API: GET /v1/leagues/me, docs/02-product/journey.md) ─────────────────────────────────

/** Movers per cohort. */
export const LEAGUE_COHORT_SIZE = 30;
/** A cohort smaller than this at settle time only promotes (nobody demotes in a near-empty room). */
export const LEAGUE_MIN_TO_DEMOTE = 10;

/**
 * The league region: the athlete's home city key (the one City Clash uses, chosen by the athlete, never a position),
 * else their time zone's region, else "world". Never more precise than a city. Pure.
 */
export function leagueRegion(cityKey: string | null | undefined, tz: string | null | undefined): string {
  if (cityKey) return `city:${cityKey}`;
  if (tz && /^[A-Za-z_]+\/[A-Za-z_\-/]+$/.test(tz)) return `tz:${tz}`;
  return "world";
}

/** Rules for a cohort of `size`: rooms under 3 stay as they are, small rooms never demote, and promote/demote never overlap. Pure. */
export function leagueRulesFor(size: number, base: LeagueRules = DEFAULT_LEAGUE_RULES): LeagueRules {
  if (size < 3) return { promote: 0, demote: 0 };
  if (size < LEAGUE_MIN_TO_DEMOTE) return { promote: Math.min(base.promote, Math.max(1, Math.floor(size / 3))), demote: 0 };
  const promote = Math.min(base.promote, Math.floor(size / 3));
  return { promote, demote: Math.min(base.demote, Math.max(0, size - promote - 1)) };
}

const TIER_NAME: Record<LeagueTier, { en: string; fr: string }> = {
  warmup: { en: "Warm-up", fr: "Échauffement" },
  jog: { en: "Jog", fr: "Footing" },
  tempo: { en: "Tempo", fr: "Tempo" },
  threshold: { en: "Threshold", fr: "Seuil" },
  peak: { en: "Peak", fr: "Pic" },
  legend: { en: "Legend", fr: "Légende" },
};

export const leagueTierName = (t: LeagueTier, lang: "en" | "fr"): string => TIER_NAME[t][lang];

/**
 * The Monday result card's line: promoted, stayed, a lighter week, or "new week, new league" (never "demoted" in
 * words, no shame). Pure.
 */
export function leagueResultText(outcome: LeagueOutcome, next: LeagueTier, lang: "en" | "fr", lighterWeek = false): string {
  const name = leagueTierName(next, lang);
  if (outcome === "promoted")
    return lang === "fr" ? `Tu montes en ligue ${name}. Belle régularité !` : `Up to the ${name} league. Lovely consistency!`;
  if (outcome === "demoted") return lang === "fr" ? `Nouvelle semaine, nouvelle ligue : ${name}.` : `New week, new league: ${name}.`;
  if (lighterWeek) return lang === "fr" ? `Une semaine plus légère, tu restes en ${name}.` : `A lighter week, you stay in ${name}.`;
  return lang === "fr" ? `Tu restes en ligue ${name}.` : `You stay in the ${name} league.`;
}
