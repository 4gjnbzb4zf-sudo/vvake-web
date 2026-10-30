// Copied from VVFit packages/game-core/src/adaptiveProposals.ts (15193a8f 2026-10-30) by scripts/sync-adaptive-core.ts. Do not edit: re-sync.
/**
 * Proposals from the athlete model (build 62, ADR-0069): what VVake suggests changing, with the reasons in plain
 * words. Never applied silently: each one becomes a coach settings proposal (ADR-0038 / ADR-0063 card) the athlete
 * accepts or not, and every accepted change can be undone for 30 days.
 *
 * Health-first rules (ADR-0002, C19):
 * - Safety first: a strained day or a load spike → a lighter week (deload). Rest is always a fine answer; nothing
 *   ever pushes through fatigue.
 * - More load only when fresh, consistent (3 weeks of 2+ sessions), the goal behind, at most +10%, never with a
 *   health condition, an injury, or effort by feel.
 * - Zones and paces only on confident evidence (≥ 0.7, health first, then sensors); below that VVake asks first
 *   (athleteModel confirmQuestion). Max heart rate is only ever raised from data, never lowered.
 * - Goals: when even the fastest safe progression falls short, a later date or a shorter event: the athlete's call.
 * - Cool-down: a proposal the athlete turned down is not offered again for 14 days, one accepted not for 7.
 * - Quiet (suggest.ts): only safety proposals come forward; the others wait on the Your progress screen.
 * - At most 2 at a time, safety first. Pure.
 */
import type { AthleteModel, ModelProfile } from "./athleteModel";
import type { SeasonGoalProgress } from "./goalProgress";
import { addDays, dayNum, EVENT_PRESETS, mondayOf, type EventKind, type SeasonGoal } from "../living/seasonGoals";
import type { SeasonEditDraft, SeasonSession } from "./seasonWeekTypes";
import type { SuggestLevel } from "../suggest/suggest";

type Lang = "en" | "fr";

export const INSIGHT_KINDS = [
  "deload",
  "load_down",
  "load_up",
  "max_hr",
  "resting_hr",
  "pace_zones",
  "goal_postpone",
  "goal_resize",
] as const;
export type InsightKind = (typeof INSIGHT_KINDS)[number];

export type InsightReason =
  | "strained"
  | "tired"
  | "load_spike"
  | "fresh_consistent_behind"
  | "max_seen"
  | "max_health"
  | "resting_health"
  | "speed_hr"
  | "goal_at_risk";

export interface InsightChange {
  /** settings fields (coach settings proposals, ADR-0038). */
  maxHr?: number;
  restingHr?: number;
  /** Pace / speed zones of a sport, km/h. */
  pace?: { sport: string; easy: number; hard: number };
  /** This week's remaining sessions: minutes × scale (and the week marked easier when deload). */
  load?: { scale: number; week: string; deload?: boolean };
  /** A season goal: a later date, or a shorter event of the same kind. */
  goal?: { id: string; op: "postpone" | "resize"; date?: string; event?: EventKind; distanceM?: number };
}

export interface InsightProposal {
  /** Dedupe key (kind + what it is about). */
  key: string;
  kind: InsightKind;
  /** A health/safety proposal: shown even in Quiet. */
  safety: boolean;
  reasons: InsightReason[];
  change: InsightChange;
  /** For the card's "from → to" lines. */
  from?: { maxHr?: number; restingHr?: number; pace?: { easy: number; hard: number }; date?: string; event?: EventKind };
  confidence: number;
}

export interface InsightInput {
  model: AthleteModel;
  profile: ModelProfile;
  goals: readonly SeasonGoal[];
  progress: readonly SeasonGoalProgress[];
  /** Health switches (device copy or server's yes/no): any blocks load_up. */
  health?: { condition?: boolean; injury?: boolean; easyOnly?: boolean };
  /** Last decisions per key. */
  decisions: readonly { key: string; status: "accepted" | "rejected" | "pending" | "undone" | "expired" | "superseded"; at: string }[];
  /** A season plan exists (load proposals change its week). */
  hasSeason: boolean;
  suggestLevel: SuggestLevel;
}

const MAX_OUT = 2;
const isGoal = (o: InsightProposal) => o.kind === "goal_postpone" || o.kind === "goal_resize";
const REJECT_COOLDOWN_DAYS = 14;
const ACCEPT_COOLDOWN_DAYS = 7;

/** The proposals worth making now, safety first. Pure. */
export function insightProposals(x: InsightInput): InsightProposal[] {
  const { model: m, profile: p } = x;
  const today = m.today;
  const week = mondayOf(today);
  const out: InsightProposal[] = [];
  const r = m.readiness;
  const acwr = m.load.acwr ?? 0;

  // Safety: lighter week.
  if (x.hasSeason) {
    if (r.level === "strained" || (acwr > 1.5 && m.load.fitness >= 10)) {
      out.push({
        key: `deload:${week}`,
        kind: "deload",
        safety: true,
        reasons: [
          r.level === "strained" ? "strained" : "load_spike",
          ...(acwr > 1.5 && r.level === "strained" ? (["load_spike"] as InsightReason[]) : []),
        ],
        change: { load: { scale: 0.6, week, deload: true } },
        confidence: 0.8,
      });
    } else if (r.level === "tired" || (acwr > 1.3 && m.load.fitness >= 10)) {
      out.push({
        key: `load_down:${week}`,
        kind: "load_down",
        safety: true,
        reasons: [r.level === "tired" ? "tired" : "load_spike"],
        change: { load: { scale: 0.8, week } },
        confidence: 0.7,
      });
    }
  }

  // Heart parameters (never with effort by feel).
  if (!p.effortByFeel) {
    const mx = m.params.maxHr;
    if (mx && mx.confidence >= 0.7 && (p.maxHr === undefined || mx.value >= p.maxHr + 4)) {
      out.push({
        key: `max_hr:${mx.value}`,
        kind: "max_hr",
        safety: false,
        reasons: [mx.source === "health" ? "max_health" : "max_seen"],
        change: { maxHr: mx.value },
        ...(p.maxHr ? { from: { maxHr: p.maxHr } } : {}),
        confidence: mx.confidence,
      });
    }
    const rh = m.params.restingHr;
    if (rh && rh.source === "health" && rh.confidence >= 0.7 && (p.restingHr === undefined || Math.abs(rh.value - p.restingHr) >= 3)) {
      out.push({
        key: `resting_hr:${rh.value}`,
        kind: "resting_hr",
        safety: false,
        reasons: ["resting_health"],
        change: { restingHr: rh.value },
        ...(p.restingHr ? { from: { restingHr: p.restingHr } } : {}),
        confidence: rh.confidence,
      });
    }
    for (const [sport, sp] of Object.entries(m.params.sports)) {
      const cur = p.speed?.[sport];
      const e = sp.easyKmh;
      if (!e || e.confidence < 0.7) continue;
      const easy = Math.round(e.value * 10) / 10;
      const hardEst = sp.hardKmh && sp.hardKmh.confidence >= 0.6 ? sp.hardKmh.value : cur ? cur.hard * (easy / cur.easy) : easy * 1.3;
      const hard = Math.round(Math.max(easy * 1.1, hardEst) * 10) / 10;
      if (cur && Math.abs(easy - cur.easy) / cur.easy < 0.05) continue;
      out.push({
        key: `pace:${sport}:${easy}`,
        kind: "pace_zones",
        safety: false,
        reasons: ["speed_hr"],
        change: { pace: { sport, easy, hard } },
        ...(cur ? { from: { pace: { easy: cur.easy, hard: cur.hard } } } : {}),
        confidence: e.confidence,
      });
    }
  }

  // Goals at risk even in the safe best case.
  for (const g of x.progress) {
    if (g.trend !== "at_risk") continue;
    const goal = x.goals.find((s) => s.id === g.goalId && !s.doneAt);
    if (!goal?.event) continue;
    if (g.postponeDate && dayNum(g.postponeDate) - dayNum(goal.date) <= 26 * 7) {
      out.push({
        key: `goal_postpone:${goal.id}`,
        kind: "goal_postpone",
        safety: false,
        reasons: ["goal_at_risk"],
        change: { goal: { id: goal.id, op: "postpone", date: g.postponeDate } },
        from: { date: goal.date },
        confidence: 0.7,
      });
    } else if (g.resizeTo) {
      out.push({
        key: `goal_resize:${goal.id}`,
        kind: "goal_resize",
        safety: false,
        reasons: ["goal_at_risk"],
        change: { goal: { id: goal.id, op: "resize", event: g.resizeTo, distanceM: EVENT_PRESETS[g.resizeTo].distanceM } },
        from: { event: goal.event.kind },
        confidence: 0.7,
      });
    }
  }

  // More load: fresh, consistent, a goal behind, nothing in health against it, and no safety proposal.
  const consistent = m.trace.slice(-3).filter((t) => t.sessions >= 2).length >= 3;
  const behind = x.progress.some((g) => g.trend === "behind");
  const healthBlock = !!(x.health?.condition || x.health?.injury || x.health?.easyOnly || p.effortByFeel);
  if (x.hasSeason && !out.some((o) => o.safety) && r.level === "fresh" && acwr < 1.0 && consistent && behind && !healthBlock) {
    out.push({
      key: `load_up:${week}`,
      kind: "load_up",
      safety: false,
      reasons: ["fresh_consistent_behind"],
      change: { load: { scale: 1.1, week } },
      confidence: 0.65,
    });
  }

  // Cool-downs and Quiet.
  const age = (at: string) => dayNum(today) - dayNum(at.slice(0, 10));
  const kindOf = (key: string) => key.slice(0, Math.max(0, key.lastIndexOf(":")));
  // The same proposal: pending, turned down < 14 days ago, accepted < 7 days ago. The same kind turned down < 14
  // days ago also waits (a new number is not a reason to ask again), except safety.
  const blocked = (o: InsightProposal) =>
    x.decisions.some((d) =>
      d.key === o.key
        ? d.status === "pending" ||
          (d.status === "rejected" && age(d.at) < REJECT_COOLDOWN_DAYS) ||
          (d.status === "accepted" && age(d.at) < ACCEPT_COOLDOWN_DAYS)
        : kindOf(d.key) === kindOf(o.key) &&
          ((d.status === "rejected" && !o.safety && age(d.at) < REJECT_COOLDOWN_DAYS) ||
            d.status === "pending" ||
            (d.status === "accepted" && age(d.at) < ACCEPT_COOLDOWN_DAYS)),
    );
  return out
    .filter((o) => !blocked(o))
    .filter((o) => o.safety || x.suggestLevel !== "quiet")
    .sort((a, b) => Number(b.safety) - Number(a.safety) || Number(isGoal(b)) - Number(isGoal(a)) || b.confidence - a.confidence)
    .slice(0, MAX_OUT);
}

/**
 * The season edits a load proposal makes on this week's sessions still to come (today on, unlocked, not skipped):
 * minutes × scale (rounded to 5, at least 15), a deload also marks the week easier. Undo = delete these edits. Pure.
 */
export function loadEdits(sessions: readonly SeasonSession[], load: NonNullable<InsightChange["load"]>, today: string): SeasonEditDraft[] {
  const edits: SeasonEditDraft[] = [];
  const end = addDays(load.week, 6);
  for (const s of sessions) {
    if (s.date < today || s.date > end || s.locked || s.skipped || s.purpose === "race") continue;
    if (load.scale > 1 && s.key) continue; // more load goes to easy sessions only
    const minutes = Math.max(15, Math.round((s.minutes * load.scale) / 5) * 5);
    const capped = load.scale > 1 ? Math.min(minutes, s.minutes + 15) : minutes;
    if (capped !== s.minutes) edits.push({ kind: "change", session: s.id, minutes: capped });
  }
  if (load.deload) edits.push({ kind: "easier", week: load.week });
  return edits;
}

// ── Words ───────────────────────────────────────────────────────────────────────────────────────────────────

const REASON: Record<InsightReason, { en: string; fr: string }> = {
  strained: {
    en: "Your body shows strain (heart-rate variability, resting heart rate, sleep).",
    fr: "Ton corps montre des signes de fatigue (variabilité cardiaque, cœur au repos, sommeil).",
  },
  tired: { en: "You look a bit tired these days.", fr: "Tu sembles un peu fatigué ces jours-ci." },
  load_spike: {
    en: "This week is much bigger than your usual weeks: that is when injuries happen.",
    fr: "Cette semaine est bien plus chargée que d’habitude : c’est là que les blessures arrivent.",
  },
  fresh_consistent_behind: {
    en: "You are fresh, regular for 3 weeks, and your goal needs a little more.",
    fr: "Tu es frais, régulier depuis 3 semaines, et ton objectif demande un peu plus.",
  },
  max_seen: { en: "Your heart went this high in more than one session.", fr: "Ton cœur est monté aussi haut dans plusieurs séances." },
  max_health: { en: "Measured by Health.", fr: "Mesuré par Santé." },
  resting_health: { en: "Your mornings in Health over the last two weeks.", fr: "Tes matins dans Santé ces deux dernières semaines." },
  speed_hr: {
    en: "The speed you really hold with your heart in zone 2, over your recent sessions.",
    fr: "La vitesse que tu tiens vraiment avec le cœur en zone 2, sur tes dernières séances.",
  },
  goal_at_risk: {
    en: "Even progressing as fast as is safe, the date is too close.",
    fr: "Même en progressant au plus vite sans risque, la date est trop proche.",
  },
};
export const insightReasonLine = (r: InsightReason, lang: Lang) => REASON[r][lang];

export interface InsightText {
  summary: string;
  why: string[];
  lines: { label: string; from: string | null; to: string }[];
}

/** The card: a one-line summary, why, and "from → to" lines (the API stores these, the apps show them). Pure. */
export function insightText(
  p: InsightProposal,
  lang: Lang,
  o: { units?: "metric" | "imperial"; goalName?: string; sportName?: string; longDate?: (iso: string) => string } = {},
): InsightText {
  const fr = lang === "fr";
  const why = p.reasons.map((r) => REASON[r][lang]);
  const date = (iso: string) => (o.longDate ? o.longDate(iso) : iso);
  const kmh = (v: number) => (o.units === "imperial" ? `${Math.round((v / 1.609344) * 10) / 10} mph` : `${v} km/h`);
  const goal = o.goalName ?? (fr ? "ton objectif" : "your goal");
  const c = p.change;
  switch (p.kind) {
    case "deload":
      return {
        summary: fr ? "Semaine allégée : on récupère pour mieux repartir" : "A lighter week: recover now, come back stronger",
        why,
        lines: [
          {
            label: fr ? "Séances restantes" : "Sessions left",
            from: "100 %",
            to: `${Math.round((c.load?.scale ?? 0.6) * 100)} %, ${fr ? "faciles" : "easy"}`,
          },
        ],
      };
    case "load_down":
      return {
        summary: fr ? "Un peu moins cette semaine" : "A little less this week",
        why,
        lines: [{ label: fr ? "Séances restantes" : "Sessions left", from: "100 %", to: `${Math.round((c.load?.scale ?? 0.8) * 100)} %` }],
      };
    case "load_up":
      return {
        summary: fr ? "Un peu plus cette semaine, sur les séances faciles" : "A little more this week, on the easy sessions",
        why,
        lines: [{ label: fr ? "Séances faciles" : "Easy sessions", from: "100 %", to: `${Math.round((c.load?.scale ?? 1.1) * 100)} %` }],
      };
    case "max_hr":
      return {
        summary: fr ? `FC max à ${c.maxHr} : tes zones suivent` : `Max heart rate ${c.maxHr}: your zones follow`,
        why,
        lines: [{ label: fr ? "FC max" : "Max heart rate", from: p.from?.maxHr ? String(p.from.maxHr) : null, to: String(c.maxHr) }],
      };
    case "resting_hr":
      return {
        summary: fr ? `Cœur au repos à ${c.restingHr} : tes zones suivent` : `Resting heart rate ${c.restingHr}: your zones follow`,
        why,
        lines: [
          {
            label: fr ? "FC au repos" : "Resting heart rate",
            from: p.from?.restingHr ? String(p.from.restingHr) : null,
            to: String(c.restingHr),
          },
        ],
      };
    case "pace_zones": {
      const sp = o.sportName ?? c.pace?.sport ?? "";
      return {
        summary: fr ? `${sp} : allures ajustées à ce que tu tiens vraiment` : `${sp}: paces set to what you really hold`,
        why,
        lines: [
          { label: fr ? "Facile" : "Easy", from: p.from?.pace ? kmh(p.from.pace.easy) : null, to: kmh(c.pace!.easy) },
          { label: fr ? "Soutenu" : "Hard", from: p.from?.pace ? kmh(p.from.pace.hard) : null, to: kmh(c.pace!.hard) },
        ],
      };
    }
    case "goal_postpone":
      return {
        summary: fr ? `Décaler ${goal} au ${date(c.goal!.date!)}` : `Move ${goal} to ${date(c.goal!.date!)}`,
        why: [
          ...why,
          fr
            ? "Tu gardes ton objectif, avec le temps de t’y préparer sans te blesser."
            : "You keep your goal, with time to prepare without getting hurt.",
        ],
        lines: [{ label: fr ? "Date" : "Date", from: p.from?.date ? date(p.from.date) : null, to: date(c.goal!.date!) }],
      };
    case "goal_resize": {
      const name = (k?: EventKind) => (k ? EVENT_PRESETS[k].name[lang] : "");
      return {
        summary: fr ? `Viser un ${name(c.goal!.event)} à la même date` : `Aim for a ${name(c.goal!.event)} on the same date`,
        why: [...why, fr ? "Une étape réaliste maintenant, la grande distance ensuite." : "A realistic step now, the big one after."],
        lines: [{ label: fr ? "Épreuve" : "Event", from: name(p.from?.event) || null, to: name(c.goal!.event) }],
      };
    }
  }
}
