// Copied from VVFit packages/game-core/src/celebrations.ts (52bdd17f 2026-10-28) by scripts/sync-living-core.ts. Do not edit: re-sync.
/**
 * Celebrations with the VVaker (living app §10.5, decision 15, docs/02-product/journey.md): which milestones a session
 * (or a sync) just crossed, and the one the apps celebrate. Full-screen 2–3 s: the VVaker reacts (the face), the coach
 * says one line (the voice), an earcon and a success haptic; then the brag card and the next step.
 *
 * At most one celebration per session (the highest in MILESTONE_PRIORITY; the rest show as small inline wins).
 * Celebrations are results, not suggestions: they stay in Quiet (silent unless voice is on; suggest.ts
 * `suggestAllowed('celebration', …)`) and never show during a workout. No loss words, no pressure. Pure.
 */
import { LEAGUE_TIERS, type LeagueTier } from "./leagues";
import { stageOf } from "./vvaker";

/** In priority order: the first one crossed is the session's celebration. */
export const MILESTONE_PRIORITY = [
  "goal_done",
  "chapter_done",
  "first_session",
  "new_stage",
  "streak_100",
  "weekly_12",
  "streak_30",
  "league_up",
  "stone",
  "first_week",
  "weekly_4",
  "streak_7",
  "pb",
  "skill_level",
  "level_up",
] as const;
export type MilestoneId = (typeof MILESTONE_PRIORITY)[number];

/** What the apps know before and after a session (or a sync): lifetime counters, never volume. */
export interface MilestoneSnapshot {
  /** Lifetime sessions (since the last fresh start). */
  sessions: number;
  /** Weeks kept so far (streakCare weekVerdict kept/rest), lifetime. */
  weeksKept: number;
  /** The daily streak (habit.ts) and the weekly streak (streakCare.ts). */
  streakDays: number;
  weeklyStreak: number;
  /** Personal bests so far (ghost / training score bests). */
  pbs: number;
  /** Journey stones passed and chapters done (journey.ts). */
  stones: number;
  chapters: number;
  /** VVaker level 1–50 (vvaker.ts levelFromEffort). */
  vvakerLevel: number;
  /** The league tier (leagues.ts); absent: not in a league. */
  leagueTier?: LeagueTier;
  /** Goals and races done. */
  goalsDone: number;
  /** Skill levels passed (all skills). */
  skillLevels: number;
}

const crossed = (before: number, after: number, at: number) => before < at && after >= at;
const tierIdx = (t: LeagueTier | undefined) => (t ? LEAGUE_TIERS.indexOf(t) : -1);

/** Every milestone crossed between the two snapshots, in priority order. Pure. */
export function milestonesFor(before: MilestoneSnapshot, after: MilestoneSnapshot): MilestoneId[] {
  const out = new Set<MilestoneId>();
  if (after.goalsDone > before.goalsDone) out.add("goal_done");
  if (after.chapters > before.chapters) out.add("chapter_done");
  if (crossed(before.sessions, after.sessions, 1)) out.add("first_session");
  if (after.vvakerLevel > before.vvakerLevel) {
    out.add("level_up");
    if (stageOf(after.vvakerLevel) !== stageOf(before.vvakerLevel)) out.add("new_stage");
  }
  if (crossed(before.streakDays, after.streakDays, 100)) out.add("streak_100");
  else if (crossed(before.streakDays, after.streakDays, 30)) out.add("streak_30");
  else if (crossed(before.streakDays, after.streakDays, 7)) out.add("streak_7");
  if (crossed(before.weeklyStreak, after.weeklyStreak, 12)) out.add("weekly_12");
  else if (crossed(before.weeklyStreak, after.weeklyStreak, 4)) out.add("weekly_4");
  // A promotion only between two known tiers (joining a league isn't one).
  if (before.leagueTier && after.leagueTier && tierIdx(after.leagueTier) > tierIdx(before.leagueTier)) out.add("league_up");
  if (after.stones > before.stones) out.add("stone");
  if (crossed(before.weeksKept, after.weeksKept, 1)) out.add("first_week");
  if (after.pbs > before.pbs) out.add("pb");
  if (after.skillLevels > before.skillLevels) out.add("skill_level");
  return MILESTONE_PRIORITY.filter((m) => out.has(m));
}

const LINES: Record<MilestoneId, { en: string; fr: string }> = {
  goal_done: {
    en: "You did it. Every week of work is in that finish.",
    fr: "Tu l’as fait. Chaque semaine de travail est dans cette arrivée.",
  },
  chapter_done: { en: "Chapter done. Look how far the path goes back.", fr: "Chapitre bouclé. Regarde tout le chemin derrière toi." },
  first_session: {
    en: "First one in. That’s the hardest step, and it’s taken.",
    fr: "La première est faite. C’était le pas le plus dur, et il est fait.",
  },
  new_stage: { en: "Your VVaker just grew up. All earned by you.", fr: "Ton VVaker vient de grandir. Tout ça, c’est toi." },
  streak_100: { en: "A hundred days. Moving is simply who you are now.", fr: "Cent jours. Bouger, c’est juste toi maintenant." },
  weekly_12: {
    en: "Twelve weeks in a row. That’s a season of consistency.",
    fr: "Douze semaines d’affilée. Une vraie saison de régularité.",
  },
  streak_30: { en: "Thirty days. This is a habit now.", fr: "Trente jours. C’est une habitude maintenant." },
  league_up: { en: "Up a league. Steady weeks pay off.", fr: "Tu montes de ligue. Les semaines régulières paient." },
  stone: { en: "Stone passed. One more step on your path.", fr: "Étape franchie. Un pas de plus sur ton chemin." },
  first_week: { en: "Your first full week. That’s how it starts.", fr: "Ta première semaine complète. C’est comme ça que ça commence." },
  weekly_4: { en: "Four weeks in a row. Your body is noticing.", fr: "Quatre semaines d’affilée. Ton corps le sent." },
  streak_7: { en: "Seven days in a row. Nice rhythm.", fr: "Sept jours d’affilée. Joli rythme." },
  pb: { en: "A personal best. Well earned.", fr: "Un record perso. Bien mérité." },
  skill_level: { en: "New skill level. Patience pays.", fr: "Nouveau niveau de compétence. La patience paie." },
  level_up: { en: "Your VVaker levelled up.", fr: "Ton VVaker monte de niveau." },
};

/** The coach's one line for a milestone (EN/FR, said in the athlete's chosen voice when voice is on). */
export const milestoneLine = (id: MilestoneId, lang: "en" | "fr"): string => LINES[id][lang];

/** How the VVaker reacts (the apps map each to an animation; Reduce Motion: a still image). */
export type VVakerReaction = "jump" | "flex" | "medal" | "wave";
const REACTION: Record<MilestoneId, VVakerReaction> = {
  goal_done: "medal",
  chapter_done: "medal",
  first_session: "jump",
  new_stage: "flex",
  streak_100: "medal",
  weekly_12: "medal",
  streak_30: "jump",
  league_up: "jump",
  stone: "wave",
  first_week: "jump",
  weekly_4: "flex",
  streak_7: "wave",
  pb: "flex",
  skill_level: "flex",
  level_up: "wave",
};

export interface MilestoneCelebration {
  id: MilestoneId;
  line: string;
  reaction: VVakerReaction;
  /** The other milestones crossed: small inline wins, no takeover. */
  also: MilestoneId[];
}

/** The session's one celebration (max 1 per session), or null when nothing was crossed. Pure. */
export function celebrationFor(before: MilestoneSnapshot, after: MilestoneSnapshot, lang: "en" | "fr"): MilestoneCelebration | null {
  const all = milestonesFor(before, after);
  const top = all[0];
  if (!top) return null;
  return { id: top, line: milestoneLine(top, lang), reaction: REACTION[top], also: all.slice(1) };
}
