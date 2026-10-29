// Copied from VVFit packages/game-core/src/nextStep.ts (02f6c705 2026-10-28) by scripts/sync-suggest-core.ts. Do not edit: re-sync.
/**
 * The next-step engine (living app, ADR-0062 §4 and the promotion map §9/§14.1): after something ends, at most one
 * primary and two secondary actions chosen for this athlete, never during a workout, gated by the Your VVake features
 * (ADR-0059 `packOn`), the suggestion level (suggest.ts: guide 3 / essentials 1 / quiet 0) and a per-athlete ledger that
 * learns: dismissed twice → muted 60 days, ignored 4 times in a row → muted 30 days, accepted 3 times in 30 days →
 * preferred. Each step has its own cap (days between two offers) and an optional "never after N No".
 *
 * Pure. The ledger is the athlete's own data (local first, synced as `prefs.steps`, newest-wins per step). The phone and
 * the web run the engine; the watches show the phone's pick (WatchContext), so there is no Swift/Kotlin copy.
 */
import type { TailorFeature } from "../tailor/tailor";
import { nextStepLimit, suggestAllowed, type SuggestLevel } from "./suggest";

export const MOMENT_KINDS = [
  "gps_end", // a run, ride, walk… with GPS (town or road)
  "hike_end", // a hike / trail / open water / climb (outdoor nature sports)
  "camera_end", // a camera workout (routine, move, own workout)
  "training_end", // a custom training run
  "skill_end", // a skill session answered
  "teach_saved", // a move taught
  "challenge_end", // a challenge result
  "week_end", // Sunday 17:00 → Monday
  "race_done", // a season goal / race passed
  "plan_saved", // a plan, a coach proposal accepted, a week edited
  "meetup_saved", // a meetup created or joined
] as const;
export type MomentKind = (typeof MOMENT_KINDS)[number];

/** What just happened, as far as the engine needs (every field optional except the kind). */
export interface Moment {
  kind: MomentKind;
  sport?: string;
  minutes?: number;
  feel?: "hard" | "right" | "easy";
  /** A personal best in this session (distance/duration ghost best, or a training score best). */
  pb?: boolean;
  /** The session's place: new to everyone we know of (no OSM spot of the sport nearby, no saved spot). */
  placeNew?: boolean;
  /** Notes other athletes left on this place (place notes). */
  placeNotes?: number;
  /** Sessions this athlete did at this spot (this one included). */
  spotVisits?: number;
  /** The spot (or the next planned one) is remote: no signal expected. */
  remote?: boolean;
  /** Sessions on this same route (route match), this one included; raced against the ghost yet. */
  routeRepeats?: number;
  routeRaced?: boolean;
  /** Camera: times this same routine was done; moves skipped/replaced in it; moves the athlete taught so far. */
  sameRoutine?: number;
  skippedMoves?: number;
  taughtMoves?: number;
  /** Camera: the routine is not saved as a training yet. */
  unsaved?: boolean;
  /** A training run score (0–1000). */
  score?: number;
  /** Sessions in the last 7 days (this one included) and the current day streak. */
  last7?: number;
  streak?: number;
  /** This session was recorded by the phone alone, and a paired watch exists without VVake on it. */
  phoneOnly?: boolean;
  watchWithoutApp?: boolean;
  /** No calendar linked (Apple / Google) on this device or account. */
  noCalendar?: boolean;
  /** A crew friend does this sport; a rival lives in the same city. */
  crewSameSport?: boolean;
  /** The athlete has a plan (season or weekly) and a next planned session. */
  hasPlan?: boolean;
  /** Feel was "hard" at least twice in the last 7 days. */
  hardTwice?: boolean;
  /** An open City Clash for the athlete's city right now. */
  clashOpen?: boolean;
  /** A skill ladder is unlocked by this session's moves, and no skill is active. */
  skillReady?: boolean;
  /** The week had no session (week_end). */
  emptyWeek?: boolean;
  /** Friends count (challenges, crew). */
  friends?: number;
}

/** One step the athlete can take. `route` + `params` open it; `text` is EN/FR with {vars} from the moment. */
export interface StepDef {
  id: string;
  moments: readonly MomentKind[];
  /** Feature that must be on (ADR-0059); none = core. Several = all must be on. */
  needs?: readonly TailorFeature[];
  /** Base weight (higher = more likely primary). */
  weight: number;
  /** At least this many days between two offers of this step. */
  capDays: number;
  /** Never offered again after this many "No" (dismissals). */
  maxNo?: number;
  /** Primary-only steps (a question that belongs first: feel, rate this spot). */
  primary?: boolean;
  when: (m: Moment) => boolean;
  route: string;
  params?: (m: Moment) => Record<string, string>;
  text: { en: string; fr: string };
}

const outdoorish = (m: Moment) => m.kind === "gps_end" || m.kind === "hike_end";

/** The catalogue (living-app.md §9 + §14.1), moment-bound entries only; ordered by nothing (weights decide). */
export const STEP_DEFS: readonly StepDef[] = [
  // ── Places
  {
    id: "rate_spot",
    moments: ["gps_end", "hike_end"],
    needs: ["outdoor"],
    weight: 90,
    capDays: 0,
    primary: true,
    when: (m) => !!m.placeNew || (m.placeNotes ?? 99) < 3,
    route: "/place-note",
    text: { en: "How was this spot? 3 taps.", fr: "Ce spot, c’était comment ? 3 touches." },
  },
  {
    id: "new_spot",
    moments: ["hike_end", "gps_end"],
    needs: ["outdoor"],
    weight: 40,
    capDays: 30,
    when: (m) => (m.spotVisits ?? 0) >= 3,
    route: "/places",
    params: (m) => ({ sport: m.sport ?? "", fresh: "1" }),
    text: { en: "Same spot again? Find a new one nearby.", fr: "Encore ce spot ? Trouve-en un nouveau près d’ici." },
  },
  {
    id: "plan_outing",
    moments: ["hike_end"],
    needs: ["outdoor"],
    weight: 45,
    capDays: 14,
    when: (m) => !!m.remote || (m.minutes ?? 0) >= 120,
    route: "/places",
    params: () => ({ plan: "1" }),
    text: {
      en: "Next outing: save the map for offline and share your plan.",
      fr: "Prochaine sortie : garde la carte hors ligne et partage ton plan.",
    },
  },
  // ── Competition and people
  {
    id: "dare_pb",
    moments: ["gps_end", "hike_end"],
    needs: ["social"],
    weight: 80,
    capDays: 7,
    when: (m) => !!m.pb,
    route: "/challenge",
    params: () => ({ from: "pb" }),
    text: { en: "New best! Dare a friend to beat it?", fr: "Nouveau record ! Défie un ami de le battre ?" },
  },
  {
    id: "clash_join",
    moments: ["gps_end", "hike_end", "camera_end"],
    needs: ["social"],
    weight: 60,
    capDays: 7,
    when: (m) => (m.last7 ?? 0) >= 5 || (m.streak ?? 0) >= 5,
    route: "/crew",
    params: (m): Record<string, string> => (m.clashOpen ? { clash: "1" } : {}),
    text: {
      en: "{last7} sessions this week. Take on your neighbourhood in a City Clash?",
      fr: "{last7} séances cette semaine. Défie ton quartier dans un City Clash ?",
    },
  },
  {
    id: "race_route",
    moments: ["gps_end", "hike_end"],
    needs: ["outdoor"],
    weight: 50,
    capDays: 30,
    when: (m) => (m.routeRepeats ?? 0) >= 2 && !m.routeRaced,
    route: "/workout",
    params: () => ({ ghost: "route" }),
    text: { en: "Same loop again? Race your best next time.", fr: "Encore cette boucle ? La prochaine fois, bats ton record." },
  },
  {
    id: "meetup_here",
    moments: ["gps_end", "hike_end"],
    needs: ["social"],
    weight: 45,
    capDays: 30,
    when: (m) => (m.spotVisits ?? 0) >= 2 && !!m.crewSameSport,
    route: "/meetup",
    params: (m) => ({ sport: m.sport ?? "", here: "1" }),
    text: { en: "Train here with your crew next time? Pick a time.", fr: "Et si ton équipe venait s’entraîner ici ? Choisis une heure." },
  },
  {
    id: "challenge_training",
    moments: ["training_end"],
    needs: ["camera", "social"],
    weight: 55,
    capDays: 7,
    when: (m) => !!m.pb || (m.score ?? 0) >= 800,
    route: "/challenge",
    params: () => ({ from: "training" }),
    text: { en: "{score}/1000. Challenge friends on this training?", fr: "{score}/1000. Défie tes amis sur cet entraînement ?" },
  },
  {
    id: "invite_friend",
    moments: ["gps_end", "camera_end"],
    weight: 15,
    capDays: 30,
    maxNo: 3,
    when: (m) => m.friends === 0 && (m.last7 ?? 0) >= 3,
    route: "/challenge",
    params: () => ({ invite: "1" }),
    text: { en: "Training is better with someone. Invite one friend.", fr: "C’est mieux à deux. Invite un ami." },
  },
  // ── Camera, library, skills
  {
    id: "save_training",
    moments: ["camera_end"],
    needs: ["camera"],
    weight: 55,
    capDays: 0,
    maxNo: 2,
    when: (m) => !!m.unsaved && (m.sameRoutine ?? 0) >= 3,
    route: "/training-builder",
    params: () => ({ from: "last" }),
    text: { en: "You keep doing this one. Save it as your training?", fr: "Tu la refais souvent. L’enregistrer comme entraînement ?" },
  },
  {
    id: "teach_move",
    moments: ["camera_end"],
    needs: ["camera"],
    weight: 45,
    capDays: 30,
    when: (m) => (m.skippedMoves ?? 0) >= 1 || (m.taughtMoves ?? 0) === 0,
    route: "/teach-move",
    text: { en: "A move you’d like VVake to count? Show it once.", fr: "Un mouvement que VVake devrait compter ? Montre-le une fois." },
  },
  {
    id: "new_training",
    moments: ["camera_end"],
    needs: ["camera"],
    weight: 40,
    capDays: 30,
    when: (m) => (m.sameRoutine ?? 0) >= 4,
    route: "/discover",
    text: { en: "Something new next time? Trainings people love.", fr: "Du neuf la prochaine fois ? Les entraînements préférés." },
  },
  {
    id: "try_skill",
    moments: ["camera_end"],
    needs: ["camera"],
    weight: 40,
    capDays: 30,
    when: (m) => !!m.skillReady,
    route: "/skills",
    text: { en: "Ready for a skill? Step 1 takes 5 minutes.", fr: "Prêt pour un skill ? L’étape 1 prend 5 minutes." },
  },
  {
    id: "skill_in_week",
    moments: ["skill_end"],
    needs: ["camera", "plan"],
    weight: 40,
    capDays: 30,
    maxNo: 2,
    when: (m) => !!m.hasPlan,
    route: "/plan",
    text: { en: "Put this skill in your week?", fr: "Ajouter ce skill à ta semaine ?" },
  },
  {
    id: "use_move",
    moments: ["teach_saved"],
    needs: ["camera"],
    weight: 60,
    capDays: 0,
    when: () => true,
    route: "/training-builder",
    text: { en: "Use it in a training.", fr: "Utilise-le dans un entraînement." },
  },
  // ── Plan and coach
  {
    id: "review_plan",
    moments: ["camera_end", "gps_end", "hike_end", "training_end"],
    needs: ["plan"],
    weight: 70,
    capDays: 7,
    when: (m) => !!m.hasPlan && (m.feel === "hard" || !!m.hardTwice || m.feel === "easy"),
    route: "/plan",
    params: () => ({ review: "1" }),
    text: { en: "Felt {feel}. Review your week with your coach?", fr: "Ressenti : {feel}. Revoir ta semaine avec ton coach ?" },
  },
  {
    id: "plan_next_week",
    moments: ["week_end"],
    needs: ["plan"],
    weight: 70,
    capDays: 6,
    when: () => true,
    route: "/plan",
    params: () => ({ week: "next" }),
    text: { en: "Plan next week.", fr: "Prépare la semaine prochaine." },
  },
  {
    id: "pick_days",
    moments: ["week_end"],
    weight: 50,
    capDays: 6,
    when: (m) => !m.hasPlan,
    route: "/season-sports",
    text: { en: "Pick 2 days for next week.", fr: "Choisis 2 jours pour la semaine prochaine." },
  },
  {
    id: "next_goal",
    moments: ["race_done"],
    needs: ["plan"],
    weight: 90,
    capDays: 0,
    primary: true,
    when: () => true,
    route: "/season-goal",
    text: { en: "What’s next? Pick your next goal.", fr: "Et maintenant ? Choisis ton prochain objectif." },
  },
  {
    id: "calendar_add",
    moments: ["plan_saved", "meetup_saved"],
    weight: 60,
    capDays: 0,
    maxNo: 2,
    when: (m) => !!m.noCalendar,
    route: "/connections",
    params: () => ({ calendar: "event" }),
    text: { en: "Add it to your calendar?", fr: "L’ajouter à ton agenda ?" },
  },
  // ── Devices
  {
    id: "watch_install",
    moments: ["gps_end", "hike_end", "camera_end"],
    weight: 35,
    capDays: 14,
    maxNo: 2,
    when: (m) => !!m.phoneOnly && !!m.watchWithoutApp && (m.minutes ?? 0) >= 15,
    route: "watch-install",
    text: { en: "Your watch adds your heart: full VV points.", fr: "Ta montre ajoute ton cœur : des VV points complets." },
  },
];

// ── The ledger ──────────────────────────────────────────────────────────────────────────────────────────────

export interface StepRecord {
  shown: number;
  accepted: number;
  dismissed: number;
  /** Ignored in a row (shown, screen left without a tap); reset by any tap. */
  ignoredRun: number;
  /** Accept times in the last 30 days (ISO), newest last, ≤ 5. */
  acceptedAt: string[];
  lastShown?: string;
  lastAt: string;
  mutedUntil?: string;
}
export type StepLedger = Record<string, StepRecord>;
export type StepEvent = "shown" | "accepted" | "dismissed" | "ignored";

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString();
const empty = (now: Date): StepRecord => ({ shown: 0, accepted: 0, dismissed: 0, ignoredRun: 0, acceptedAt: [], lastAt: iso(now) });

/** The ledger after one event (a new object; ≤ 200 steps kept, oldest dropped). Pure. */
export function recordStep(ledger: StepLedger, id: string, ev: StepEvent, now: Date): StepLedger {
  const r = { ...(ledger[id] ?? empty(now)), lastAt: iso(now) };
  if (ev === "shown") {
    r.shown += 1;
    r.lastShown = iso(now);
  } else if (ev === "accepted") {
    r.accepted += 1;
    r.ignoredRun = 0;
    r.acceptedAt = [...r.acceptedAt.filter((t) => now.getTime() - Date.parse(t) < 30 * DAY), iso(now)].slice(-5);
    delete r.mutedUntil;
  } else if (ev === "dismissed") {
    r.dismissed += 1;
    r.ignoredRun = 0;
    if (r.dismissed % 2 === 0) r.mutedUntil = iso(new Date(now.getTime() + 60 * DAY));
  } else {
    r.ignoredRun += 1;
    if (r.ignoredRun >= 4) {
      r.mutedUntil = iso(new Date(now.getTime() + 30 * DAY));
      r.ignoredRun = 0;
    }
  }
  const out = { ...ledger, [id]: r };
  const ids = Object.keys(out);
  if (ids.length > 200) {
    ids.sort((a, b) => Date.parse(out[a]!.lastAt) - Date.parse(out[b]!.lastAt));
    for (const k of ids.slice(0, ids.length - 200)) delete out[k];
  }
  return out;
}

/** Two ledgers merged (devices): per step, the record touched last wins. Pure. */
export function mergeLedgers(a: StepLedger | null | undefined, b: StepLedger | null | undefined): StepLedger {
  const out: StepLedger = { ...(a ?? {}) };
  for (const [k, r] of Object.entries(b ?? {})) if (!out[k] || Date.parse(r.lastAt) > Date.parse(out[k]!.lastAt)) out[k] = r;
  return out;
}

/** Steps kept per athlete, and days a record is kept after its last touch (unless still muted). */
export const LEDGER_MAX_STEPS = 200;
export const LEDGER_KEEP_DAYS = 90;

/**
 * The ledger kept: records touched in the last 90 days (or still muted), ≤ 200 (oldest touched dropped); a record
 * stamped in the future counts as now (a wrong device clock never wins forever). Pure.
 */
export function trimLedger(ledger: StepLedger | null | undefined, now: Date): StepLedger {
  const t = now.getTime();
  const kept = Object.entries(ledger ?? {})
    .filter(([, r]) => Number.isFinite(Date.parse(r.lastAt)))
    .map(([k, r]) => [k, Date.parse(r.lastAt) > t ? { ...r, lastAt: iso(now) } : r] as const)
    .filter(([, r]) => t - Date.parse(r.lastAt) <= LEDGER_KEEP_DAYS * DAY || (!!r.mutedUntil && Date.parse(r.mutedUntil) > t))
    .sort((a, b) => Date.parse(b[1].lastAt) - Date.parse(a[1].lastAt) || a[0].localeCompare(b[0]))
    .slice(0, LEDGER_MAX_STEPS);
  return Object.fromEntries(kept);
}

/**
 * The ledger as synced to the account (`prefs.steps`): `at` = the last change, `resetAt` = the last "reset what VVake
 * learned" (records touched before it are gone on every device, even when an older device sends them again).
 */
export interface StepPrefs {
  ledger: StepLedger;
  at: string;
  resetAt?: string;
}

/** Two synced ledgers merged: per step the newest lastAt wins, the latest reset applies, then trimmed. Pure. */
export function mergeStepPrefs(a: StepPrefs | null | undefined, b: StepPrefs | null | undefined, now: Date): StepPrefs | null {
  if (!a && !b) return null;
  const cap = (s?: string) => (s && Date.parse(s) > now.getTime() ? iso(now) : s);
  const later = (x?: string, y?: string) => cap(!x ? y : !y ? x : Date.parse(y) > Date.parse(x) ? y : x);
  const resetAt = later(a?.resetAt, b?.resetAt);
  let ledger = mergeLedgers(trimLedger(a?.ledger, now), trimLedger(b?.ledger, now));
  if (resetAt) ledger = Object.fromEntries(Object.entries(ledger).filter(([, r]) => Date.parse(r.lastAt) > Date.parse(resetAt)));
  return { ledger: trimLedger(ledger, now), at: later(a?.at, b?.at) ?? iso(now), ...(resetAt ? { resetAt } : {}) };
}

/** How much the athlete likes this step: (1 + accepted) / (1 + accepted + 2·dismissed + 0.5·ignored-run). Pure. */
export function learnFactor(r: StepRecord | undefined): number {
  if (!r) return 1;
  return (1 + r.accepted) / (1 + r.accepted + 2 * r.dismissed + 0.5 * r.ignoredRun);
}

/** Accepted 3 times in 30 days: this step leads its moments. Pure. */
export const preferred = (r: StepRecord | undefined, now: Date): boolean =>
  !!r && r.acceptedAt.filter((t) => now.getTime() - Date.parse(t) < 30 * DAY).length >= 3;

export interface StepContext {
  level: SuggestLevel;
  /** Feature gate (ADR-0059 packOn bound to the profile; with Tailor off every feature is on). */
  featureOn: (f: TailorFeature) => boolean;
  ledger: StepLedger;
  now: Date;
  inWorkout?: boolean;
  lang?: "en" | "fr";
}

export interface Step {
  id: string;
  route: string;
  params: Record<string, string>;
  text: string;
}
export interface NextSteps {
  primary: Step | null;
  more: Step[];
}

const FEEL_TEXT = {
  en: { hard: "hard", right: "just right", easy: "easy" },
  fr: { hard: "dur", right: "juste bien", easy: "facile" },
} as const;

function fill(t: string, m: Moment, lang: "en" | "fr"): string {
  return t.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (k === "feel") return m.feel ? FEEL_TEXT[lang][m.feel] : "";
    const v = (m as unknown as Record<string, unknown>)[k];
    return v === undefined ? "" : String(v);
  });
}

/** Is this step offerable now (gates, mutes, caps, "never after N No")? Pure. */
export function stepOpen(d: StepDef, m: Moment, ctx: StepContext): boolean {
  if (!d.moments.includes(m.kind)) return false;
  if (d.needs && !d.needs.every((f) => ctx.featureOn(f))) return false;
  const r = ctx.ledger[d.id];
  const t = ctx.now.getTime();
  if (r?.mutedUntil && Date.parse(r.mutedUntil) > t) return false;
  if (d.maxNo !== undefined && (r?.dismissed ?? 0) >= d.maxNo) return false;
  if (d.capDays > 0 && r?.lastShown && t - Date.parse(r.lastShown) < d.capDays * DAY) return false;
  return d.when(m);
}

/**
 * The steps for a moment: ≤ nextStepLimit(level) in all, the first one primary. Nothing during a workout or in Quiet.
 * Score = weight × learnFactor, a preferred step first. `defs` defaults to the catalogue. Pure.
 */
export function nextSteps(m: Moment, ctx: StepContext, defs: readonly StepDef[] = STEP_DEFS): NextSteps {
  const none: NextSteps = { primary: null, more: [] };
  if (!suggestAllowed("next_step", ctx.level, { inWorkout: !!ctx.inWorkout })) return none;
  const limit = nextStepLimit(ctx.level);
  const lang = ctx.lang ?? "en";
  const open = defs
    .filter((d) => stepOpen(d, m, ctx))
    .map((d) => ({ d, pref: preferred(ctx.ledger[d.id], ctx.now), score: d.weight * learnFactor(ctx.ledger[d.id]) }))
    .sort(
      (a, b) =>
        Number(b.pref) - Number(a.pref) ||
        Number(!!b.d.primary) - Number(!!a.d.primary) ||
        b.score - a.score ||
        a.d.id.localeCompare(b.d.id),
    );
  const toStep = (d: StepDef): Step => ({
    id: d.id,
    route: d.route,
    params: d.params ? d.params(m) : {},
    text: fill(d.text[lang], m, lang),
  });
  if (!open.length) return none;
  const [first, ...rest] = open;
  // A primary-only question never sits in the secondary row.
  const more = rest
    .filter((x) => !x.d.primary)
    .slice(0, Math.max(0, limit - 1))
    .map((x) => toStep(x.d));
  return { primary: toStep(first!.d), more: suggestAllowed("next_step_more", ctx.level, { inWorkout: !!ctx.inWorkout }) ? more : [] };
}

/** The coach's one line about what the athlete likes and ignores (ADR-0062 §4.3). Pure. */
export function ledgerCoachLine(ledger: StepLedger, now: Date): string {
  const ids = Object.keys(ledger);
  const likes = ids.filter((k) => preferred(ledger[k], now) || (ledger[k]!.accepted >= 2 && learnFactor(ledger[k]) >= 0.6));
  const ignores = ids.filter(
    (k) => (ledger[k]!.mutedUntil && Date.parse(ledger[k]!.mutedUntil!) > now.getTime()) || learnFactor(ledger[k]) < 0.34,
  );
  if (!likes.length && !ignores.length) return "";
  return `Suggestions: likes ${likes.join(", ") || "nothing yet"}; ignores ${ignores.join(", ") || "nothing"} (never propose those).`;
}
